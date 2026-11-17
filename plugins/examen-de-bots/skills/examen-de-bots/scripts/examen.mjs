#!/usr/bin/env node
// Examen de bots: corre un examen contra un chatbot, califica y compara corridas.
// Sin dependencias. Node 18 o más nuevo.
//
//   node examen.mjs correr   --casos examen-bot/casos.json (--url URL | --cmd "node bot.js") [opciones]
//   node examen.mjs juzgar   <resultado.json> <veredictos.json>
//   node examen.mjs reporte  <resultado.json>
//   node examen.mjs comparar <antes.json> <despues.json>
//
// Opciones de "correr":
//   --url URL              POST JSON a esa dirección
//   --campo mensaje        nombre del campo donde va la pregunta (por defecto "mensaje")
//   --respuesta respuesta  ruta del campo con la respuesta, con puntos: "data.texto" (por defecto "respuesta")
//   --cuerpo '{"x":1}'     campos extra que se mandan en cada petición
//   --header "K: V"        encabezado extra (se puede repetir)
//   --cmd "node bot.js"    en lugar de --url: corre el comando con la pregunta como último argumento
//   --repeticiones N       veces que se hace cada pregunta (por defecto 1); un caso aprueba solo si aprueba en todas
//   --etiqueta texto       nombre corto para la corrida (por defecto "corrida")
//   --salida carpeta       dónde guardar (por defecto examen-bot/resultados)
//   --pausa ms             espera entre preguntas (por defecto 0)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

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

const leer = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const guardar = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 2) + '\n'); };
const regex = p => { const m = /^\/(.*)\/([a-z]*)$/s.exec(p); return m ? new RegExp(m[1], m[2]) : new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); };
const normal = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const coincide = (patron, texto) => regex(patron).test(texto) || regex(patron).test(normal(texto));
const campo = (obj, ruta) => ruta.split('.').reduce((v, k) => (v == null ? v : v[k]), obj);

