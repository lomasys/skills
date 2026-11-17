#!/usr/bin/env node
// Rendimiento: mide una URL local varias veces, mide el peso de una página y compara corridas.
// Sin dependencias. Node 18 o más nuevo.
//
//   node medir.mjs medir    <url> [opciones]            tiempos: mediana, p95, peso de la respuesta
//   node medir.mjs peso     <url-de-pagina> [opciones]  qué descarga una página: JS, CSS, imágenes
//   node medir.mjs comparar <antes.json> <despues.json> antes → después, con aviso si es ruido
//
// Opciones de "medir":
//   --n 20                 peticiones que se miden (por defecto 20, máximo 200)
//   --calentar 3           peticiones previas que no cuentan (por defecto 3)
//   --concurrencia 1       peticiones a la vez (por defecto 1, máximo 10)
//   --metodo GET           --cuerpo '{"x":1}'   --header "K: V" (se puede repetir)
//   --max-p95 300          presupuesto: termina con error si el p95 pasa de esos ms
//   --max-bytes 200000     presupuesto: termina con error si la respuesta (sin comprimir) pesa más
// Opciones de "peso":
//   --max-js 300000        presupuesto: bytes de JavaScript que viajan por la red
//   --max-total 1000000    presupuesto: bytes por la red de todo lo que descarga la página
// Comunes:
//   --etiqueta antes       nombre de la corrida (por defecto "corrida")
//   --salida carpeta       dónde guardar (por defecto rendimiento/mediciones)
//   --permitir-host h      solo si el usuario lo autorizó: un host que no es local (máximo 20 peticiones, de una en una)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

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
const guardar = (o, datos) => {
  const archivo = path.join(o.salida || 'rendimiento/mediciones', `${datos.fecha.slice(0, 19).replace(/:/g, '-')}_${(o.etiqueta || 'corrida').replace(/[^\w-]/g, '_')}.json`);
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, JSON.stringify(datos, null, 2) + '\n');
  return archivo;
};
const kb = b => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);
const red = n => Math.round(n * 10) / 10;
const percentil = (orden, p) => orden[Math.max(0, Math.ceil(p * orden.length) - 1)];

// Regla de la skill: solo local o pruebas. Un host remoto necesita --permitir-host con ese mismo nombre.
function revisarDestino(url, o) {
  const h = new URL(url).hostname.replace(/^\[|\]$/g, '');
  const local = ['localhost', '::1', '0.0.0.0', 'host.docker.internal'].includes(h) || /^127\./.test(h)
    || /\.(localhost|test|local)$/.test(h) || /^(10|192\.168)\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (local) return false;
  if (o['permitir-host'] === h) return true;
  throw new Error(`"${h}" no es local. Esta herramienta solo mide local o pruebas. Si el usuario lo autorizó, usa --permitir-host ${h}`);
}

function headers(o) {
  const h = { 'Accept-Encoding': 'gzip, br' };
  for (const x of o.header) { const i = x.indexOf(':'); h[x.slice(0, i).trim()] = x.slice(i + 1).trim(); }
  return h;
}

// Petición con node:http para contar los bytes que viajan por la red (comprimidos) y los bytes reales, por separado.
const agentes = { 'http:': new http.Agent({ keepAlive: true }), 'https:': new https.Agent({ keepAlive: true }) };
function pedir(url, o, metodo = 'GET', cuerpoPeticion) {
  const u = new URL(url);
  const mod = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const req = mod.request(u, { method: metodo, headers: headers(o), agent: agentes[u.protocol], timeout: 60000 }, res => {
      const primerByte = performance.now() - t0;
      const trozos = [];
      res.on('data', d => trozos.push(d));
      res.on('end', () => {
        const ms = performance.now() - t0;
        const red = Buffer.concat(trozos);
        const enc = res.headers['content-encoding'];
        let cuerpo = red;
        try {
          if (enc === 'gzip') cuerpo = zlib.gunzipSync(red);
          else if (enc === 'br') cuerpo = zlib.brotliDecompressSync(red);
          else if (enc === 'deflate') cuerpo = zlib.inflateSync(red);
        } catch { /* se deja como llegó */ }
        resolve({ ms, primerByte, status: res.statusCode, headers: res.headers, red, cuerpo });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('tardó más de 60 s')));
    req.on('error', reject);
    if (cuerpoPeticion) req.write(cuerpoPeticion);
    req.end();
  });
}

async function una(url, o) {
  const r = await pedir(url, o, o.metodo || 'GET', o.cuerpo);
  return { ms: r.ms, primerByte: r.primerByte, status: r.status, bytes: r.cuerpo.length, bytesRed: r.red.length,
    huella: crypto.createHash('sha256').update(r.cuerpo).digest('hex').slice(0, 16),
    comprimido: r.headers['content-encoding'] || null, serverTiming: r.headers['server-timing'] || null };
}

