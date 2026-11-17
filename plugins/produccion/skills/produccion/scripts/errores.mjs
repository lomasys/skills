#!/usr/bin/env node
// Errores: agrupa un log o un export de errores por causa, cuenta el impacto y tapa secretos y datos personales.
// Sin dependencias. Node 18 o más nuevo. Solo lee el archivo que le das.
//
//   node errores.mjs <archivo|-> [--json] [--top N] [--incluir-avisos]
//
//   <archivo>          log de texto, JSON por línea, arreglo JSON o CSV (por ejemplo un export de Sentry). "-" lee de la entrada estándar.
//   --json             salida en JSON
//   --top N            cuántos grupos mostrar (por defecto 15)
//   --incluir-avisos   también agrupa WARN/INFO (por defecto solo los cuenta aparte)
//
// Nunca imprime una clave completa: muestra los primeros 4 caracteres. Los correos salen como a***@dominio.
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = { archivo: null, json: false, top: 15, avisos: false };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') opt.json = true;
  else if (args[i] === '--top') opt.top = Number(args[++i]);
  else if (args[i] === '--incluir-avisos') opt.avisos = true;
  else opt.archivo = args[i];
}
if (!opt.archivo) { console.log('Uso: node errores.mjs <archivo|-> [--json] [--top N] [--incluir-avisos]'); process.exit(2); }
const texto = fs.readFileSync(opt.archivo === '-' ? 0 : opt.archivo, 'utf8');

