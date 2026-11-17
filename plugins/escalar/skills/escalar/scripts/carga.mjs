#!/usr/bin/env node
// Prueba de carga controlada: simula usuarios concurrentes contra TU app local y dice dónde se rompe.
// Sin dependencias. Node 18 o más nuevo.
//
//   node carga.mjs correr   (--url URL [--url URL…] | --escenario carga/escenario.json) [opciones]
//   node carga.mjs objetivo --clientes 5000 --clientes-hoy 120 --peticiones-mes 900000   (sin datos: ver objetivo())
//   node carga.mjs comparar <antes.json> <despues.json>
//   node carga.mjs reporte  <resultado.json>
//
// Opciones de "correr":
//   --usuarios N             usuarios simultáneos (por defecto 10)
//   --escalones 10,50,200    sube por escalones y se detiene en el primero que se rompe (en lugar de --usuarios)
//   --duracion S             segundos por escalón (por defecto 20, máximo 600)
//   --rampa S                segundos para ir sumando usuarios al inicio de cada escalón (por defecto 5)
//   --pausa MS               lo que "piensa" cada usuario entre peticiones (por defecto 1000; 0 = sin pausa)
//   --rps N                  techo de peticiones por segundo en total (opcional)
//   --timeout MS             tiempo límite por petición (por defecto 10000)
//   --conexiones N           conexiones abiertas como máximo (por defecto el menor entre usuarios y 1000)
//   --header "K: V"          encabezado para todas las peticiones (se puede repetir)
//   --metodo POST --cuerpo '{"a":1}'   para --url
//   --parar-si-errores PCT   el escalón "se rompe" con más de este % de errores (por defecto 5)
//   --parar-si-p95 MS        o con un p95 mayor a esto (por defecto 2000)
//   --respiro S              pausa entre escalones para que la app se recupere (por defecto 5)
//   --etiqueta texto         nombre corto de la corrida (por defecto "corrida")
//   --salida carpeta         dónde guardar (por defecto carga/resultados)
//
// Seguridad: solo acepta hosts locales (localhost, *.localhost, 127.x, ::1, o nombres que resuelven SOLO a esas
// direcciones). Para otro host hacen falta las DOS cosas: --permitir-host <host> y --confirmo <host>, y solo
// después de que el usuario dijo por escrito que ese host NO es producción ni de un tercero.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';

const LIMITE_USUARIOS = 10000;   // tope absoluto de usuarios simultáneos
const LIMITE_DURACION = 600;     // segundos por escalón
const LIMITE_TOTAL = 1800;       // segundos de toda la corrida
const LIMITE_RPS_REMOTO = 50;    // tope de peticiones por segundo contra un host no local permitido

const [, , accion, ...resto] = process.argv;

function opciones(args) {
  const o = { header: [], url: [], _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      if (k === 'header' || k === 'url') o[k].push(v); else o[k] = v;
    } else o._.push(a);
  }
  return o;
}

const leer = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const guardar = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const num = (v, d) => (v === undefined ? d : Number(v));

// ---------- Hosts permitidos ----------
function esLoopback(ip) {
  if (net.isIPv4(ip)) return ip.startsWith('127.');
  if (net.isIPv6(ip)) return ip === '::1' || /^::ffff:127\./i.test(ip);
  return false;
}

async function revisarHost(u, o) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || esLoopback(host)) return { host, local: true };
  if (!net.isIP(host)) {
    try {
      const ips = await dns.lookup(host, { all: true });
      if (ips.length && ips.every(x => esLoopback(x.address))) return { host, local: true, nota: `${host} resuelve a ${ips.map(x => x.address).join(', ')}` };
    } catch { /* no resuelve: se trata como remoto */ }
  }
  if (o['permitir-host'] === host && o.confirmo === host) return { host, local: false };
  throw new Error(
    `"${host}" no es un host local. Esta herramienta no hace carga contra producción ni contra servidores de terceros.\n` +
    `Si es TU ambiente de pruebas y el usuario lo autorizó por escrito, repite con: --permitir-host ${host} --confirmo ${host}`);
}