async function medir(o) {
  const url = o._[0];
  if (!url) throw new Error('falta la URL');
  const remoto = revisarDestino(url, o);
  let n = Math.min(200, Math.max(1, Number(o.n || 20)));
  let conc = Math.min(10, Math.max(1, Number(o.concurrencia || 1)));
  if (remoto) { n = Math.min(n, 20); conc = 1; }
  const calentar = Math.max(0, Number(o.calentar ?? 3));
  for (let i = 0; i < calentar; i++) await una(url, o);
  const muestras = [];
  let pendientes = n;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (pendientes-- > 0) muestras.push(await una(url, o));
  }));
  const tiempos = muestras.map(m => m.ms).sort((a, b) => a - b);
  const estados = {};
  for (const m of muestras) estados[m.status] = (estados[m.status] || 0) + 1;
  const mediana = percentil(tiempos, 0.5);
  const res = {
    tipo: 'medir', fecha: new Date().toISOString(), etiqueta: o.etiqueta || 'corrida', url, metodo: o.metodo || 'GET',
    n, concurrencia: conc, calentar, estados,
    ms: { min: red(tiempos[0]), p25: red(percentil(tiempos, 0.25)), mediana: red(mediana), p75: red(percentil(tiempos, 0.75)),
      p95: red(percentil(tiempos, 0.95)), max: red(tiempos.at(-1)) },
    primer_byte_mediana_ms: red(percentil(muestras.map(m => m.primerByte).sort((a, b) => a - b), 0.5)),
    bytes: muestras[0].bytes, bytes_red: muestras[0].bytesRed, huella: muestras[0].huella, comprimido: muestras[0].comprimido, server_timing: muestras[0].serverTiming,
    ruido: red(((percentil(tiempos, 0.75) - percentil(tiempos, 0.25)) / mediana) * 100),
    ruido_ms: red(percentil(tiempos, 0.75) - percentil(tiempos, 0.25)),
  };
  const fallas = [];
  if (o['max-p95'] && res.ms.p95 > Number(o['max-p95'])) fallas.push(`p95 ${res.ms.p95} ms > presupuesto ${o['max-p95']} ms`);
  if (o['max-bytes'] && res.bytes > Number(o['max-bytes'])) fallas.push(`respuesta ${kb(res.bytes)} > presupuesto ${kb(Number(o['max-bytes']))}`);
  if (Object.keys(estados).some(s => s >= 400)) fallas.push(`hubo respuestas con error: ${JSON.stringify(estados)}`);
  res.presupuesto = fallas.length ? { pasa: false, fallas } : (o['max-p95'] || o['max-bytes']) ? { pasa: true } : null;
  const archivo = guardar(o, res);
  console.log(`${res.metodo} ${url}  (${n} peticiones, ${conc} a la vez, ${calentar} de calentamiento)`);
  console.log(`  Tiempo:  mediana ${res.ms.mediana} ms · p95 ${res.ms.p95} ms · min ${res.ms.min} · max ${res.ms.max}`);
  console.log(`  Primer byte (mediana): ${res.primer_byte_mediana_ms} ms`);
  console.log(`  Respuesta: ${kb(res.bytes)}${res.comprimido ? ` · viajan ${kb(res.bytes_red)} (${res.comprimido})` : ' (sin comprimir)'} · estados ${JSON.stringify(estados)}`);
  if (res.server_timing) console.log(`  Server-Timing: ${res.server_timing}`);
  if ((res.ruido > 25 && res.ruido_ms > 2) || (res.ms.p95 > 2 * res.ms.mediana && res.ms.p95 - res.ms.mediana > 5)) console.log(`  Aviso: mucha variación entre peticiones (${res.ruido}%). Cierra otros programas o sube --n antes de comparar.`);
  for (const f of fallas) console.log(`  FALLA: ${f}`);
  console.log(`Guardado en ${archivo}`);
  if (fallas.length) process.exitCode = 1;
}