// ---------- tapar secretos y datos personales ----------
const corta = v => (v.length <= 4 ? '****' : `${v.slice(0, 4)}…`);
function tapar(s) {
  return String(s)
    .replace(/\b((?:[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|AUTH|CREDENTIAL)[A-Z0-9_]*)|api[_-]?key|token|secret|password|passwd|clave|contrase[ñn]a)\s*([=:])\s*["']?([^\s"'&,;]+)/gi, (_, k, sep, v) => `${k}${sep}${corta(v)}`)
    .replace(/\b(Bearer|Basic|Token)\s+([A-Za-z0-9._~+/=-]{8,})/g, (_, k, v) => `${k} ${corta(v)}`)
    .replace(/\b(sk|pk|rk|whsec|ghp|gho|github_pat|xox[abpr]|AKIA|AIza)[_-]?[A-Za-z0-9_-]{8,}/g, m => corta(m))
    .replace(/\b(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, m => corta(m))
    .replace(/(:\/\/[^:\/\s]+:)([^@\s]+)@/g, (_, a) => `${a}****@`)
    .replace(/\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, '$1***@$2')
    .replace(/\b(\d{4})\d{8,11}(\d{0,4})\b/g, '$1********');
}

// ---------- leer entradas ----------
const FECHA = /^\[?(\d{4}-\d{2}-\d{2}[T ][\d:.,]+(?:Z|[+-]\d{2}:?\d{2})?)\]?/;
// En mayúsculas a propósito: "Error:" dentro del mensaje no es el nivel.
const NIVEL = /\b(FATAL|CRITICAL|ERROR|ERR|WARN(?:ING)?|INFO|DEBUG|NOTICE)\b/;

function desdeObjeto(o) {
  const g = (...ks) => { for (const k of ks) { const v = k.split('.').reduce((x, p) => (x == null ? x : x[p]), o); if (v != null && v !== '') return v; } return undefined; };
  const pila = g('stack', 'stacktrace', 'exception.stacktrace', 'error.stack', 'err.stack');
  const mensaje = [g('title', 'message', 'msg', 'error.message', 'err.message', 'exception', 'culprit') ?? JSON.stringify(o), typeof pila === 'string' ? pila : ''].join('\n');
  return {
    fecha: g('timestamp', 'time', 'date', 'datetime', '@timestamp', 'lastSeen', 'last_seen', 'firstSeen'),
    nivel: String(g('level', 'severity', 'levelname', 'log.level') ?? 'error'),
    texto: mensaje,
    veces: Number(g('count', 'times_seen', 'events', 'timesSeen')) || 1,
    usuariosExport: Number(g('userCount', 'user_count', 'users')) || 0,
    usuario: g('user.id', 'user.email', 'user_id', 'userId', 'usuario', 'customer', 'tenant', 'account_id', 'user'),
    idEvento: g('event_id', 'eventId', 'request_id', 'requestId', 'req.id', 'order_id', 'job_id'),
    ruta: g('transaction', 'url', 'path', 'route', 'request.url'),
    primera: g('firstSeen', 'first_seen'),
  };
}

function csv(t) {
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) { if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') comillas = false; else campo += c; }
    else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  return resto.filter(f => f.length > 1).map(f => Object.fromEntries(cab.map((k, i) => [k.trim(), f[i]])));
}

function leer(t) {
  const limpio = t.trim();
  if (limpio.startsWith('[')) { try { return JSON.parse(limpio).map(desdeObjeto); } catch {} }
  const lineas = t.split(/\r?\n/);
  if (lineas.filter(Boolean).every(l => l.trim().startsWith('{'))) { try { return lineas.filter(Boolean).map(l => desdeObjeto(JSON.parse(l))); } catch {} }
  if (/^[^\n]*,(?:[^\n]*,)*[^\n]*\n/.test(t) && /(title|message|level|count|culprit)/i.test(lineas[0]) && !FECHA.test(lineas[0])) return csv(t).map(desdeObjeto);
  // Texto: una entrada empieza con fecha o nivel; las líneas con sangría, "at …", "File …", "Traceback", "#0" la continúan.
  const entradas = [];
  // Si el log pone fecha al inicio de cada entrada, toda línea sin fecha es parte de la entrada anterior (pilas de Python, Java, PHP).
  const conFecha = lineas.filter(l => FECHA.test(l)).length >= lineas.filter(l => l.trim()).length * 0.2;
  for (const l of lineas) {
    if (!l.trim()) continue;
    const continua = entradas.length && (conFecha ? !FECHA.test(l) : /^\s+|^(at |File "|Traceback|Caused by|#\d+ |\.\.\. \d+ more)/.test(l));
    if (continua) entradas[entradas.length - 1].texto += '\n' + l;
    else entradas.push({ fecha: (FECHA.exec(l) || [])[1], nivel: (NIVEL.exec(l) || [, 'error'])[1], texto: l, veces: 1 });
  }
  for (const e of entradas) {
    const u = /\b(?:usuario|user(?:_id|Id)?|uid|cliente|customer(?:_id)?|account(?:_id)?|tenant(?:_id)?|empresa(?:_id)?|org(?:_id)?)=([^\s,;]+)/i.exec(e.texto);
    if (u) e.usuario = u[1];
    const id = /\b(?:evento|event(?:_id|Id)?|request_id|requestId|req_id|pedido(?:_id)?|order(?:_id)?|job(?:_id)?)=([^\s,;]+)/i.exec(e.texto);
    if (id) e.idEvento = id[1];
    const r = /\b(?:ruta|path|route|url)=((?:GET|POST|PUT|PATCH|DELETE)\s+\S+|\S+)/i.exec(e.texto) || /\b(GET|POST|PUT|PATCH|DELETE) (\/\S*)/.exec(e.texto);
    if (r) e.ruta = r[2] ? `${r[1]} ${r[2]}` : r[1];
  }
  return entradas;
}

// ---------- firma de cada error ----------
const AJENO = /node_modules|node:internal|internal\/|site-packages|dist-packages|\/vendor\/|\/gems\/|<anonymous>|\/usr\/lib|java\.base|\bjdk\./;
// Los dos primeros lugares del código propio en la pila: dónde tronó y quién lo llamó.
function lugar(t) {
  const vistos = [];
  const patrones = [
    /\(([^()\s]+\.\w+):(\d+)(?::\d+)?\)/g,             // Node: at fn (/app/src/x.js:9:28)
    /at ([^()\s]+\.\w+):(\d+)(?::\d+)?\s*$/gm,          // Node sin función
    /File "([^"]+)", line (\d+)/g,                     // Python
    /^\s*#\d+ ([^(\s]+)\((\d+)\)/gm,                    // PHP
    /([\w./-]+\.(?:rb|php|py|ex|exs|go|rs|cs|kt|java|ts|js)):(\d+)/g, // Ruby, Go y genérico
  ];
  for (const re of patrones) {
    for (const m of t.matchAll(re)) {
      if (AJENO.test(m[1])) continue;
      const l = `${m[1].replace(/^\/?(app|srv|var\/www(\/html)?|usr\/src\/app|home\/\w+\/\w+|opt\/\w+|workspace)\//, '')}:${m[2]}`;
      if (!vistos.includes(l)) vistos.push(l);
      if (vistos.length === 2) break;
    }
    if (vistos.length) break;
  }
  return vistos.length ? vistos.join(' ← ') : null;
}
const SECRETO = /\b[A-Za-z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|CREDENTIAL|key|token|secret|password|passwd)[A-Za-z0-9_]*\s*[=:]\s*\S{6,}|\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}|\b(sk|rk|whsec|ghp|github_pat|xox[abpr]|AKIA|AIza)[_-]?[A-Za-z0-9_-]{8,}|:\/\/[^:\/\s]+:[^@\s]+@/;
const CORREO = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
function firma(e) {
  // En pilas de Python, Java o Ruby la excepción real viene al final: úsala como mensaje.
  const excepcion = e.texto.split('\n').slice(1).reverse().map(l => l.trim()).find(l => /^[\w.$]+(Error|Exception|Fault)\b.*:/.test(l));
  const primera = (excepcion || e.texto.split('\n')[0])
    .replace(FECHA, '').replace(NIVEL, '')
    .replace(/\b[\w.-]+=\S+/g, '')                               // usuario=…, ruta=…, evento=…
    .replace(/"[^"]{0,80}"|'[^']{0,80}'/g, m => (/constraint|column|relation|table|reading/.test(e.texto) ? m : '"…"'))
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b\d+(\.\d+){3}(:\d+)?\b/g, '<ip>')
    .replace(/\b[0-9a-f]{12,}\b/gi, '<hex>')
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, ' ').trim();
  return `${primera} @ ${lugar(e.texto) ?? '?'}`;
}

