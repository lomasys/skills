#!/usr/bin/env node
// Uso de IA: suma los tokens que gastaron los agentes de programación, leyendo sus bitácoras locales.
// Solo lee números (tokens, modelo, fecha, carpeta). Nunca imprime ni manda a ningún lado el texto de las conversaciones.
// Sin dependencias. Node 18 o más nuevo.
//
//   node uso.mjs [--carpeta texto] [--desde 2026-11-01] [--hasta 2026-11-15] [--rama nombre] [--precios precios.json] [--json]
//
// Opciones:
//   --carpeta texto   solo sesiones cuya carpeta de trabajo contiene este texto (por ejemplo el nombre del repo)
//   --desde FECHA     desde esta fecha u hora (ISO: 2026-11-01 o 2026-11-01T09:00)
//   --hasta FECHA     hasta esta fecha (si es solo día, incluye todo ese día)
//   --rama nombre     solo lo trabajado en esa rama de git (si la herramienta la guarda)
//   --dir ruta        carpeta extra de bitácoras .jsonl (se puede repetir)
//   --precios archivo JSON con precios por millón de tokens. Cada modelo DEBE traer "fecha" y "fuente":
//                     {"nombre-del-modelo": {"entrada": 0, "salida": 0, "cache_lectura": 0, "cache_escritura": 0,
//                                            "fecha": "2026-11-16", "fuente": "https://…"}}
//   --json            salida en JSON
//
// Lee por defecto:
//   Claude Code: ~/.claude/projects/**/*.jsonl  (o $CLAUDE_CONFIG_DIR/projects)
//   Codex:       ~/.codex/sessions/**/*.jsonl   (o $CODEX_HOME/sessions)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function opciones(args) {
  const o = { dir: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
    if (k === 'dir') o.dir.push(v); else o[k] = v;
  }
  return o;
}

// Archivos .jsonl de la carpeta. Salta los que no se tocaron desde la fecha "desde" (no pueden tener uso nuevo).
function archivos(dir, desde) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const pila = [dir];
  while (pila.length) {
    const d = pila.pop();
    let lista;
    try { lista = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of lista) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) pila.push(p);
      else if (e.name.endsWith('.jsonl')) {
        try { if (desde && fs.statSync(p).mtimeMs < desde) continue; } catch { continue; }
        out.push(p);
      }
    }
  }
  return out;
}

// Lee por bytes (las bitácoras pueden pesar GB) y solo convierte a JSON las líneas que traen alguna marca.
// El resto (el texto de la conversación) nunca se decodifica ni se analiza.
async function* lineas(archivo, marcas) {
  const bmarcas = marcas.map(m => Buffer.from(m));
  const convertir = b => {
    if (!b.length || !bmarcas.some(m => b.indexOf(m) !== -1)) return null;
    try { return JSON.parse(b.toString('utf8')); } catch { return null; } // línea incompleta
  };
  let resto = [];
  try {
    for await (const trozo of fs.createReadStream(archivo, { highWaterMark: 1 << 20 })) {
      let ini = 0, i;
      while ((i = trozo.indexOf(10, ini)) !== -1) {
        const parte = trozo.subarray(ini, i);
        const o = convertir(resto.length ? Buffer.concat([...resto, parte]) : parte);
        resto = []; ini = i + 1;
        if (o) yield o;
      }
      if (ini < trozo.length) resto.push(trozo.subarray(ini));
    }
    const o = resto.length && convertir(Buffer.concat(resto));
    if (o) yield o;
  } catch { /* archivo ilegible */ }
}

const normalCarpeta = s => String(s || '').replace(/\\/g, '/').toLowerCase();

