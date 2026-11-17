#!/usr/bin/env node
// Pantallas: herramientas repetibles para revisar interfaces. Sin dependencias. Node 18 o más nuevo.
//
//   node pantallas.mjs contraste <texto> <fondo> [--grande]     Razón de contraste WCAG de un par y un color que sí cumple
//   node pantallas.mjs css <carpeta|archivo>                     Pares color/fondo de las reglas CSS, con su contraste
//   node pantallas.mjs textos <carpeta> [--llaves a.json,b.json] Llaves que faltan, llaves crudas y textos fijos en el código
//   node pantallas.mjs accesibilidad <carpeta|archivo>           Imágenes sin alt, botones sin nombre, campos sin etiqueta, foco…
//
// Agrega --json a cualquier comando para obtener la salida como JSON.
// Colores: #rgb, #rrggbb, #rrggbbaa, rgb()/rgba(), hsl()/hsla() y nombres básicos (white, black…).
import fs from 'node:fs';
import path from 'node:path';

const [, , accion, ...resto] = process.argv;
const args = resto.filter(a => !a.startsWith('--'));
const bandera = n => resto.includes(`--${n}`);
const valor = n => { const i = resto.indexOf(`--${n}`); return i >= 0 ? resto[i + 1] : undefined; };
const JSON_OUT = bandera('json');

// ---------- Colores y contraste (WCAG 2.x) ----------
const NOMBRES = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', lightgray: '#d3d3d3', lightgrey: '#d3d3d3', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', yellow: '#ffff00', orange: '#ffa500', transparent: '#00000000' };

function parsear(c) {
  if (!c) return null;
  c = String(c).trim().toLowerCase();
  if (NOMBRES[c]) c = NOMBRES[c];
  let m = /^#([0-9a-f]{3,8})$/.exec(c);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(x => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(c);
  if (m) {
    const ch = v => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v));
    const al = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: ch(m[1]), g: ch(m[2]), b: ch(m[3]), a: al };
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(c);
  if (m) {
    const { r, g, b } = hslARgb(+m[1], +m[2] / 100, +m[3] / 100);
    const al = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r, g, b, a: al };
  }
  return null;
}