// ---------- agrupar ----------
const entradas = leer(texto);
const esError = n => /fatal|crit|err|emerg|alert/i.test(n);
const grupos = new Map();
let avisos = 0;
for (const e of entradas) {
  if (!opt.avisos && !esError(e.nivel)) { avisos += e.veces; continue; }
  const f = firma(e);
  if (!grupos.has(f)) grupos.set(f, { firma: f, nivel: e.nivel.toUpperCase(), lugar: lugar(e.texto), veces: 0, usuarios: new Set(), ids: new Set(), secretos: new Set(), usuariosExport: 0, rutas: new Map(), primera: null, ultima: null, ejemplo: e.texto });
  const g = grupos.get(f);
  g.veces += e.veces;
  if (e.usuario) g.usuarios.add(String(e.usuario));
  if (e.idEvento) g.ids.add(String(e.idEvento));
  for (const m of e.texto.matchAll(/\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|CREDENTIAL)[A-Z0-9_]*)\s*[=:]\s*\S{6,}/gi)) g.secretos.add(m[1]);
  if (/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/.test(e.texto)) g.secretos.add('Authorization');
  if (/:\/\/[^:\/\s]+:[^@\s]+@/.test(e.texto)) g.secretos.add('contraseña en URL');
  g.usuariosExport = Math.max(g.usuariosExport, e.usuariosExport || 0);
  if (e.ruta) g.rutas.set(e.ruta, (g.rutas.get(e.ruta) || 0) + e.veces);
  const f1 = e.primera || e.fecha, f2 = e.fecha;
  if (f1 && (!g.primera || f1 < g.primera)) g.primera = f1;
  if (f2 && (!g.ultima || f2 > g.ultima)) g.ultima = f2;
}
const lista = [...grupos.values()].map(g => ({
  nivel: g.nivel,
  mensaje: tapar(g.firma.split(' @ ')[0]),
  lugar: g.lugar,
  veces: g.veces,
  usuarios: g.usuariosExport || g.usuarios.size,
  // Si el error no trae usuario, cuenta ids distintos de evento, pedido o petición.
  eventos: g.ids.size,
  secretos: [...g.secretos],
  rutas: [...g.rutas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => tapar(r)),
  primera: g.primera, ultima: g.ultima,
  ejemplo: tapar(g.ejemplo).split('\n').slice(0, 6).join('\n'),
}))
  // Impacto: primero los que afectan a más usuarios, luego los más frecuentes.
  .sort((a, b) => (b.usuarios || b.eventos) - (a.usuarios || a.eventos) || b.veces - a.veces);

const fechas = entradas.map(e => e.fecha).filter(Boolean).sort();
const resumen = {
  entradas: entradas.length, errores: lista.reduce((s, g) => s + g.veces, 0), grupos: lista.length, avisos_omitidos: avisos,
  desde: fechas[0] ?? null, hasta: fechas.at(-1) ?? null,
  // Entradas que traen claves o correos: el log mismo es un problema (rotar la clave, dejar de registrar datos personales).
  con_secretos: entradas.filter(e => SECRETO.test(e.texto)).length,
  con_correos: entradas.filter(e => CORREO.test(e.texto)).length,
};

if (opt.json) console.log(JSON.stringify({ resumen, grupos: lista.slice(0, opt.top) }, null, 2));
else {
  console.log(`Entradas: ${resumen.entradas} · Errores: ${resumen.errores} en ${resumen.grupos} grupos · Avisos sin agrupar: ${avisos}`);
  console.log(`Periodo del archivo: ${resumen.desde ?? '?'} → ${resumen.hasta ?? '?'}`);
  if (resumen.con_secretos) console.log(`ATENCIÓN: ${resumen.con_secretos} entradas traen una clave o token. Aquí salen tapados; en el archivo original no.`);
  if (resumen.con_correos) console.log(`ATENCIÓN: ${resumen.con_correos} entradas traen correos de personas.`);
  console.log('');
  console.log('| # | Veces | Usuarios | Primera | Última | Dónde | Error |');
  console.log('|---|---|---|---|---|---|---|');
  lista.slice(0, opt.top).forEach((g, i) => console.log(`| ${i + 1}${g.secretos.length ? ` ⚠ clave en el log: ${g.secretos.join(', ')}` : ''} | ${g.veces} | ${g.usuarios || (g.eventos ? `${g.eventos} eventos` : '?')} | ${g.primera ?? '?'} | ${g.ultima ?? '?'} | \`${g.lugar ?? '?'}\` | ${g.mensaje.slice(0, 110).replace(/\|/g, '\\|')}${g.rutas.length ? ` (${g.rutas.join(', ')})` : ''} |`));
  if (lista.length > opt.top) console.log(`\n… y ${lista.length - opt.top} grupos más (usa --top).`);
}
