#!/usr/bin/env node
// Prueba de carga LOCAL y de "lectura tras escritura". Sin dependencias. Node 18 o más nuevo.
//
//   node carga.mjs correr   --plan carga/plan.json --url http://localhost:3000 [opciones]
//   node carga.mjs comparar <antes.json> <despues.json>
//
// Opciones de "correr":
//   --url URL            dirección base de la app. Solo se acepta localhost, 127.x.x.x o ::1
//   --segundos N         cuánto dura (por defecto 20, máximo 300)
//   --concurrencia N     usuarios simultáneos (por defecto 10, máximo 50)
//   --header "K: V"      encabezado extra en cada petición (se puede repetir), por ejemplo una cookie de sesión de prueba
//   --etiqueta texto     nombre corto de la corrida (por defecto "corrida")
//   --salida carpeta     dónde guardar el resultado (por defecto carga/resultados)
//
// Formato del plan (ver referencias/carga.md):
//   { "version": 1, "escenarios": [ { "nombre": "...", "peso": 5, "pasos": [ { "metodo": "GET", "ruta": "/x?id={azar:1-100}" } ] } ] }
//   Cada paso acepta: metodo, ruta, cuerpo, headers, estado (código esperado; por defecto 2xx),
//   igual ({"campo": valor} que la respuesta JSON debe traer), guardar ({"variable": "campo.de.la.respuesta"}),
//   espera_ms (pausa antes del paso). En ruta y cuerpo: {azar:a-b}, {n} (número de iteración) y {variable} guardada.
import fs from 'node:fs';
import path from 'node:path';

const [, , accion, ...resto] = process.argv;

function opciones(args) {
  const o = { header: [], _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      if (k === 'header') o.header.push(v); else o[k] = v;
    } else o._.push(a);
  }
  return o;
}

const salir = msg => { console.error(msg); process.exit(2); };
const leer = f => JSON.parse(fs.readFileSync(f, 'utf8'));

function esLocal(u) {
  let h;
  try { h = new URL(u).hostname.replace(/^\[|\]$/g, ''); } catch { return false; }
  return h === 'localhost' || h.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(h) || h === '::1';
}

function rellenar(valor, vars, n) {
  if (typeof valor === 'string') {
    const solo = valor.match(/^\{(azar:\d+-\d+|n|[a-zA-Z_][\w]*)\}$/);
    const reemplazo = clave => {
      if (clave === 'n') return n;
      const azar = clave.match(/^azar:(\d+)-(\d+)$/);
      if (azar) { const a = +azar[1], b = +azar[2]; return a + Math.floor(Math.random() * (b - a + 1)); }
      return clave in vars ? vars[clave] : `{${clave}}`;
    };
    if (solo) return reemplazo(solo[1]); // conserva números
    return valor.replace(/\{(azar:\d+-\d+|n|[a-zA-Z_][\w]*)\}/g, (_, c) => String(reemplazo(c)));
  }
  if (Array.isArray(valor)) return valor.map(v => rellenar(v, vars, n));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, rellenar(v, vars, n)]));
  return valor;
}

const campo = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function percentil(lista, p) {
  if (!lista.length) return null;
  const orden = [...lista].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
}