function hslARgb(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}
function rgbAHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
const hex = ({ r, g, b }) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mezclar = (c, fondo) => (c.a >= 1 ? c : { r: c.r * c.a + fondo.r * (1 - c.a), g: c.g * c.a + fondo.g * (1 - c.a), b: c.b * c.a + fondo.b * (1 - c.a), a: 1 });
function luminancia({ r, g, b }) {
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function razon(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
// Nunca redondear hacia arriba: 4.499 no cumple 4.5.
const mostrar = r => (Math.floor(r * 100) / 100).toFixed(2);

// Busca el color más parecido (mismo tono y saturación) que alcance la meta, moviendo solo la luminosidad.
function sugerir(texto, fondo, meta) {
  const hsl = rgbAHsl(texto);
  let mejor = null;
  for (const dir of [-1, 1]) {
    for (let l = hsl.l; l >= 0 && l <= 1; l += dir * 0.005) {
      const c = hslARgb(hsl.h, hsl.s, l);
      const redondo = parsear(hex(c));
      if (razon(redondo, fondo) >= meta) {
        const dist = Math.abs(l - hsl.l);
        if (!mejor || dist < mejor.dist) mejor = { color: hex(redondo), razon: razon(redondo, fondo), dist };
        break;
      }
    }
  }
  return mejor;
}

function evaluar(textoStr, fondoStr, grande = false) {
  const fondo = parsear(fondoStr), texto0 = parsear(textoStr);
  if (!fondo || !texto0) return { error: `no entiendo el color: ${!texto0 ? textoStr : fondoStr}` };
  const fondoSolido = mezclar(fondo, { r: 255, g: 255, b: 255 });
  const texto = mezclar(texto0, fondoSolido);
  const r = razon(texto, fondoSolido);
  const meta = grande ? 3 : 4.5;
  const res = {
    texto: textoStr, fondo: fondoStr, razon: +mostrar(r), meta,
    texto_normal_AA: r >= 4.5, texto_grande_AA: r >= 3, no_texto_AA: r >= 3, texto_normal_AAA: r >= 7, texto_grande_AAA: r >= 4.5,
    cumple: r >= meta,
  };
  if (fondo.a < 1) res.aviso = 'el fondo es transparente; lo mezclé sobre blanco. Revisa el fondo real que queda detrás.';
  if (!res.cumple) {
    res.sugerencia_texto = sugerir(texto, fondoSolido, meta);
    res.sugerencia_fondo = sugerir(fondoSolido, texto, meta);
    for (const s of [res.sugerencia_texto, res.sugerencia_fondo]) if (s) { s.razon = +mostrar(s.razon); delete s.dist; }
  }
  return res;
}

// Si el fondo no viene de la regla (es el de la página), no tiene sentido proponer cambiarlo.
const sinFondoSugerido = (e, supuesto) => { if (supuesto) delete e.sugerencia_fondo; return e; };

function lineaContraste(e) {
  if (e.error) return `  ${e.error}`;
  const ok = v => (v ? 'sí' : 'NO');
  let s = `  ${e.texto} sobre ${e.fondo}: ${e.razon.toFixed(2)}:1  ·  texto normal AA ${ok(e.texto_normal_AA)} · texto grande AA ${ok(e.texto_grande_AA)} · íconos y bordes ${ok(e.no_texto_AA)} · AAA ${ok(e.texto_normal_AAA)}`;
  if (e.sugerencia_texto) s += `\n    Para llegar a ${e.meta}:1 cambia el texto a ${e.sugerencia_texto.color} (${e.sugerencia_texto.razon.toFixed(2)}:1)`;
  if (e.sugerencia_fondo) s += ` o el fondo a ${e.sugerencia_fondo.color} (${e.sugerencia_fondo.razon.toFixed(2)}:1)`;
  if (e.aviso) s += `\n    Aviso: ${e.aviso}`;
  return s;
}

// ---------- Archivos ----------
const IGNORAR = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'coverage', '.next', '.nuxt', '.svelte-kit', 'tmp', 'public/packs', '.dart_tool', 'storage']);
function archivos(raiz, exts) {
  const st = fs.statSync(raiz);
  if (st.isFile()) return [raiz];
  const out = [];
  (function andar(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (IGNORAR.has(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (exts.some(x => e.name.endsWith(x))) out.push(p);
    }
  })(raiz);
  return out;
}
const leer = f => fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const lineaDe = (texto, i) => texto.slice(0, i).split('\n').length;
const rel = p => { const r = path.relative(process.cwd(), p); return !r || r.startsWith('..') || path.isAbsolute(r) ? p : r; };
const MARCADO = ['.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.erb', '.haml', '.slim', '.blade.php', '.php', '.twig', '.njk', '.hbs', '.ejs', '.astro', '.js', '.ts', '.dart', '.cshtml', '.razor'];
const ESTILOS = ['.css', '.scss', '.sass', '.less', '.vue', '.svelte', '.html', '.htm', '.astro'];

// ---------- css: pares color / fondo ----------
function cmdCss(raiz) {
  const lista = archivos(raiz, ESTILOS);
  const vars = {}, reglas = [];
  for (const f of lista) {
    let t = leer(f);
    if (!/\.(css|scss|sass|less)$/.test(f)) {
      // solo bloques <style> y atributos style="" de archivos de marcado
      const bloques = [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
      const inline = [...t.matchAll(/style="([^"]*)"/gi)];
      for (const b of bloques) recolectar(f, t, b[1], b.index + b[0].indexOf(b[1]));
      for (const s of inline) if (/color/.test(s[1])) recolectar(f, t, `[style] {${s[1]}}`, s.index);
      continue;
    }
    recolectar(f, t, t, 0);
  }
  function recolectar(f, todo, css, base) {
    const limpio = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length));
    for (const m of limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim().split('\n').pop().trim();
      const decl = {};
      for (const d of m[2].split(';')) {
        const i = d.indexOf(':'); if (i < 0) continue;
        const k = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).replace(/!important/, '').trim();
        if (k.startsWith('--')) vars[k] ??= v; else decl[k] = v;
      }
      reglas.push({ archivo: f, linea: lineaDe(todo, base + m.index + m[0].indexOf('{')), sel, decl });
    }
  }
  const resolver = v => { for (let n = 0; n < 5 && v && v.includes('var('); n++) v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, k, def) => vars[k] ?? def ?? ''); return v; };
  const colorDe = v => { if (!v) return null; v = resolver(v); const m = /(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black|transparent|gray|grey|silver|red|blue|green)\b)/i.exec(v); return m ? m[1] : null; };
  const fondoDe = d => colorDe(d['background-color']) || colorDe(d.background);
  const fondoBase = reglas.filter(r => /^(html|body|:root)$/.test(r.sel)).map(r => fondoDe(r.decl)).find(Boolean) || '#ffffff';
  const resultados = [];
  for (const r of reglas) {
    const c = colorDe(r.decl.color);
    const borde = colorDe(r.decl['border-color']) || colorDe(r.decl.border) || colorDe(r.decl.outline);
    let fondo = fondoDe(r.decl), supuesto = false;
    if (!c && !borde) continue;
    if (!fondo) {
      // busca la regla de un ancestro probable: el mismo selector sin la última parte (".lista li" → ".lista")
      const padre = r.sel.split(/\s+/).slice(0, -1).join(' ');
      const rp = padre && reglas.find(x => x.sel === padre && fondoDe(x.decl));
      fondo = rp ? fondoDe(rp.decl) : fondoBase; supuesto = !rp;
    }
    const tam = parseFloat(resolver(r.decl['font-size'] || '')) || null;
    const negrita = /bold|[6-9]00/.test(r.decl['font-weight'] || '');
    const grande = tam ? (tam >= 24 || (negrita && tam >= 18.66)) : false;
    if (c) resultados.push({ ...sinFondoSugerido(evaluar(c, fondo, grande), supuesto), archivo: rel(r.archivo), linea: r.linea, selector: r.sel, tipo: 'texto', tamano_px: tam, fondo_supuesto: supuesto });
    if (borde && fondo) resultados.push({ ...sinFondoSugerido(evaluar(borde, fondo, true), supuesto), archivo: rel(r.archivo), linea: r.linea, selector: r.sel, tipo: 'borde', fondo_supuesto: supuesto });
  }
  if (JSON_OUT) return console.log(JSON.stringify({ fondo_base: fondoBase, resultados }, null, 2));
  const malos = resultados.filter(x => !x.cumple && !x.error);
  console.log(`Fondo base supuesto: ${fondoBase}. Revisé ${resultados.length} pares en ${lista.length} archivos; ${malos.length} no cumplen.\n`);
  for (const x of [...malos, ...resultados.filter(x => x.cumple || x.error)]) {
    console.log(`${x.cumple ? 'OK ' : x.error ? '?? ' : 'MAL'} ${x.archivo}:${x.linea}  ${x.selector}  (${x.tipo}${x.tamano_px ? `, ${x.tamano_px}px` : ''}${x.fondo_supuesto ? ', fondo supuesto' : ''})`);
    if (!x.cumple) console.log(lineaContraste(x));
  }
  console.log('\nLos íconos y bordes se miden contra 3:1. "fondo supuesto" = la regla no trae fondo; confírmalo en el navegador.');
}