// ---------- Escenario ----------
function armarEscenario(o) {
  if (o.escenario) {
    const e = leer(o.escenario);
    const pasos = (e.pasos || []).map((p, i) => ({ nombre: p.nombre || `paso${i + 1}`, metodo: (p.metodo || 'GET').toUpperCase(), url: new URL(p.ruta || p.url, e.base).toString(), peso: p.peso ?? 1, cuerpo: p.cuerpo, headers: p.headers || {}, verifica_marca: p.verifica_marca }));
    if (!pasos.length) throw new Error('el escenario no tiene "pasos"');
    return { pasos, headers: e.headers || {}, cuentas: e.cuentas || [{}] };
  }
  if (!o.url.length) throw new Error('falta --url o --escenario');
  const cuerpo = o.cuerpo ? JSON.parse(o.cuerpo) : undefined;
  return { pasos: o.url.map(u => ({ nombre: new URL(u).pathname, metodo: (o.metodo || 'GET').toUpperCase(), url: u, peso: 1, cuerpo, headers: {} })), headers: {}, cuentas: [{}] };
}

let contador = 0;
function rellenar(valor, vars) {
  if (typeof valor === 'string') return valor.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === 'uuid' ? crypto.randomUUID() : k === 'n' ? String(++contador) : String(vars[k] ?? '')));
  if (Array.isArray(valor)) return valor.map(v => rellenar(v, vars));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, rellenar(v, vars)]));
  return valor;
}

// ---------- Petición ----------
function pedir(paso, headers, timeout, agentes, vars) {
  return new Promise(resolve => {
    const u = new URL(paso.url);
    const cuerpo = paso.cuerpo === undefined ? null : JSON.stringify(rellenar(paso.cuerpo, vars));
    const h = rellenar({ ...headers, ...paso.headers }, vars);
    if (cuerpo) { h['Content-Type'] ??= 'application/json'; h['Content-Length'] = Buffer.byteLength(cuerpo); }
    const lib = u.protocol === 'https:' ? https : http;
    const t0 = performance.now();
    let listo = false;
    const fin = r => { if (!listo) { listo = true; clearTimeout(reloj); resolve({ ...r, ms: performance.now() - t0 }); } };
    const req = lib.request(u, { method: paso.metodo, headers: h, agent: agentes[u.protocol] }, res => {
      const partes = [];
      res.on('data', c => { if (paso.verifica_marca) partes.push(c); });
      res.on('end', () => {
        let otraCuenta = false;
        if (paso.verifica_marca && res.statusCode < 300) {
          try { otraCuenta = String(JSON.parse(Buffer.concat(partes).toString())[paso.verifica_marca]) !== String(vars.marca); } catch { /* no es JSON */ }
        }
        fin({ status: res.statusCode, otraCuenta });
      });
      res.on('error', e => fin({ error: e.code || e.message }));
    });
    const reloj = setTimeout(() => { req.destroy(); fin({ error: 'timeout' }); }, timeout);
    req.on('error', e => fin({ error: e.code || e.message }));
    if (cuerpo) req.write(cuerpo);
    req.end();
  });
}

// ---------- Estadística ----------
function pct(ordenado, p) { return ordenado.length ? Math.round(ordenado[Math.min(ordenado.length - 1, Math.ceil((p / 100) * ordenado.length) - 1)]) : null; }

function resumir(muestras, segundos) {
  const ms = muestras.map(m => m.ms).sort((a, b) => a - b);
  const errores = { timeout: 0, conexion: 0, http5xx: 0, http429: 0, http4xx: 0, otra_cuenta: 0 };
  for (const m of muestras) {
    if (m.error === 'timeout') errores.timeout++;
    else if (m.error) errores.conexion++;
    else if (m.status >= 500) errores.http5xx++;
    else if (m.status === 429) errores.http429++;
    else if (m.status >= 400) errores.http4xx++;
    else if (m.otraCuenta) errores.otra_cuenta++;
  }
  // errores_pct = fallas de capacidad (no respondió o respondió con error). La fuga entre cuentas va aparte en otra_cuenta.
  const totalErr = Object.values(errores).reduce((a, b) => a + b, 0) - errores.otra_cuenta;
  return {
    peticiones: muestras.length,
    por_segundo: +(muestras.length / segundos).toFixed(1),
    errores_pct: muestras.length ? +((totalErr / muestras.length) * 100).toFixed(1) : 0,
    otra_cuenta: errores.otra_cuenta,
    errores,
    ms: { p50: pct(ms, 50), p90: pct(ms, 90), p95: pct(ms, 95), p99: pct(ms, 99), max: ms.length ? Math.round(ms[ms.length - 1]) : null },
  };
}