function fechaLimite(v, fin) {
  if (!v) return null;
  const solodia = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const d = new Date(solodia ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) throw new Error(`fecha inválida: ${v}`);
  if (fin && solodia) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// Cada registro: { herramienta, modelo, sesion, fecha, carpeta, rama, entrada, cache_lectura, cache_escritura, salida }
// "entrada" es entrada SIN cache, para que las cuatro columnas se puedan sumar sin contar dos veces.
async function leerClaude(dir, desde) {
  const regs = [];
  const vistos = new Set();
  for (const f of archivos(dir, desde)) {
    for await (const o of lineas(f, ['"usage":{'])) {
      const m = o.message;
      if (o.type !== 'assistant' || !m || !m.usage) continue;
      const clave = `${m.id || ''}|${o.requestId || ''}`;
      if (m.id && vistos.has(clave)) continue; // un mensaje se guarda en varias líneas con el mismo uso
      vistos.add(clave);
      const u = m.usage;
      regs.push({
        herramienta: 'Claude Code', modelo: m.model || '?', sesion: o.sessionId || f, fecha: o.timestamp,
        carpeta: o.cwd, rama: o.gitBranch,
        entrada: u.input_tokens || 0, cache_lectura: u.cache_read_input_tokens || 0,
        cache_escritura: u.cache_creation_input_tokens || 0, salida: u.output_tokens || 0,
      });
    }
  }
  return regs.filter(r => r.modelo !== '<synthetic>');
}

async function leerCodex(dir, desde) {
  const regs = [];
  for (const f of archivos(dir, desde)) {
    let carpeta = null, rama = null, modelo = '?', sesion = f, previo = null;
    for await (const o of lineas(f, ['"type":"session_meta"', '"type":"turn_context"', '"type":"token_count"'])) {
      const p = o.payload || {};
      if (o.type === 'session_meta') {
        carpeta = p.cwd || carpeta; sesion = p.id || p.session_id || sesion;
        rama = (p.git && (p.git.branch || p.git.current_branch)) || rama;
      } else if (o.type === 'turn_context') {
        modelo = p.model || modelo; carpeta = p.cwd || carpeta;
      } else if (o.type === 'event_msg' && p.type === 'token_count' && p.info && p.info.total_token_usage) {
        const t = p.info.total_token_usage;
        if (previo && t.total_tokens === previo.total_tokens) continue; // aviso repetido
        const ant = previo || {};
        const d = k => Math.max(0, (t[k] || 0) - (ant[k] || 0));
        previo = t;
        const cache = d('cached_input_tokens');
        regs.push({
          herramienta: 'Codex', modelo, sesion, fecha: o.timestamp, carpeta, rama,
          entrada: Math.max(0, d('input_tokens') - cache), cache_lectura: cache,
          cache_escritura: d('cache_write_input_tokens'), salida: d('output_tokens'),
        });
      }
    }
  }
  return regs;
}

async function leerOtros(dir, desde) {
  // Formato desconocido: intenta los dos conocidos.
  return [...await leerClaude(dir, desde), ...await leerCodex(dir, desde)];
}

function cargarPrecios(archivo) {
  if (!archivo) return null;
  const p = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  for (const [modelo, v] of Object.entries(p)) {
    if (!v.fecha || !v.fuente) throw new Error(`el precio de "${modelo}" no trae "fecha" y "fuente". No se usan precios sin fuente.`);
  }
  return p;
}

const CAMPOS = ['entrada', 'cache_lectura', 'cache_escritura', 'salida'];
const n = x => x.toLocaleString('es-MX');
const usd = x => (x >= 1 ? x.toFixed(2) : x.toFixed(4));

async function main() {
  const o = opciones(process.argv.slice(2));
  const casa = os.homedir();
  const claudeDir = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(casa, '.claude'), 'projects');
  const codexDir = path.join(process.env.CODEX_HOME || path.join(casa, '.codex'), 'sessions');
  const desde = fechaLimite(o.desde, false), hasta = fechaLimite(o.hasta, true);
  let regs = [...await leerClaude(claudeDir, desde), ...await leerCodex(codexDir, desde)];
  for (const d of o.dir) regs.push(...await leerOtros(d, desde));
  const leidos = { 'Claude Code': fs.existsSync(claudeDir) ? claudeDir : null, Codex: fs.existsSync(codexDir) ? codexDir : null };

  const carpeta = o.carpeta && normalCarpeta(o.carpeta);
  regs = regs.filter(r => {
    const t = r.fecha ? new Date(r.fecha).getTime() : NaN;
    if (desde && !(t >= desde)) return false;
    if (hasta && !(t < hasta)) return false;
    if (carpeta && !normalCarpeta(r.carpeta).includes(carpeta)) return false;
    if (o.rama && r.rama !== o.rama) return false;
    return true;
  });

  const precios = cargarPrecios(o.precios);
  const grupos = new Map();
  for (const r of regs) {
    const k = `${r.herramienta}|${r.modelo}`;
    if (!grupos.has(k)) grupos.set(k, { herramienta: r.herramienta, modelo: r.modelo, sesiones: new Set(), llamadas: 0, entrada: 0, cache_lectura: 0, cache_escritura: 0, salida: 0 });
    const g = grupos.get(k);
    g.sesiones.add(r.sesion); g.llamadas++;
    for (const c of CAMPOS) g[c] += r[c];
  }
  const filas = [...grupos.values()].map(g => {
    const fila = { ...g, sesiones: g.sesiones.size };
    const p = precios && precios[g.modelo];
    if (p) {
      // Si falta el precio de cache, se cobra como entrada normal: el estimado queda por arriba, nunca por abajo.
      fila.costo = CAMPOS.reduce((s, c) => s + (g[c] * (p[c] ?? p.entrada ?? 0)) / 1e6, 0);
      fila.precio = { fecha: p.fecha, fuente: p.fuente, cache_como_entrada: p.cache_lectura == null || p.cache_escritura == null };
    }
    return fila;
  }).sort((a, b) => (b.entrada + b.cache_lectura + b.cache_escritura + b.salida) - (a.entrada + a.cache_lectura + a.cache_escritura + a.salida));

  const total = CAMPOS.reduce((t, c) => ({ ...t, [c]: filas.reduce((s, f) => s + f[c], 0) }), {});
  const fechas = regs.map(r => r.fecha).filter(Boolean).sort();
  const res = {
    filtros: { carpeta: o.carpeta || null, desde: o.desde || null, hasta: o.hasta || null, rama: o.rama || null },
    bitacoras_leidas: leidos, periodo: fechas.length ? { primera: fechas[0], ultima: fechas[fechas.length - 1] } : null,
    filas, total, costo_total: filas.some(f => f.costo != null) ? filas.reduce((s, f) => s + (f.costo || 0), 0) : null,
    modelos_sin_precio: precios ? filas.filter(f => f.costo == null).map(f => f.modelo) : filas.map(f => f.modelo),
  };

  if (o.json) return console.log(JSON.stringify(res, null, 2));

  console.log(`Bitácoras: Claude Code ${leidos['Claude Code'] ? 'sí' : 'no encontradas'} · Codex ${leidos.Codex ? 'sí' : 'no encontradas'}${o.dir.length ? ' · extra: ' + o.dir.join(', ') : ''}`);
  console.log(`Filtros: ${Object.entries(res.filtros).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' · ') || 'ninguno'}`);
  if (!filas.length) return console.log('\nNo hay uso registrado con esos filtros.');
  console.log(`Periodo con uso: ${res.periodo.primera.slice(0, 16)} → ${res.periodo.ultima.slice(0, 16)}\n`);
  const cab = ['Herramienta', 'Modelo', 'Sesiones', 'Llamadas', 'Entrada', 'Cache leído', 'Cache escrito', 'Salida', 'Costo USD'];
  const datos = filas.map(f => [f.herramienta, f.modelo, f.sesiones, f.llamadas, n(f.entrada), n(f.cache_lectura), n(f.cache_escritura), n(f.salida), f.costo != null ? usd(f.costo) : 'sin precio']);
  datos.push(['TOTAL', '', '', filas.reduce((s, f) => s + f.llamadas, 0), n(total.entrada), n(total.cache_lectura), n(total.cache_escritura), n(total.salida), res.costo_total != null ? usd(res.costo_total) + (res.modelos_sin_precio.length ? ' + modelos sin precio' : '') : 'sin precio']);
  const anchos = cab.map((c, i) => Math.max(c.length, ...datos.map(d => String(d[i]).length)));
  const linea = d => d.map((x, i) => (i < 2 ? String(x).padEnd(anchos[i]) : String(x).padStart(anchos[i]))).join('  ');
  console.log(linea(cab));
  for (const d of datos) console.log(linea(d));
  const conPrecio = filas.filter(f => f.precio);
  if (conPrecio.length) {
    console.log('\nPrecios usados (estimados por millón de tokens):');
    for (const f of conPrecio) console.log(`  ${f.modelo}: fuente ${f.precio.fuente} · consultado ${f.precio.fecha}${f.precio.cache_como_entrada ? ' · sin precio de cache: se cobró como entrada (estimado alto)' : ''}`);
  }
  if (res.modelos_sin_precio.length) console.log(`\nSin precio: ${res.modelos_sin_precio.join(', ')}. Pasa --precios con fecha y fuente para estimar dinero; si tu plan es de cuota fija, reporta tokens.`);
}

try { await main(); } catch (e) { console.error('Error: ' + e.message); process.exitCode = 2; }