async function preguntarUrl(o, pregunta) {
  const headers = { 'Content-Type': 'application/json' };
  for (const h of o.header) { const i = h.indexOf(':'); headers[h.slice(0, i).trim()] = h.slice(i + 1).trim(); }
  const cuerpo = { ...(o.cuerpo ? JSON.parse(o.cuerpo) : {}), [o.campo || 'mensaje']: pregunta };
  const r = await fetch(o.url, { method: 'POST', headers, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(120000) });
  const texto = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${texto.slice(0, 200)}`);
  let json; try { json = JSON.parse(texto); } catch { return texto; }
  const v = campo(json, o.respuesta || 'respuesta');
  if (v == null) throw new Error(`la respuesta no trae el campo "${o.respuesta || 'respuesta'}": ${texto.slice(0, 200)}`);
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function preguntarCmd(o, pregunta) {
  const partes = o.cmd.match(/"[^"]*"|'[^']*'|\S+/g).map(s => s.replace(/^["']|["']$/g, ''));
  return new Promise((resolve, reject) => {
    const p = spawn(partes[0], [...partes.slice(1), pregunta], { shell: false, timeout: 120000 });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve(out.trim()) : reject(new Error(`salió con código ${code}: ${err.slice(0, 200)}`))));
  });
}

function calificarAutomatico(caso, respuesta) {
  const faltan = (caso.debe || []).filter(p => !coincide(p, respuesta));
  const sobran = (caso.no_debe || []).filter(p => coincide(p, respuesta));
  if (faltan.length || sobran.length) {
    return { pasa: false, razon: [faltan.length && `le faltó: ${faltan.join(' | ')}`, sobran.length && `dijo lo que no debía: ${sobran.join(' | ')}`].filter(Boolean).join('; ') };
  }
  return { pasa: true };
}

function resumen(res) {
  const casos = res.casos.filter(c => c.estado !== 'por_juzgar');
  const por = {};
  for (const c of res.casos) {
    por[c.categoria] ??= { aprobados: 0, total: 0 };
    por[c.categoria].total++;
    if (c.estado === 'aprueba') por[c.categoria].aprobados++;
  }
  const criticos = res.casos.filter(c => c.critico);
  const lat = res.casos.flatMap(c => c.intentos.map(i => i.ms)).sort((a, b) => a - b);
  return {
    aprobados: res.casos.filter(c => c.estado === 'aprueba').length,
    total: res.casos.length,
    criticos_aprobados: criticos.filter(c => c.estado === 'aprueba').length,
    criticos_total: criticos.length,
    por_juzgar: res.casos.length - casos.length,
    por_categoria: por,
    latencia_ms: lat.length ? { mediana: lat[Math.floor(lat.length / 2)], p95: lat[Math.floor(lat.length * 0.95)] ?? lat[lat.length - 1] } : null,
    errores: res.casos.reduce((n, c) => n + c.intentos.filter(i => i.error).length, 0),
  };
}

function marcarGenericas(res) {
  // Una misma respuesta que aparece en 3 o más preguntas distintas es una respuesta "comodín".
  // Solo le quita el acierto a casos que aprobaron "por no decir nada malo" (sin `debe`) y que nadie juzgó.
  // Si la respuesta trae el dato que el caso exige, o el agente la juzgó, el acierto se respeta.
  const cuenta = new Map();
  for (const c of res.casos) for (const t of new Set(c.intentos.map(i => i.respuesta))) cuenta.set(t, (cuenta.get(t) || 0) + 1);
  for (const c of res.casos) {
    const generica = c.intentos.some(i => i.respuesta && cuenta.get(i.respuesta) >= 3);
    if (generica && c.estado === 'aprueba' && !c.acepta_generica && !c.tiene_debe && !c.juzgado) {
      c.estado = 'falla';
      c.razon = 'aprobó solo con una respuesta comodín que el bot da a muchas preguntas';
    }
    if (generica) c.respuesta_generica = true;
  }
}

async function correr(o) {
  if (!o.casos) throw new Error('falta --casos');
  if (!o.url && !o.cmd) throw new Error('falta --url o --cmd');
  const examen = leer(o.casos);
  const lista = Array.isArray(examen) ? examen : examen.casos;
  const reps = Math.max(1, Number(o.repeticiones || 1));
  const res = { fecha: new Date().toISOString(), etiqueta: o.etiqueta || 'corrida', destino: o.url || o.cmd, repeticiones: reps, version_casos: examen.version ?? null, casos: [] };
  for (const caso of lista) {
    const intentos = [];
    for (let r = 0; r < reps; r++) {
      const t0 = Date.now();
      try {
        const respuesta = o.url ? await preguntarUrl(o, caso.pregunta) : await preguntarCmd(o, caso.pregunta);
        intentos.push({ respuesta, ms: Date.now() - t0, ...calificarAutomatico(caso, respuesta) });
      } catch (e) {
        intentos.push({ error: e.message, ms: Date.now() - t0, pasa: false, razon: 'error al preguntar' });
      }
      if (o.pausa) await new Promise(s => setTimeout(s, Number(o.pausa)));
    }
    const fallo = intentos.find(i => !i.pasa);
    const estado = fallo ? 'falla' : caso.criterio ? 'por_juzgar' : 'aprueba';
    res.casos.push({ id: caso.id, categoria: caso.categoria, critico: !!caso.critico, acepta_generica: !!caso.acepta_generica, tiene_debe: !!(caso.debe && caso.debe.length), pregunta: caso.pregunta, criterio: caso.criterio, estado, razon: fallo?.razon, intentos });
    process.stdout.write(estado === 'aprueba' ? '.' : estado === 'falla' ? 'F' : '?');
  }
  process.stdout.write('\n');
  marcarGenericas(res);
  res.resumen = resumen(res);
  const archivo = path.join(o.salida || 'examen-bot/resultados', `${res.fecha.slice(0, 19).replace(/:/g, '-')}_${res.etiqueta.replace(/[^\w-]/g, '_')}.json`);
  guardar(archivo, res);
  imprimir(res);
  console.log(`\nGuardado en ${archivo}`);
  if (res.resumen.por_juzgar) console.log(`Faltan ${res.resumen.por_juzgar} casos por juzgar: node examen.mjs juzgar ${archivo} veredictos.json`);
}

function juzgar(archivo, archivoVeredictos) {
  const res = leer(archivo);
  const veredictos = leer(archivoVeredictos);
  for (const c of res.casos) {
    const v = veredictos[c.id];
    if (!v || (c.estado !== 'por_juzgar' && !c.respuesta_generica)) continue;
    c.estado = v.pasa ? 'aprueba' : 'falla';
    c.razon = v.razon;
    c.juzgado = true;
  }
  marcarGenericas(res);
  res.resumen = resumen(res);
  guardar(archivo, res);
  imprimir(res);
}

function imprimir(res) {
  const s = res.resumen;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  console.log(`\nCalificación: ${s.aprobados}/${s.total} (${pct(s.aprobados, s.total)}%)   Críticos: ${s.criticos_aprobados}/${s.criticos_total}`);
  if (s.por_juzgar) console.log(`Por juzgar: ${s.por_juzgar}`);
  for (const [cat, v] of Object.entries(s.por_categoria)) console.log(`  ${cat.padEnd(18)} ${v.aprobados}/${v.total}`);
  if (s.latencia_ms) console.log(`Tiempo de respuesta: mediana ${s.latencia_ms.mediana} ms, p95 ${s.latencia_ms.p95} ms   Errores: ${s.errores}`);
  const fallas = res.casos.filter(c => c.estado === 'falla').sort((a, b) => b.critico - a.critico);
  if (fallas.length) console.log('\nFallas:');
  for (const c of fallas) {
    const ej = c.intentos.find(i => !i.pasa) || c.intentos[0];
    console.log(`  ${c.critico ? '[CRÍTICO] ' : ''}${c.id}: ${c.razon}\n    P: ${c.pregunta}\n    R: ${(ej.respuesta ?? ej.error ?? '').slice(0, 220)}`);
  }
}

function comparar(a, b) {
  const A = leer(a), B = leer(b);
  if (A.version_casos !== B.version_casos) console.log(`Aviso: las corridas usan versiones distintas del examen (${A.version_casos} y ${B.version_casos}).`);
  const sa = A.resumen, sb = B.resumen;
  const d = (x, y) => (y - x > 0 ? `+${y - x}` : `${y - x}`);
  console.log(`Calificación: ${sa.aprobados}/${sa.total} → ${sb.aprobados}/${sb.total} (${d(sa.aprobados, sb.aprobados)})`);
  console.log(`Críticos:     ${sa.criticos_aprobados}/${sa.criticos_total} → ${sb.criticos_aprobados}/${sb.criticos_total} (${d(sa.criticos_aprobados, sb.criticos_aprobados)})`);
  for (const cat of new Set([...Object.keys(sa.por_categoria), ...Object.keys(sb.por_categoria)])) {
    const x = sa.por_categoria[cat] || { aprobados: 0, total: 0 }, y = sb.por_categoria[cat] || { aprobados: 0, total: 0 };
    console.log(`  ${cat.padEnd(18)} ${x.aprobados}/${x.total} → ${y.aprobados}/${y.total}`);
  }
  if (sa.latencia_ms && sb.latencia_ms) console.log(`Tiempo (mediana): ${sa.latencia_ms.mediana} ms → ${sb.latencia_ms.mediana} ms`);
  const mapa = new Map(A.casos.map(c => [c.id, c]));
  const empeoro = [], mejoro = [], nuevos = [];
  for (const c of B.casos) {
    const prev = mapa.get(c.id);
    if (!prev) { nuevos.push(c); continue; }
    if (prev.estado === 'aprueba' && c.estado === 'falla') empeoro.push(c);
    if (prev.estado === 'falla' && c.estado === 'aprueba') mejoro.push(c);
  }
  if (empeoro.length) console.log('\nEMPEORÓ:');
  for (const c of empeoro) console.log(`  ${c.critico ? '[CRÍTICO] ' : ''}${c.id}: ${c.razon}\n    R: ${(c.intentos.find(i => !i.pasa)?.respuesta ?? '').slice(0, 220)}`);
  if (mejoro.length) console.log('\nMejoró: ' + mejoro.map(c => c.id).join(', '));
  if (nuevos.length) console.log('\nCasos nuevos (no cuentan en la comparación): ' + nuevos.map(c => c.id).join(', '));
  process.exitCode = empeoro.some(c => c.critico) ? 1 : 0;
}

try {
  const o = opciones(resto);
  if (accion === 'correr') await correr(o);
  else if (accion === 'juzgar') juzgar(o._[0], o._[1]);
  else if (accion === 'reporte') imprimir(leer(o._[0]));
  else if (accion === 'comparar') comparar(o._[0], o._[1]);
  else console.log('Uso: node examen.mjs correr|juzgar|reporte|comparar …  (ver el inicio de este archivo)');
} catch (e) {
  console.error('Error: ' + e.message);
  process.exitCode = 2;
}