async function correrEscenario(esc, base, headersExtra, n) {
  const vars = {};
  const t0 = performance.now();
  for (let i = 0; i < esc.pasos.length; i++) {
    const paso = esc.pasos[i];
    if (paso.espera_ms) await new Promise(r => setTimeout(r, paso.espera_ms));
    const ruta = rellenar(paso.ruta, vars, n);
    const cuerpo = paso.cuerpo ? JSON.stringify(rellenar(paso.cuerpo, vars, n)) : undefined;
    let res, datos;
    try {
      res = await fetch(base + ruta, {
        method: paso.metodo || 'GET',
        headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...headersExtra, ...(paso.headers || {}) },
        body: cuerpo,
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });
      const texto = await res.text();
      try { datos = JSON.parse(texto); } catch { datos = texto; }
    } catch (e) {
      return { ok: false, ms: performance.now() - t0, pasoFallido: i, motivo: `paso ${i + 1}: sin respuesta (${e.cause?.code || e.name})` };
    }
    const estadoOk = paso.estado ? res.status === paso.estado : res.status >= 200 && res.status < 300;
    if (!estadoOk) return { ok: false, ms: performance.now() - t0, pasoFallido: i, motivo: `paso ${i + 1}: estado ${res.status}` };
    for (const [k, v] of Object.entries(rellenar(paso.igual || {}, vars, n))) {
      if (String(campo(datos, k)) !== String(v)) {
        return { ok: false, ms: performance.now() - t0, pasoFallido: i, motivo: `paso ${i + 1}: "${k}" con otro valor`, ejemplo: `${k} = ${JSON.stringify(campo(datos, k))}, se esperaba ${JSON.stringify(v)}` };
      }
    }
    for (const [variable, ruta2] of Object.entries(paso.guardar || {})) vars[variable] = campo(datos, ruta2);
  }
  return { ok: true, ms: performance.now() - t0 };
}

async function correr(o) {
  if (!o.plan || !o.url) salir('Uso: node carga.mjs correr --plan carga/plan.json --url http://localhost:PUERTO');
  if (!esLocal(o.url)) salir(`Me niego: ${o.url} no es local. Esta herramienta solo prueba localhost, 127.x.x.x o ::1 (nunca producción ni staging).`);
  const plan = leer(o.plan);
  const segundos = Math.min(300, Number(o.segundos || 20));
  const concurrencia = Math.min(50, Number(o.concurrencia || 10));
  const etiqueta = o.etiqueta || 'corrida';
  const base = o.url.replace(/\/$/, '');
  const headersExtra = Object.fromEntries(o.header.map(h => { const i = h.indexOf(':'); return [h.slice(0, i).trim(), h.slice(i + 1).trim()]; }));
  const escenarios = plan.escenarios;
  const pesoTotal = escenarios.reduce((a, e) => a + (e.peso || 1), 0);
  const elegir = () => { let r = Math.random() * pesoTotal; for (const e of escenarios) { r -= e.peso || 1; if (r <= 0) return e; } return escenarios.at(-1); };

  const datos = Object.fromEntries(escenarios.map(e => [e.nombre, { tiempos: [], fallas: 0, motivos: {}, ejemplos: [], pasosFallidos: {} }]));
  let n = 0;
  const fin = Date.now() + segundos * 1000;
  console.log(`Carga local: ${base} · ${concurrencia} usuarios · ${segundos} s · plan v${plan.version || 1}`);
  const usuario = async () => {
    while (Date.now() < fin) {
      const esc = elegir();
      const r = await correrEscenario(esc, base, headersExtra, ++n);
      const d = datos[esc.nombre];
      d.tiempos.push(r.ms);
      if (!r.ok) {
        d.fallas++;
        d.motivos[r.motivo] = (d.motivos[r.motivo] || 0) + 1;
        if (r.ejemplo && d.ejemplos.length < 3) d.ejemplos.push(r.ejemplo);
        d.pasosFallidos[r.pasoFallido] = (d.pasosFallidos[r.pasoFallido] || 0) + 1;
      }
    }
  };
  const t0 = Date.now();
  await Promise.all(Array.from({ length: concurrencia }, usuario));
  const duracion = (Date.now() - t0) / 1000;

  const filas = escenarios.map(e => {
    const d = datos[e.nombre];
    const veces = d.tiempos.length;
    return {
      escenario: e.nombre,
      veces,
      porSegundo: +(veces / duracion).toFixed(1),
      fallas: d.fallas,
      fallasPct: veces ? +((d.fallas / veces) * 100).toFixed(1) : 0,
      p50: Math.round(percentil(d.tiempos, 50) ?? 0),
      p95: Math.round(percentil(d.tiempos, 95) ?? 0),
      p99: Math.round(percentil(d.tiempos, 99) ?? 0),
      motivos: d.motivos,
      ejemplos: d.ejemplos,
      pasosFallidos: d.pasosFallidos,
      escrituraLuegoLectura: e.pasos.length > 1 && e.pasos.slice(1).some(p => (p.metodo || 'GET') === 'GET') && (e.pasos[0].metodo || 'GET') !== 'GET',
    };
  });
  const resultado = { herramienta: 'carga.mjs', version: 1, etiqueta, fecha: new Date().toISOString(), url: base, plan: path.basename(o.plan), planVersion: plan.version || 1, segundos: duracion, concurrencia, escenarios: filas };

  console.log('\n| Escenario | Veces | Por seg | Fallas | p50 ms | p95 ms | p99 ms |');
  console.log('|---|---|---|---|---|---|---|');
  for (const f of filas) console.log(`| ${f.escenario} | ${f.veces} | ${f.porSegundo} | ${f.fallas} (${f.fallasPct}%) | ${f.p50} | ${f.p95} | ${f.p99} |`);
  const ryw = filas.filter(f => f.escrituraLuegoLectura && Object.keys(f.pasosFallidos).some(p => +p > 0));
  if (ryw.length) {
    console.log('\nLectura tras escritura: se guardó bien pero la lectura siguiente falló (señal de copia atrasada):');
    for (const f of ryw) {
      const tras = Object.entries(f.pasosFallidos).filter(([p]) => +p > 0).reduce((a, [, v]) => a + v, 0);
      console.log(`- ${f.escenario}: ${tras} de ${f.veces} veces · ${Object.entries(f.motivos).map(([m, v]) => `${m} (${v})`).join(', ')}`);
      if (f.ejemplos.length) console.log(`  ejemplo: ${f.ejemplos[0]}`);
    }
  }
  for (const f of filas.filter(f => f.fallas && !ryw.includes(f))) {
    console.log(`- ${f.escenario}: ${Object.entries(f.motivos).map(([m, v]) => `${m} (${v})`).join(', ')}`);
  }
  const salida = o.salida || 'carga/resultados';
  fs.mkdirSync(salida, { recursive: true });
  const archivo = path.join(salida, `${etiqueta}.json`);
  fs.writeFileSync(archivo, JSON.stringify(resultado, null, 2));
  console.log(`\nGuardado en ${archivo}`);
}

