#!/usr/bin/env node
// Variables de entorno: compara las que usa el código con las que están declaradas
// (.env.example y manifiestos de despliegue) y marca las nuevas que faltan.
// Sin dependencias. Node 18 o más nuevo. Solo lee archivos y corre git en modo lectura.
//
//   node variables.mjs [carpeta] [--desde <ref-de-git>] [--json] [--estricto]
//
//   carpeta        raíz del proyecto (por defecto la carpeta actual)
//   --desde REF    marca como "nueva" cada variable que aparece en el código después de REF
//                  (tag o commit de lo que hoy está en producción). Incluye cambios sin commit.
//   --json         salida en JSON
//   --estricto     termina con código 1 si alguna variable nueva no está en ningún manifiesto (para CI)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = { raiz: '.', desde: null, json: false };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--desde') opt.desde = args[++i];
  else if (args[i] === '--json') opt.json = true;
  else if (args[i] === '--estricto') continue;
  else opt.raiz = args[i];
}
const raiz = path.resolve(opt.raiz);

const IGNORAR_CARPETAS = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', '.next', '.nuxt', 'coverage', 'tmp', 'log', 'logs',
  'venv', '.venv', 'env', '__pycache__', 'target', 'bin', 'obj', 'public', 'storage', '.terraform']);
const CODIGO = /\.(m?[jt]sx?|cjs|py|rb|php|go|rs|java|kt|cs|ex|exs|erb|vue|svelte|blade\.php)$/i;
// Variables que pone el sistema o la plataforma: no se reportan como faltantes.
const ESTANDAR = new Set(['NODE_ENV', 'PORT', 'HOME', 'PATH', 'PWD', 'CI', 'TZ', 'LANG', 'HOSTNAME', 'USER', 'SHELL', 'TMPDIR', 'TEMP',
  'RAILS_ENV', 'RACK_ENV', 'APP_ENV', 'DJANGO_SETTINGS_MODULE', 'PYTHONPATH', 'GITHUB_ACTIONS', 'VERCEL', 'RENDER', 'FLY_APP_NAME', 'DYNO']);