// ---------- Un escalón ----------
async function escalon(n, cfg, esc, agentes) {
  const muestras = [];
  const t0 = Date.now();
  const fin = t0 + cfg.duracion * 1000;
  const totalPeso = esc.pasos.reduce((s, p) => s + p.peso, 0);
  const elegir = () => { let r = Math.random() * totalPeso; for (const p of esc.pasos) if ((r -= p.peso) < 0) return p; return esc.pasos[0]; };
  let siguiente = Date.now();
  const turno = async () => { if (!cfg.rps) return; const t = Math.max(Date.now(), siguiente); siguiente = t + 1000 / cfg.rps; if (t > Date.now()) await dormir(t - Date.now()); };
  let cortado = false;

  async function usuario(i) {
    await dormir((cfg.rampa * 1000 * i) / n);
    const cuenta = esc.cuentas[i % esc.cuentas.length];
    const { marca, ...headersCuenta } = cuenta;
    const vars = { vu: i, marca: marca ?? '' };
    while (Date.now() < fin && !cortado) {
      await turno();
      if (Date.now() >= fin || cortado) break;
      const paso = elegir();
      const r = await pedir(paso, { ...esc.headers, ...cfg.headers, ...headersCuenta }, cfg.timeout, agentes, vars);
      muestras.push({ paso: paso.nombre, ...r });
      // Freno de emergencia: si más de la mitad falla, no tiene caso seguir golpeando.
      if (muestras.length >= 200 && muestras.length % 50 === 0) {
        const err = muestras.filter(m => m.error || m.status >= 500).length / muestras.length;
        if (err > 0.5 && Date.now() - t0 > 5000) cortado = true;
      }
      if (cfg.pausa) await dormir(cfg.pausa * (0.5 + Math.random()));
    }
  }

  const cpu0 = process.cpuUsage();
  await Promise.all(Array.from({ length: n }, (_, i) => usuario(i)));
  const cpu = process.cpuUsage(cpu0);
  const seg = (Date.now() - t0) / 1000;
  const porPaso = {};
  for (const p of esc.pasos) porPaso[p.nombre] = resumir(muestras.filter(m => m.paso === p.nombre), seg);
  return {
    usuarios: n, segundos: +seg.toFixed(1), cortado_por_errores: cortado,
    total: resumir(muestras, seg), por_paso: porPaso,
    generador_cpu_pct: Math.round(((cpu.user + cpu.system) / 1e6 / seg) * 100),
  };
}