function comparar(o) {
  const [a, b] = o._;
  if (!a || !b) salir('Uso: node carga.mjs comparar <antes.json> <despues.json>');
  const antes = leer(a), despues = leer(b);
  if (antes.plan !== despues.plan || antes.planVersion !== despues.planVersion) {
    console.log(`Aviso: los planes son distintos (${antes.plan} v${antes.planVersion} contra ${despues.plan} v${despues.planVersion}). La comparación no es justa.`);
  }
  if (antes.concurrencia !== despues.concurrencia) console.log(`Aviso: concurrencia distinta (${antes.concurrencia} contra ${despues.concurrencia}).`);
  let empeoro = false;
  console.log(`\n| Escenario | p95 antes | p95 después | Cambio | Fallas antes | Fallas después |`);
  console.log('|---|---|---|---|---|---|');
  for (const f of despues.escenarios) {
    const g = antes.escenarios.find(x => x.escenario === f.escenario);
    if (!g) { console.log(`| ${f.escenario} | — | ${f.p95} | nuevo | — | ${f.fallasPct}% |`); continue; }
    const cambio = g.p95 ? Math.round(((f.p95 - g.p95) / g.p95) * 100) : 0;
    const peor = cambio > 20 || f.fallasPct > g.fallasPct + 1;
    if (peor) empeoro = true;
    console.log(`| ${peor ? '⚠️ ' : ''}${f.escenario} | ${g.p95} | ${f.p95} | ${cambio > 0 ? '+' : ''}${cambio}% | ${g.fallasPct}% | ${f.fallasPct}% |`);
  }
  console.log(empeoro ? '\nEmpeoró al menos un escenario (p95 +20% o más fallas).' : '\nNingún escenario empeoró.');
  process.exit(empeoro ? 1 : 0);
}

const o = opciones(resto);
if (accion === 'correr') await correr(o);
else if (accion === 'comparar') comparar(o);
else salir('Acciones: correr | comparar. Lee el encabezado de este archivo para ver las opciones.');