function atributos(etiqueta) {
  const a = {};
  for (const m of etiqueta.matchAll(/([\w-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) a[m[1].toLowerCase()] = m[2] ? m[2].replace(/^["']|["']$/g, '') : true;
  return a;
}

async function peso(o) {
  const url = o._[0];
  if (!url) throw new Error('falta la URL de la página');
  revisarDestino(url, o);
  const r = await pedir(url, o);
  const html = r.cuerpo.toString('utf8');
  const origen = new URL(url).origin;
  // Quita el código de los <script> en línea para no confundir texto de JavaScript con etiquetas.
  const sinCodigo = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
  const cabeza = (sinCodigo.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
  const recursos = [];
  for (const m of sinCodigo.matchAll(/<script\b([^>]*)>/gi)) {
    const a = atributos(m[1]);
    if (a.src) recursos.push({ tipo: 'js', url: a.src, bloquea: cabeza.includes(m[0]) && !a.defer && !a.async && a.type !== 'module' });
  }
  for (const m of sinCodigo.matchAll(/<link\b([^>]*)>/gi)) {
    const a = atributos(m[1]);
    if (String(a.rel).toLowerCase() === 'stylesheet' && a.href) recursos.push({ tipo: 'css', url: a.href });
  }
  for (const m of sinCodigo.matchAll(/<img\b([^>]*)>/gi)) {
    const a = atributos(m[1]);
    if (a.src) recursos.push({ tipo: 'img', url: a.src, sinTamano: !(a.width && a.height), perezosa: a.loading === 'lazy' });
  }
  const filas = [{ tipo: 'html', url, bytes: r.cuerpo.length, red: r.red.length, gzip: zlib.gzipSync(r.cuerpo).length, comprimido: r.headers['content-encoding'] || null }];
  for (const rec of recursos) {
    const abs = new URL(rec.url, url);
    if (abs.origin !== origen) { filas.push({ ...rec, externo: true }); continue; }
    const rr = await pedir(abs.href, o);
    if (rr.status >= 400) { filas.push({ ...rec, error: rr.status }); continue; }
    filas.push({ ...rec, bytes: rr.cuerpo.length, red: rr.red.length, gzip: rec.tipo === 'img' ? rr.cuerpo.length : zlib.gzipSync(rr.cuerpo).length,
      comprimido: rr.headers['content-encoding'] || null, cache: rr.headers['cache-control'] || null });
  }
  // "red" son los bytes que de verdad viajan (comprimidos si el servidor comprime). Es el número que siente el cliente.
  const suma = t => filas.filter(f => !t || f.tipo === t).reduce((s, f) => s + (f.red || 0), 0);
  const avisos = [];
  for (const f of filas) {
    if (f.bloquea) avisos.push(`${f.url}: script en <head> sin defer/async; la página espera a que baje (${kb(f.bytes)})`);
    if (f.tipo === 'img' && f.bytes > 200 * 1024) avisos.push(`${f.url}: imagen de ${kb(f.bytes)}`);
    if (f.tipo === 'img' && f.sinTamano) avisos.push(`${f.url}: <img> sin width/height (la página brinca al cargar)`);
    if ((f.tipo === 'js' || f.tipo === 'css' || f.tipo === 'html') && f.bytes > 10 * 1024 && !f.comprimido) avisos.push(`${f.url}: se manda sin comprimir (con gzip pesaría ${kb(f.gzip)})`);
  }
  const res = { tipo: 'peso', fecha: new Date().toISOString(), etiqueta: o.etiqueta || 'corrida', url, recursos: filas,
    total: { todo: suma(), js: suma('js'), css: suma('css'), img: suma('img'), html: suma('html') }, avisos };
  const fallas = [];
  if (o['max-js'] && res.total.js > Number(o['max-js'])) fallas.push(`JavaScript ${kb(res.total.js)} > presupuesto ${kb(Number(o['max-js']))}`);
  if (o['max-total'] && res.total.todo > Number(o['max-total'])) fallas.push(`total ${kb(res.total.todo)} > presupuesto ${kb(Number(o['max-total']))}`);
  res.presupuesto = fallas.length ? { pasa: false, fallas } : (o['max-js'] || o['max-total']) ? { pasa: true } : null;
  const archivo = guardar(o, res);
  console.log(`Página ${url}`);
  console.log('  tipo   por la red    sin comprimir');
  for (const f of filas) console.log(`  ${f.tipo.padEnd(4)} ${(f.externo ? 'externo' : f.error ? `HTTP ${f.error}` : kb(f.red)).padStart(11)}  ${(f.bytes ? kb(f.bytes) : '').padStart(14)}  ${f.url}`);
  console.log('  (Solo cuenta lo que trae el HTML. Lo que el JavaScript agrega después, como imágenes de una lista, no aparece aquí.)');
  console.log(`  Total por la red: ${kb(res.total.todo)} · JS ${kb(res.total.js)} · CSS ${kb(res.total.css)} · imágenes ${kb(res.total.img)}`);
  if (avisos.length) console.log('Avisos:\n' + avisos.map(a => `  - ${a}`).join('\n'));
  for (const f of fallas) console.log(`  FALLA: ${f}`);
  console.log(`Guardado en ${archivo}`);
  if (fallas.length) process.exitCode = 1;
}

function comparar(a, b) {
  const A = leer(a), B = leer(b);
  if (A.tipo !== B.tipo) throw new Error('las dos corridas deben ser del mismo tipo (medir o peso)');
  const pct = (x, y) => (x ? `${y - x > 0 ? '+' : ''}${Math.round(((y - x) / x) * 100)}%` : '');
  // El puerto puede cambiar (original y copia corriendo a la vez); la ruta no.
  const ruta = x => { const u = new URL(x); return u.pathname + u.search; };
  if (ruta(A.url) !== ruta(B.url)) console.log(`Aviso: rutas distintas (${ruta(A.url)} y ${ruta(B.url)}). Compara la misma ruta.`);
  if (A.tipo === 'peso') {
    for (const k of ['todo', 'js', 'css', 'img', 'html']) console.log(`  ${k.padEnd(5)} ${kb(A.total[k]).padStart(10)} → ${kb(B.total[k]).padStart(10)}  ${pct(A.total[k], B.total[k])}`);
    return;
  }
  if (A.n !== B.n || A.concurrencia !== B.concurrencia) console.log('Aviso: las corridas usaron distinto --n o --concurrencia; la comparación vale menos.');
  console.log(`${A.etiqueta} → ${B.etiqueta}   ${B.url}`);
  console.log(`  Mediana:  ${A.ms.mediana} ms → ${B.ms.mediana} ms  (${pct(A.ms.mediana, B.ms.mediana)})`);
  console.log(`  p95:      ${A.ms.p95} ms → ${B.ms.p95} ms  (${pct(A.ms.p95, B.ms.p95)})`);
  console.log(`  Respuesta: ${kb(A.bytes)} → ${kb(B.bytes)}  (${pct(A.bytes, B.bytes)})`);
  const ra = A.bytes_red ?? A.bytes, rb = B.bytes_red ?? B.bytes;
  if (ra !== A.bytes || rb !== B.bytes) console.log(`  Por la red: ${kb(ra)} → ${kb(rb)}  (${pct(ra, rb)})`);
  if (JSON.stringify(Object.keys(A.estados)) !== JSON.stringify(Object.keys(B.estados))) console.log(`  Aviso: cambiaron los códigos de respuesta ${JSON.stringify(A.estados)} → ${JSON.stringify(B.estados)}`);
  if (A.huella && B.huella && A.huella !== B.huella) console.log('  Aviso: la respuesta CAMBIÓ (otra huella). Confirma que el arreglo regresa los mismos datos, o di qué cambió a propósito (por ejemplo, paginación).');
  else if (A.huella && B.huella) console.log('  La respuesta es idéntica byte por byte.');
  // Es ruido si el cambio de la mediana es menor a 10% (o 2 ms) o si los rangos p25–p75 se enciman.
  const cambio = B.ms.mediana - A.ms.mediana;
  const seEnciman = B.ms.p25 <= A.ms.p75 && A.ms.p25 <= B.ms.p75;
  const ruido = Math.abs(cambio) < Math.max(2, A.ms.mediana * 0.1) || seEnciman;
  console.log(ruido ? 'Veredicto: SIN DIFERENCIA CLARA (está dentro del ruido). No lo presentes como mejora.'
    : cambio < 0 ? `Veredicto: MEJORÓ ${Math.round(-cambio / A.ms.mediana * 100)}% (${red(A.ms.mediana / B.ms.mediana)}x más rápido)`
      : `Veredicto: EMPEORÓ ${Math.round(cambio / A.ms.mediana * 100)}%`);
  if (Math.abs(rb - ra) > ra * 0.1) console.log(`Peso por la red: ${rb < ra ? 'BAJÓ' : 'SUBIÓ'} ${Math.round(Math.abs(rb - ra) / ra * 100)}% (${kb(ra)} → ${kb(rb)}). En local la red no cuenta: el ahorro de tiempo para el cliente es un estimado.`);
  process.exitCode = !ruido && cambio > 0 ? 1 : 0;
}

try {
  const o = opciones(resto);
  if (accion === 'medir') await medir(o);
  else if (accion === 'peso') await peso(o);
  else if (accion === 'comparar') comparar(o._[0], o._[1]);
  else console.log('Uso: node medir.mjs medir|peso|comparar …  (ver el inicio de este archivo)');
} catch (e) {
  console.error('Error: ' + (e.cause?.message ? `${e.message} (${e.cause.message})` : e.message || e.code));
  process.exitCode = 2;
} finally {
  for (const a of Object.values(agentes)) a.destroy();
}