// ---------- correr ----------
async function correr(o) {
  const esc = armarEscenario(o);
  const revisados = new Map();
  for (const p of esc.pasos) {
    const u = new URL(p.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error(`protocolo no soportado: ${u.protocol}`);
    if (!revisados.has(u.host)) revisados.set(u.host, await revisarHost(u, o));
  }
  const remoto = [...revisados.values()].some(r => !r.local);

  const escalones = o.escalones ? o.escalones.split(',').map(Number) : [num(o.usuarios, 10)];
  if (escalones.some(n => !Number.isInteger(n) || n < 1)) throw new Error('usuarios y escalones deben ser enteros positivos');
  if (Math.max(...escalones) > LIMITE_USUARIOS) throw new Error(`el máximo es ${LIMITE_USUARIOS} usuarios simultáneos`);
  const cfg = {
    duracion: num(o.duracion, 20), rampa: num(o.rampa, 5), pausa: num(o.pausa, 1000), timeout: num(o.timeout, 10000),
    rps: o.rps ? Number(o.rps) : null, headers: {},
    pararErrores: num(o['parar-si-errores'], 5), pararP95: num(o['parar-si-p95'], 2000), respiro: num(o.respiro, 5),
  };
  if (cfg.duracion <= 0 || cfg.duracion > LIMITE_DURACION) throw new Error(`--duracion debe estar entre 1 y ${LIMITE_DURACION} segundos`);
  if (escalones.length * (cfg.duracion + cfg.respiro) > LIMITE_TOTAL) throw new Error(`la corrida completa pasaría de ${LIMITE_TOTAL / 60} minutos; usa menos escalones o menos duración`);
  if (cfg.rampa >= cfg.duracion) cfg.rampa = Math.floor(cfg.duracion / 3);
  if (cfg.pararP95 >= cfg.timeout) console.log(`AVISO: --parar-si-p95 (${cfg.pararP95}) no es menor que --timeout (${cfg.timeout}); el p95 nunca pasa del tiempo límite. Se usará "p95 llegó al tiempo límite" como corte.`);
  if (remoto) {
    cfg.rps = Math.min(cfg.rps || LIMITE_RPS_REMOTO, LIMITE_RPS_REMOTO);
    console.log(`AVISO: host no local autorizado. Techo forzado de ${cfg.rps} peticiones por segundo.`);
  }
  for (const h of o.header) { const i = h.indexOf(':'); if (i > 0) cfg.headers[h.slice(0, i).trim()] = h.slice(i + 1).trim(); }

  const conexiones = num(o.conexiones, Math.min(Math.max(...escalones), 1000));
  const agentes = { 'http:': new http.Agent({ keepAlive: true, maxSockets: conexiones }), 'https:': new https.Agent({ keepAlive: true, maxSockets: conexiones }) };

  for (const r of revisados.values()) if (r.nota) console.log(`Host local: ${r.nota}`);
  console.log(`Destino: ${[...revisados.keys()].join(', ')} · escalones ${escalones.join(', ')} · ${cfg.duracion}s cada uno · pausa ${cfg.pausa} ms · timeout ${cfg.timeout} ms${cfg.rps ? ` · techo ${cfg.rps} rps` : ''}`);

  const res = {
    fecha: new Date().toISOString(), etiqueta: o.etiqueta || 'corrida', destino: [...revisados.keys()],
    configuracion: { ...cfg, headers: Object.keys(cfg.headers), conexiones, escalones, pasos: esc.pasos.map(p => ({ nombre: p.nombre, metodo: p.metodo, peso: p.peso })) },
    escalones: [], se_rompio_en: null,
  };
  for (const [i, n] of escalones.entries()) {
    process.stdout.write(`\n▶ ${n} usuarios… `);
    const r = await escalon(n, cfg, esc, agentes);
    // La fuga entre cuentas se reporta aparte: es grave, pero no dice nada de la capacidad.
    const rotoPor = [];
    if (r.total.errores_pct > cfg.pararErrores) rotoPor.push(`errores ${r.total.errores_pct}% > ${cfg.pararErrores}%`);
    if (r.total.ms.p95 > cfg.pararP95) rotoPor.push(`p95 ${r.total.ms.p95} ms > ${cfg.pararP95} ms`);
    if (r.total.ms.p95 >= cfg.timeout * 0.95) rotoPor.push(`p95 llegó al tiempo límite de ${cfg.timeout} ms`);
    // Una ruta puede estar rota aunque el total se vea bien.
    for (const [nombre, s] of Object.entries(r.por_paso)) {
      if (s.peticiones >= 10 && s.errores_pct > Math.max(20, cfg.pararErrores)) rotoPor.push(`${nombre} falla ${s.errores_pct}%`);
    }
    r.roto_por = rotoPor;
    res.escalones.push(r);
    process.stdout.write(rotoPor.length ? `SE ROMPIÓ (${rotoPor.join('; ')})` : 'aguanta');
    if (r.total.errores.otra_cuenta) process.stdout.write(` · FUGA: ${r.total.errores.otra_cuenta} respuestas con datos de otra cuenta`);
    if (rotoPor.length) { res.se_rompio_en = n; break; }
    if (i < escalones.length - 1) await dormir(cfg.respiro * 1000);
  }
  for (const a of Object.values(agentes)) a.destroy();
  process.stdout.write('\n');
  const archivo = path.join(o.salida || 'carga/resultados', `${res.fecha.slice(0, 19).replace(/:/g, '-')}_${res.etiqueta.replace(/[^\w-]/g, '_')}.json`);
  guardar(archivo, res);
  imprimir(res);
  console.log(`\nGuardado en ${archivo}`);
}

function imprimir(res) {
  console.log(`\nCorrida "${res.etiqueta}" · ${res.fecha} · destino ${res.destino.join(', ')}`);
  console.log('Usuarios | Pet/s  | Errores | Otra cuenta | p50    p90    p95    p99    máx (ms) | Estado');
  for (const e of res.escalones) {
    const m = e.total.ms;
    console.log(`${String(e.usuarios).padStart(8)} | ${String(e.total.por_segundo).padStart(6)} | ${String(e.total.errores_pct + '%').padStart(7)} | ${String(e.total.errores.otra_cuenta).padStart(11)} | ${[m.p50, m.p90, m.p95, m.p99, m.max].map(x => String(x ?? '-').padStart(6)).join(' ')}   | ${e.roto_por?.length ? 'SE ROMPIÓ' : 'aguanta'}${e.cortado_por_errores ? ' (cortado: >50% fallaba)' : ''}`);
  }
  console.log('"Errores" = no respondió o respondió con error. "Otra cuenta" = respondió bien pero con datos de otra cuenta.');
  const ultimo = res.escalones[res.escalones.length - 1];
  if (!ultimo) return;
  console.log(`\nDetalle del último escalón (${ultimo.usuarios} usuarios), del paso más lento al más rápido:`);
  const pasos = Object.entries(ultimo.por_paso).sort((a, b) => (b[1].ms.p95 ?? 0) - (a[1].ms.p95 ?? 0));
  for (const [nombre, s] of pasos) {
    const errs = Object.entries(s.errores).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'sin errores';
    console.log(`  ${nombre.padEnd(22)} ${String(s.peticiones).padStart(6)} pet · p50 ${s.ms.p50 ?? '-'} · p95 ${s.ms.p95 ?? '-'} · p99 ${s.ms.p99 ?? '-'} ms · ${s.errores_pct}% err (${errs})`);
  }
  const fuga = res.escalones.reduce((n, e) => n + e.total.errores.otra_cuenta, 0);
  if (fuga) console.log(`\nFUGA ENTRE CUENTAS: ${fuga} respuestas traían datos de otra cuenta (campo verifica_marca). Esto es grave aunque la app aguante.`);
  if (res.se_rompio_en) console.log(`\nSe rompió con ${res.se_rompio_en} usuarios: ${ultimo.roto_por.join('; ')}.`);
  else console.log('\nAguantó todos los escalones.');
  const saturado = res.escalones.filter(e => e.generador_cpu_pct > 85);
  if (saturado.length) console.log(`AVISO: el generador usó ${Math.max(...saturado.map(e => e.generador_cpu_pct))}% de un núcleo. Está saturado: esos números miden también a esta máquina, no solo a la app. Baja usuarios o corre el generador en otra máquina local.`);
}

function comparar(a, b) {
  const A = leer(a), B = leer(b);
  console.log(`Antes:   "${A.etiqueta}" (${A.fecha})   se rompió en: ${A.se_rompio_en ?? 'no se rompió'}`);
  console.log(`Después: "${B.etiqueta}" (${B.fecha})   se rompió en: ${B.se_rompio_en ?? 'no se rompió'}`);
  const mapa = new Map(A.escalones.map(e => [e.usuarios, e]));
  console.log('Usuarios | Pet/s antes → después | Errores antes → después | p95 antes → después');
  let peor = false;
  for (const e of B.escalones) {
    const x = mapa.get(e.usuarios);
    if (!x) continue;
    if (e.total.errores_pct > x.total.errores_pct + 1 || e.total.ms.p95 > x.total.ms.p95 * 1.2) peor = true;
    console.log(`${String(e.usuarios).padStart(8)} | ${x.total.por_segundo} → ${e.total.por_segundo} | ${x.total.errores_pct}% → ${e.total.errores_pct}% | ${x.total.ms.p95} → ${e.total.ms.p95} ms`);
  }
  if (peor) console.log('\nEMPEORÓ en al menos un escalón.');
  process.exitCode = peor ? 1 : 0;
}

// Convierte clientes del negocio en peticiones por segundo y usuarios simultáneos (ley de Little).
// Con datos reales:  --clientes 5000 --clientes-hoy 120 --peticiones-mes 900000 [--dias 22 --horas 10 --pico 3 --pausa 3000]
// Sin datos reales:  --clientes 5000 --usuarios-por-cliente 3 --activos 10 --acciones-por-minuto 2 --peticiones-por-accion 2
function objetivo(o) {
  const clientes = num(o.clientes, 0), pico = num(o.pico, 3), pausa = num(o.pausa, 3000);
  if (!clientes) throw new Error('falta --clientes (los de la meta)');
  let rps;
  if (o['peticiones-mes']) {
    const hoy = num(o['clientes-hoy'], 0);
    if (!hoy) throw new Error('con --peticiones-mes también hace falta --clientes-hoy');
    const dias = num(o.dias, 22), horas = num(o.horas, 10), segundosUso = dias * horas * 3600;
    const porCliente = Number(o['peticiones-mes']) / hoy;
    rps = (porCliente * clientes) / segundosUso;
    console.log(`Datos reales: ${o['peticiones-mes']} peticiones al mes / ${hoy} clientes = ${Math.round(porCliente)} por cliente`);
    console.log(`Hoy: ${(Number(o['peticiones-mes']) / segundosUso).toFixed(1)} peticiones por segundo en horario de uso (${dias} días × ${horas} horas: supuesto)`);
    console.log(`Con ${clientes} clientes: ${rps.toFixed(1)} peticiones por segundo en promedio`);
  } else {
    const upc = num(o['usuarios-por-cliente'], 3), activos = num(o.activos, 10) / 100;
    const apm = num(o['acciones-por-minuto'], 2), ppa = num(o['peticiones-por-accion'], 2);
    const simultaneos = Math.ceil(clientes * upc * activos);
    rps = (simultaneos * apm * ppa) / 60;
    console.log(`SUPUESTOS (sin datos reales): ${clientes} clientes × ${upc} usuarios, ${activos * 100}% conectados en la hora pico = ${simultaneos} usuarios simultáneos`);
    console.log(`Cada uno hace ${apm} acciones por minuto de ${ppa} peticiones: ${rps.toFixed(1)} peticiones por segundo en promedio`);
    console.log('Si hay registros, usa mejor --peticiones-mes y --clientes-hoy.');
  }
  const meta = rps * pico;
  // Ley de Little: usuarios simultáneos = peticiones por segundo × (pausa + ~0,2 s de respuesta).
  const usuarios = Math.ceil(meta * (pausa / 1000 + 0.2));
  console.log(`Con picos de ×${pico}: la meta es ${Math.ceil(meta)} peticiones por segundo.`);
  const escalones = [...new Set([0.1, 0.25, 0.5, 1, 1.5].map(f => Math.min(LIMITE_USUARIOS, Math.max(1, Math.ceil(usuarios * f)))))];
  console.log(`\nPara simularlo con --pausa ${pausa} hacen falta unos ${usuarios} usuarios simultáneos:`);
  console.log(`  --escalones ${escalones.join(',')} --pausa ${pausa}`);
  if (usuarios * 1.5 > LIMITE_USUARIOS) console.log(`Pasa de ${LIMITE_USUARIOS} usuarios: baja --pausa, o mide un servidor y multiplica.`);
  console.log('El escalón ×1.5 deja margen. Di en el reporte qué números son supuestos.');
}

try {
  const o = opciones(resto);
  if (accion === 'correr') await correr(o);
  else if (accion === 'objetivo') objetivo(o);
  else if (accion === 'comparar') comparar(o._[0], o._[1]);
  else if (accion === 'reporte') imprimir(leer(o._[0]));
  else console.log('Uso: node carga.mjs correr|objetivo|comparar|reporte …  (ver el inicio de este archivo)');
} catch (e) {
  console.error('Error: ' + e.message);
  process.exitCode = 2;
}