// ---------- textos: traducciones ----------
function aplanar(obj, pre = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (k.startsWith('@')) continue; // metadatos de ARB (Flutter)
    const llave = pre ? `${pre}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) aplanar(v, llave, out); else out[llave] = String(v ?? '');
  }
  return out;
}
function leerYaml(t) {
  // YAML simple de Rails: llaves anidadas por sangría y valores de una línea.
  const out = {}, pila = [];
  for (const linea of t.split('\n')) {
    if (/^\s*(#|$)/.test(linea)) continue;
    const m = /^(\s*)["']?([\w.-]+)["']?\s*:\s*(.*)$/.exec(linea); if (!m) continue;
    const nivel = m[1].length;
    while (pila.length && pila[pila.length - 1].nivel >= nivel) pila.pop();
    const v = m[3].replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');
    if (v === '' || v === '|' || v === '>') pila.push({ nivel, k: m[2] });
    else out[[...pila.map(p => p.k), m[2]].join('.')] = v;
  }
  return out;
}
function leerPhp(t, pre) {
  const out = {}, pila = [];
  for (const linea of t.split('\n')) {
    let m = /^\s*['"]([^'"]+)['"]\s*=>\s*\[\s*$/.exec(linea);
    if (m) { pila.push(m[1]); continue; }
    if (/^\s*\]\s*,?\s*$/.test(linea) && pila.length) { pila.pop(); continue; }
    m = /^\s*['"]([^'"]+)['"]\s*=>\s*(['"])(.*)\2\s*,?\s*$/.exec(linea);
    if (m) out[[pre, ...pila, m[1]].filter(Boolean).join('.')] = m[3];
  }
  return out;
}
function leerPo(t) {
  const out = {};
  for (const m of t.matchAll(/msgid\s+"((?:[^"\\]|\\.)*)"\s*\nmsgstr\s+"((?:[^"\\]|\\.)*)"/g)) if (m[1]) out[m[1]] = m[2];
  return out;
}
const IDIOMA = /^(?:[a-z]{2,3}(?:[-_][A-Za-z]{2,4})?)$/;
function idiomaDe(f) {
  // es.json, es-MX.json, app_es.arb, messages.es.json, django.po dentro de es/LC_MESSAGES, lang/es/auth.php, locales/es/comun.json
  const base = path.basename(f).replace(/\.(json|ya?ml|arb|php|po)$/, '');
  const m = /(?:^|[._-])([a-z]{2,3}(?:[-_](?:[A-Z]{2}|[A-Z][a-z]{3}))?)$/.exec(base);
  if (m) return m[1];
  for (const d of [path.dirname(f), path.dirname(path.dirname(f))]) {
    const n = path.basename(d);
    if (/^[a-z]{2,3}(?:[-_](?:[A-Z]{2}|[A-Z][a-z]{3}))?$/.test(n)) return n;
  }
  return null;
}function buscarLlaves(raiz) {
  return archivos(raiz, ['.json', '.yml', '.yaml', '.arb', '.php', '.po']).filter(f => {
    const p = '/' + f.replace(/\\/g, '/');
    if (f.endsWith('.arb') || f.endsWith('.po')) return true;
    if (/package(-lock)?\.json|tsconfig|composer\.json|\.config\./.test(p)) return false;
    return /\/(locales?|i18n|lang|langs|translations?|l10n|messages)\//i.test(p) && idiomaDe(f);
  });
}
function cargarIdiomas(lista) {
  const idiomas = {};
  for (const f of lista) {
    const t = leer(f), id = idiomaDe(f) || path.basename(f);
    let llaves = {};
    try {
      if (/\.(json|arb)$/.test(f)) llaves = aplanar(JSON.parse(t));
      else if (/\.ya?ml$/.test(f)) { llaves = leerYaml(t); const pre = Object.keys(llaves)[0]?.split('.')[0]; if (pre === id) llaves = Object.fromEntries(Object.entries(llaves).map(([k, v]) => [k.slice(pre.length + 1), v])); }
      else if (f.endsWith('.php')) llaves = leerPhp(t, path.basename(f, '.php'));
      else if (f.endsWith('.po')) llaves = leerPo(t);
    } catch (e) { console.error(`No pude leer ${rel(f)}: ${e.message}`); continue; }
    // i18next con espacios de nombres: locales/es/comun.json → "comun:llave"
    const ns = /\.json$/.test(f) && path.basename(path.dirname(f)) === id ? path.basename(f, '.json') : null;
    idiomas[id] ??= { archivos: [], llaves: {}, ns: [] };
    idiomas[id].archivos.push(rel(f));
    if (ns) idiomas[id].ns.push(ns);
    for (const [k, v] of Object.entries(llaves)) { idiomas[id].llaves[k] = v; if (ns) idiomas[id].llaves[`${ns}:${k}`] = v; }
  }
  return idiomas;
}
const PAL_EN = /\b(the|and|your|you|please|loading|save|cancel|delete|search|settings|not|yet|error|failed|submit|sign in|log in|no data|welcome|order|customer)\b/i;
const PAL_ES = /\b(el|la|los|las|de|del|para|tu|usted|guardar|cancelar|borrar|buscar|cargando|todavía|aún|no hay|bienvenid[oa]|cliente|pedido)\b/i;
const TECNICO = /(undefined|null\b|NaN|\[object Object\]|Exception|stack|ECONN\w*|\b[45]\d\d\b|\berror:|fetch|timeout|payload|forbidden|unauthorized|Internal Server Error|Not implemented)/i;
const adivinarIdioma = s => { const en = (s.match(new RegExp(PAL_EN, 'gi')) || []).length, es = (s.match(new RegExp(PAL_ES, 'gi')) || []).length + (/[áéíóúñ¿¡]/i.test(s) ? 2 : 0); return en > es ? 'en' : es > en ? 'es' : null; };

const USOS = [
  /(?<![\w.])(?:\$?t|i18n\.t|\$i18n\.t|translate|__|trans|trans_choice|_t|tr|gettext|lang|I18n\.t|intl\.formatMessage)\(\s*(['"`])([^'"`]+?)\1/g,
  /data-(?:t|i18n|translate|l10n-id)\s*=\s*["']([^"']+)["']/g,
  /(['"])([\w.:-]+)\1\s*\|\s*(?:translate|t|i18n)\b/g, // Angular / Vue filtros
  /@lang\(\s*['"]([^'"]+)['"]/g,
  /\{%\s*trans\s+['"]([^'"]+)['"]/g,
  /AppLocalizations\.of\([^)]*\)!?\.(\w+)/g,
  /\bS\.of\([^)]*\)\.(\w+)/g,
  /\bl10n\.(\w+)/g,
];
// Íconos por ligadura (Material): su texto ("delete", "close") no es texto para el usuario.
const ICONOS = /<(mat-icon|i|span)\b[^>]*(?:mat-icon|material-icons|material-symbols|class=["'][^"']*\bicon)[^>]*>[^<]*<\/\1>|<mat-icon\b[^>]*>[^<]*<\/mat-icon>/gi;

function cmdTextos(raiz) {
  const listaLlaves = valor('llaves') ? valor('llaves').split(',').map(s => s.trim()) : buscarLlaves(raiz);
  const idiomas = cargarIdiomas(listaLlaves);
  const nombres = Object.keys(idiomas);
  const todas = new Set(nombres.flatMap(i => Object.keys(idiomas[i].llaves).filter(k => !k.includes(':'))));
  const hallazgos = { idiomas: nombres.map(i => ({ idioma: i, archivos: idiomas[i].archivos, llaves: Object.keys(idiomas[i].llaves).filter(k => !k.includes(':')).length })), faltan_en_idioma: [], usadas_sin_traduccion: [], valores_sospechosos: [], textos_fijos: [] };

  for (const k of todas) {
    const faltan = nombres.filter(i => !(k in idiomas[i].llaves));
    if (faltan.length) hallazgos.faltan_en_idioma.push({ llave: k, falta_en: faltan, existe_en: nombres.filter(i => !faltan.includes(i)) });
  }
  for (const i of nombres) for (const [k, v] of Object.entries(idiomas[i].llaves)) {
    if (k.includes(':')) continue;
    const motivos = [];
    if (!v.trim()) motivos.push('vacío');
    if (v === k || v === k.split('.').pop()) motivos.push('el valor es la misma llave');
    const adiv = adivinarIdioma(v);
    if (adiv && i.slice(0, 2) !== adiv && ['es', 'en'].includes(i.slice(0, 2))) motivos.push(`parece estar en "${adiv}"`);
    if (TECNICO.test(v)) motivos.push('frase técnica');
    if (motivos.length) hallazgos.valores_sospechosos.push({ idioma: i, llave: k, valor: v, motivos });
  }

  const codigo = archivos(raiz, MARCADO).filter(f => !listaLlaves.some(l => path.resolve(l) === path.resolve(f)));
  for (const f of codigo) {
    const t = leer(f);
    const sinComentarios = t.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, m => ' '.repeat(m.length)).replace(/\{\{!--[\s\S]*?--\}\}|\{#[\s\S]*?#\}/g, m => m.replace(/[^\n]/g, ' '));
    // llaves usadas
    if (nombres.length) for (const re of USOS) for (const m of sinComentarios.matchAll(re)) {
      const llave = m[m.length - 1];
      if (!llave || /\s/.test(llave) || llave.startsWith('.') || /\$\{/.test(llave) || !/[.:_]/.test(llave) && !/AppLocalizations|S\.of|l10n/.test(m[0])) continue;
      const faltan = nombres.filter(i => !(llave in idiomas[i].llaves));
      if (faltan.length) hallazgos.usadas_sin_traduccion.push({ archivo: rel(f), linea: lineaDe(t, m.index), llave, falta_en: faltan, se_vera: faltan.length === nombres.length ? 'la llave cruda en todos los idiomas' : `la llave cruda en ${faltan.join(', ')}` });
    }
    // textos fijos
    const esJs = /\.(js|ts)$/.test(f) && !/\.(jsx|tsx)$/.test(f);
    const esDart = f.endsWith('.dart');
    const candidatos = [];
    let fuente = sinComentarios.replace(/<style[\s\S]*?<\/style>/gi, m => m.replace(/[^\n]/g, ' ')).replace(ICONOS, m => m.replace(/[^\n]/g, ' '));
    if (!esJs && !esDart) fuente = fuente.replace(/<script[\s\S]*?<\/script>/gi, m => m.replace(/[^\n]/g, ' '));
    if (!esDart) {
      for (const m of fuente.matchAll(/>([^<>]*?)</g)) {
        const crudo = m[1];
        const limpio = crudo.replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|<%[\s\S]*?%>|@\{[\s\S]*?\}|\$\{[^}]*\}|\{[^{}]*\}|&[a-z]+;|&#\d+;/gi, ' ').trim();
        if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}/.test(limpio)) continue;
        if (/&&|\|\||[=;(){}[\]]|=>/.test(crudo.replace(/\$\{[^}]*\}/g, ''))) continue; // probablemente código, no texto
        candidatos.push({ i: m.index + 1, texto: limpio, donde: 'contenido' });
      }
      for (const m of fuente.matchAll(/\b(placeholder|title|alt|aria-label|label|value|tooltip)\s*=\s*(["'])([^"'{}]*[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}[^"'{}]*)\2/g)) {
        if (m[1] === 'value' && !/type=["'](submit|button)/.test(fuente.slice(Math.max(0, m.index - 80), m.index + 80))) continue;
        candidatos.push({ i: m.index, texto: m[3].trim(), donde: m[1] });
      }
    }
    if (esJs || /\.(jsx|tsx|vue|svelte)$/.test(f)) {
      for (const m of fuente.matchAll(/\b(textContent|innerText|placeholder|title|ariaLabel)\s*=\s*([^;\n]+)/g)) for (const s of m[2].matchAll(/(['"`])((?:(?!\1).)*[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}(?:(?!\1).)*)\1/g)) if (!/^[a-z][\w-]*(\.[\w-]+)+$/i.test(s[2])) candidatos.push({ i: m.index, texto: s[2], donde: m[1] });
      for (const m of fuente.matchAll(/\b(alert|confirm|prompt|toast(?:\.\w+)?|notify|message\.\w+)\(\s*(['"`])([^'"`]*[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}[^'"`]*)\2/g)) candidatos.push({ i: m.index, texto: m[3], donde: m[1] });
    }
    if (esDart) {
      for (const m of fuente.matchAll(/\b(Text|Tooltip|SnackBar|tooltip:|hintText:|labelText:|helperText:|errorText:|semanticLabel:|message:)\s*\(?\s*(['"])([^'"]*[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}[^'"]*)\2/g)) candidatos.push({ i: m.index, texto: m[3], donde: m[1].replace(/[:(]/, '') });
    }
    const vistos = new Set();
    for (const c of candidatos) {
      const linea = lineaDe(t, c.i), clave = `${linea}|${c.texto}`;
      if (vistos.has(clave) || c.texto.length > 160) continue; vistos.add(clave);
      const motivos = [];
      if (TECNICO.test(c.texto)) motivos.push('frase técnica');
      const adiv = adivinarIdioma(c.texto); if (adiv) motivos.push(`idioma: ${adiv}`);
      hallazgos.textos_fijos.push({ archivo: rel(f), linea, donde: c.donde, texto: c.texto, motivos });
    }
  }

  if (JSON_OUT) return console.log(JSON.stringify(hallazgos, null, 2));
  console.log(nombres.length ? `Idiomas: ${hallazgos.idiomas.map(i => `${i.idioma} (${i.llaves} llaves: ${i.archivos.join(', ')})`).join(' · ')}` : 'No encontré archivos de traducción. Usa --llaves ruta1,ruta2 si existen.');
  const sec = (titulo, lista, f) => { console.log(`\n${titulo}: ${lista.length}`); for (const x of lista) console.log('  ' + f(x)); };
  sec('Llaves usadas en el código que no existen (se ve la llave cruda)', hallazgos.usadas_sin_traduccion, x => `${x.archivo}:${x.linea}  "${x.llave}"  falta en: ${x.falta_en.join(', ')}`);
  sec('Llaves que existen en un idioma y faltan en otro', hallazgos.faltan_en_idioma, x => `"${x.llave}"  falta en: ${x.falta_en.join(', ')}  (existe en: ${x.existe_en.join(', ')})`);
  sec('Valores sospechosos en los archivos de traducción', hallazgos.valores_sospechosos, x => `[${x.idioma}] "${x.llave}" = "${x.valor}"  → ${x.motivos.join(', ')}`);
  sec('Textos escritos directo en el código (candidatos: confírmalos)', hallazgos.textos_fijos, x => `${x.archivo}:${x.linea}  [${x.donde}] "${x.texto}"${x.motivos.length ? '  → ' + x.motivos.join(', ') : ''}`);
}

// ---------- accesibilidad: revisión del marcado ----------
function cmdAccesibilidad(raiz) {
  const lista = archivos(raiz, [...MARCADO, '.css', '.scss', '.sass', '.less']);
  const h = [];
  const add = (f, t, i, tipo, msg, wcag) => h.push({ archivo: rel(f), linea: lineaDe(t, i), tipo, mensaje: msg, wcag });
  const hayFocusVisible = lista.some(f => /:focus-visible|focus-visible:|focus:ring|focus:outline|focus:border/.test(leer(f)));
  for (const f of lista) {
    const t = leer(f);
    const s = t.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
    if (/\.(css|scss|sass|less|vue|svelte|html|htm)$/.test(f)) {
      for (const m of s.matchAll(/([^{}]*)\{[^{}]*outline\s*:\s*(none|0)\b[^{}]*\}/g)) if (/:focus(?!-visible)/.test(m[1]) || !hayFocusVisible) add(f, t, m.index + m[0].indexOf('outline'), 'foco', `"${m[1].trim().split('\n').pop()}" quita el contorno de foco${hayFocusVisible ? '' : ' y el proyecto no tiene ningún estilo :focus-visible'}`, '2.4.7');
      for (const m of s.matchAll(/([^{}]*(?:btn|button|boton|icon|icono|close|cerrar|toggle|chip|tab)[^{}]*)\{([^{}]*)\}/gi)) {
        const w = /(?:^|;|\s)(?:min-)?width\s*:\s*(\d+(?:\.\d+)?)px/.exec(m[2]), hh = /(?:^|;|\s)(?:min-)?height\s*:\s*(\d+(?:\.\d+)?)px/.exec(m[2]);
        const pad = /padding\s*:\s*0\b/.test(m[2]) || !/padding/.test(m[2]);
        if (w && hh && pad && (+w[1] < 24 || +hh[1] < 24)) add(f, t, m.index + m[0].indexOf('{'), 'tamaño', `"${m[1].trim().split('\n').pop()}" mide ${w[1]}×${hh[1]} px; el mínimo es 24×24 (44×44 recomendado en móvil)`, '2.5.8');
      }
    }
    if (/\.(css|scss|sass|less)$/.test(f)) continue;
    if (/<html(?![^>]*\blang=)[^>]*>/i.test(s)) add(f, t, s.search(/<html/i), 'idioma', '<html> no dice en qué idioma está la página (lang="es"); el lector de pantalla la leerá con la voz equivocada', '3.1.1');
    for (const m of s.matchAll(/<img\b(?![^>]*(?:\salt\s*=|:alt=|\[alt\]|alt=\{|v-bind:alt))[^>]*>/gi)) add(f, t, m.index, 'imagen', `imagen sin alt: ${m[0].slice(0, 70)}`, '1.1.1');
    for (const m of s.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      if (/aria-label|aria-labelledby|\btitle=|v-tooltip|matTooltip|data-(?:t|i18n|translate|l10n-id)=|v-t=|v-html|dangerouslySetInnerHTML|\[innerHTML\]|translate/i.test(m[2])) continue;
      const dentro = m[3].replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(ICONOS, '').replace(/<img\b[^>]*alt=["']([^"']+)["'][^>]*>/gi, ' $1 ').replace(/<[^>]+>/g, '');
      if (/\{|\$|@|<%|t\(/.test(dentro)) continue; // contenido dinámico: no se puede saber
      if (!/[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ]{2,}/.test(dentro)) add(f, t, m.index, 'nombre', `<${m[1]}> sin texto ni aria-label (${dentro.trim() ? `solo el símbolo "${dentro.trim()}"` : 'solo un ícono'}): el lector de pantalla no dice qué hace`, '4.1.2');
    }
    for (const m of s.matchAll(/<(div|span|li|img|td|tr|p|i|svg)\b([^>]*\s(?:onclick|onClick|@click|v-on:click|\(click\)|on:click|ng-click)\s*=[^>]*)>/g)) {
      if (/\brole=|tabindex=/i.test(m[2])) continue;
      add(f, t, m.index, 'teclado', `<${m[1]}> con clic pero sin role ni tabindex: no se puede usar con teclado. Usa <button>`, '2.1.1');
    }
    for (const m of s.matchAll(/tabindex\s*=\s*["'{]?\s*([1-9]\d*)/gi)) add(f, t, m.index, 'orden', `tabindex=${m[1]} cambia el orden natural del teclado`, '2.4.3');
    const ids = new Set([...s.matchAll(/(?:for|htmlFor)\s*=\s*["'{]?([\w-]+)/g)].map(m => m[1]));
    for (const m of s.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
      if (/type=["'](hidden|submit|button|reset|image)/i.test(m[2]) || /aria-label|aria-labelledby/i.test(m[2])) continue;
      const id = (/\bid=["']([\w-]+)/.exec(m[2]) || [])[1];
      if (id && ids.has(id)) continue;
      const antes = s.slice(0, m.index);
      if (antes.lastIndexOf('<label') > antes.lastIndexOf('</label>')) continue; // está dentro de un <label>
      const ph = (/placeholder=["']([^"']*)/.exec(m[2]) || [])[1];
      add(f, t, m.index, 'etiqueta', `<${m[1]}${id ? ` id="${id}"` : ''}> sin etiqueta ligada${ph ? ` (solo placeholder "${ph}", que desaparece al escribir)` : ''}`, '3.3.2 · 4.1.2');
    }
    for (const m of s.matchAll(/<label\b(?![^>]*\b(?:for|htmlFor)=)[^>]*>([^<]*)<\/label>\s*<(input|select|textarea)\b(?![^>]*aria-label)/gi)) add(f, t, m.index, 'etiqueta', `<label>${m[1].trim()}</label> no está ligado a su campo (falta for="...")`, '1.3.1');
    if (f.endsWith('.dart')) {
      for (const m of s.matchAll(/IconButton\((?![\s\S]{0,300}?tooltip:)[\s\S]{0,300}?\)/g)) add(f, t, m.index, 'nombre', 'IconButton sin tooltip: TalkBack y VoiceOver no saben qué hace', '4.1.2');
      for (const m of s.matchAll(/(GestureDetector|InkWell)\(/g)) add(f, t, m.index, 'teclado', `${m[1]}: confirma que tiene Semantics(button: true) y un nombre`, '4.1.2');
      for (const m of s.matchAll(/Image\.(asset|network)\((?![^)]*semanticLabel)[^)]*\)/g)) add(f, t, m.index, 'imagen', 'Image sin semanticLabel (o excludeFromSemantics si es decorativa)', '1.1.1');
    }
  }
  if (JSON_OUT) return console.log(JSON.stringify(h, null, 2));
  console.log(`Revisé ${lista.length} archivos: ${h.length} avisos. Son candidatos del código; confirma los importantes en el navegador.\n`);
  for (const x of h.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.archivo.localeCompare(b.archivo) || a.linea - b.linea)) console.log(`${x.archivo}:${x.linea}  [${x.tipo}] ${x.mensaje}  (WCAG ${x.wcag})`);
}

try {
  if (accion === 'contraste') {
    if (args.length < 2) throw new Error('uso: contraste <color-texto> <color-fondo> [--grande]');
    const e = evaluar(args[0], args[1], bandera('grande'));
    if (JSON_OUT) console.log(JSON.stringify(e, null, 2)); else console.log(lineaContraste(e).trimStart());
    process.exitCode = e.error ? 2 : e.cumple ? 0 : 1;
  } else if (accion === 'css') cmdCss(args[0] || '.');
  else if (accion === 'textos') cmdTextos(args[0] || '.');
  else if (accion === 'accesibilidad') cmdAccesibilidad(args[0] || '.');
  else console.log('Uso: node pantallas.mjs contraste|css|textos|accesibilidad …  (ver el inicio de este archivo)');
} catch (e) {
  console.error('Error: ' + e.message);
  process.exitCode = 2;
}