// Cómo se lee una variable en los lenguajes más comunes.
const USOS = [
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  /process\.env\[\s*['"`]([A-Z_][A-Z0-9_]*)['"`]\s*\]/g,
  /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
  /(?:Deno\.env\.get|Bun\.env\.get)\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  /\bENV(?:\.fetch\(\s*|\[\s*)['"]([A-Z_][A-Z0-9_]*)['"]/g,                     // Ruby
  /os\.environ(?:\.get\(\s*|\[\s*)['"]([A-Z_][A-Z0-9_]*)['"]/g,                 // Python
  /os\.getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  /\benv(?:\.\w+)?\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,                           // Laravel env(), django-environ env.str()
  /\bconfig\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,                                   // python-decouple
  /\bgetenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,                                   // PHP
  /\$_(?:ENV|SERVER)\[\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,
  /os\.(?:Getenv|LookupEnv)\(\s*"([A-Z_][A-Z0-9_]*)"/g,                         // Go
  /env::var\(\s*"([A-Z_][A-Z0-9_]*)"/g,                                         // Rust
  /System\.getenv\(\s*"([A-Z_][A-Z0-9_]*)"/g,                                   // Java/Kotlin
  /GetEnvironmentVariable\(\s*"([A-Z_][A-Z0-9_]*)"/g,                           // C#
  /System\.(?:get_env|fetch_env!?)\(\s*"([A-Z_][A-Z0-9_]*)"/g,                  // Elixir
];

// Archivos donde se declaran las variables.
const EJEMPLOS = /^\.env\.(example|sample|template|dist|defaults)$|^example\.env$|^env\.example$/i;
const MANIFIESTOS = /^(render\.ya?ml|fly\.toml|app\.json|app\.ya?ml|vercel\.json|netlify\.toml|railway\.(json|toml)|serverless\.ya?ml|docker-compose[\w.-]*\.ya?ml|compose[\w.-]*\.ya?ml|Dockerfile[\w.-]*|Procfile|heroku\.yml|\.do\/app\.yaml|values[\w.-]*\.ya?ml|deployment[\w.-]*\.ya?ml|.*\.tf)$/i;

function recorrer(dir, fuera = []) {
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return fuera; }
  for (const e of entradas) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!IGNORAR_CARPETAS.has(e.name)) recorrer(p, fuera); }
    else fuera.push(p);
  }
  return fuera;
}
const rel = p => path.relative(raiz, p).split(path.sep).join('/');

function usosEn(texto) {
  const res = [];
  const lineas = texto.split(/\r?\n/);
  lineas.forEach((l, i) => { for (const re of USOS) { re.lastIndex = 0; let m; while ((m = re.exec(l))) res.push({ nombre: m[1], linea: i + 1 }); } });
  return res;
}

function declaradasEn(archivo, texto) {
  const nombres = new Set();
  const base = path.basename(archivo);
  for (const l of texto.split(/\r?\n/)) {
    let m;
    if (EJEMPLOS.test(base)) { if ((m = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/.exec(l))) nombres.add(m[1]); continue; }
    if ((m = /^\s*-?\s*(?:key|name)\s*:\s*['"]?([A-Z_][A-Z0-9_]*)['"]?\s*$/.exec(l))) nombres.add(m[1]);
    else if ((m = /^\s*-?\s*['"]?([A-Z_][A-Z0-9_]*)['"]?\s*[:=]/.exec(l))) nombres.add(m[1]);
    else if ((m = /^\s*(?:ENV|ARG)\s+([A-Z_][A-Z0-9_]*)/.exec(l))) nombres.add(m[1]);
    const sec = /secrets\.([A-Z_][A-Z0-9_]*)/g; while ((m = sec.exec(l))) nombres.add(m[1]);
    const lista = /"([A-Z_][A-Z0-9_]*)"\s*:/g; while ((m = lista.exec(l))) nombres.add(m[1]);
  }
  return nombres;
}

function git(...a) {
  return execFileSync('git', ['-C', raiz, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

// Variables que aparecen en líneas agregadas desde REF (incluye cambios sin commit y archivos nuevos sin seguir).
function nuevasDesde(ref) {
  const nuevas = new Set();
  const diff = git('diff', '--unified=0', ref, '--');
  for (const l of diff.split(/\r?\n/)) if (l.startsWith('+') && !l.startsWith('+++')) for (const u of usosEn(l.slice(1))) nuevas.add(u.nombre);
  const sinSeguir = git('ls-files', '--others', '--exclude-standard').split(/\r?\n/).filter(Boolean);
  for (const f of sinSeguir) if (CODIGO.test(f)) { try { for (const u of usosEn(fs.readFileSync(path.join(raiz, f), 'utf8'))) nuevas.add(u.nombre); } catch {} }
  // Las que ya se usaban en REF no son nuevas aunque se hayan movido de lugar.
  const antes = new Set();
  for (const f of git('ls-tree', '-r', '--name-only', ref).split(/\r?\n/).filter(f => CODIGO.test(f))) {
    try { for (const u of usosEn(git('show', `${ref}:${f}`))) antes.add(u.nombre); } catch {}
  }
  return new Set([...nuevas].filter(n => !antes.has(n)));
}

const archivos = recorrer(raiz);
const usadas = new Map();
const ejemplo = new Set(), manifiesto = new Map();
for (const f of archivos) {
  const base = path.basename(f), r = rel(f);
  let texto;
  if (CODIGO.test(base) || EJEMPLOS.test(base) || MANIFIESTOS.test(base) || /^\.github\/workflows\//.test(r)) {
    try { texto = fs.readFileSync(f, 'utf8'); } catch { continue; }
  } else continue;
  if (CODIGO.test(base) && !/\.(test|spec)\.|(^|\/)(tests?|spec|__tests__)\//.test(r)) {
    for (const u of usosEn(texto)) { if (!usadas.has(u.nombre)) usadas.set(u.nombre, []); usadas.get(u.nombre).push(`${r}:${u.linea}`); }
  }
  if (EJEMPLOS.test(base)) for (const n of declaradasEn(f, texto)) ejemplo.add(n);
  else if (MANIFIESTOS.test(base) || /^\.github\/workflows\//.test(r)) for (const n of declaradasEn(f, texto)) { if (!manifiesto.has(n)) manifiesto.set(n, []); manifiesto.get(n).push(r); }
}

let nuevas = null;
if (opt.desde) {
  try { nuevas = nuevasDesde(opt.desde); }
  catch { console.error(`Aviso: no pude leer git desde "${opt.desde}". Sigo sin marcar las nuevas.`); }
}

const filas = [...usadas.keys()].sort().map(nombre => {
  const enEjemplo = ejemplo.has(nombre), enManifiesto = manifiesto.has(nombre), estandar = ESTANDAR.has(nombre);
  const nueva = nuevas ? nuevas.has(nombre) : null;
  let estado = 'ok';
  if (!estandar && !enManifiesto) estado = nueva ? 'FALTA (nueva)' : 'sin manifiesto';
  if (!estandar && !enEjemplo && estado === 'ok') estado = 'falta en ejemplo';
  if (estandar) estado = 'de la plataforma';
  return { nombre, nueva, enEjemplo, enManifiesto, manifiestos: manifiesto.get(nombre) || [], usos: usadas.get(nombre), estado };
});
const sinUso = [...new Set([...ejemplo, ...manifiesto.keys()])].filter(n => !usadas.has(n) && !ESTANDAR.has(n)).sort();
const manifiestosVistos = [...new Set([...manifiesto.values()].flat())].sort();

if (opt.json) {
  console.log(JSON.stringify({ raiz, desde: opt.desde, manifiestos: manifiestosVistos, variables: filas, declaradas_sin_uso: sinUso }, null, 2));
} else {
  console.log(`Manifiestos leídos: ${manifiestosVistos.join(', ') || 'ninguno (¿dónde se configuran las variables en producción?)'}`);
  console.log(`Archivo de ejemplo: ${ejemplo.size ? 'sí' : 'no encontrado'}${opt.desde ? `   Comparado contra: ${opt.desde}` : ''}\n`);
  console.log('| Variable | Nueva | En ejemplo | En manifiesto | Estado | Se usa en |');
  console.log('|---|---|---|---|---|---|');
  for (const f of filas) console.log(`| \`${f.nombre}\` | ${f.nueva == null ? '?' : f.nueva ? 'sí' : 'no'} | ${f.enEjemplo ? 'sí' : 'no'} | ${f.enManifiesto ? 'sí' : 'no'} | ${f.estado} | ${f.usos.slice(0, 3).join(', ')}${f.usos.length > 3 ? ` (+${f.usos.length - 3})` : ''} |`);
  if (sinUso.length) console.log(`\nDeclaradas pero sin uso en el código: ${sinUso.join(', ')}`);
}
// Con --estricto (para CI) termina con código 1 si falta alguna variable nueva.
process.exitCode = args.includes('--estricto') && filas.some(f => f.estado === 'FALTA (nueva)') ? 1 : 0;
