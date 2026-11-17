#!/usr/bin/env node
// Revisa archivos de migración y marca las operaciones riesgosas. Solo lee archivos: nunca se conecta a una base.
// Sin dependencias. Node 18 o más nuevo.
//
//   node revisar.mjs <archivo-o-carpeta>... [--codigo <carpeta>] [--motor postgres|mysql] [--json]
//
//   --codigo src     busca en ese código las columnas que se borran, renombran o cambian de tipo
//   --motor mysql    ajusta los consejos para MySQL (por defecto: postgres)
//   --json           salida en JSON
//
// Entiende SQL (Postgres, MySQL, Prisma, Flyway, Liquibase SQL), Rails, Django, Laravel y Knex.
// Termina con código 1 si encuentra algo 🔴 o 🟠, para usarlo en CI.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = { codigo: null, motor: 'postgres', json: false, rutas: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--codigo') opt.codigo = args[++i];
  else if (a === '--motor') opt.motor = (args[++i] || '').toLowerCase();
  else if (a === '--json') opt.json = true;
  else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).join('\n').replace(/^\/\/ ?/gm, '')); process.exit(0); }
  else opt.rutas.push(a);
}
if (!opt.rutas.length) { console.error('Uso: node revisar.mjs <archivo-o-carpeta>... [--codigo src] [--motor postgres|mysql] [--json]'); process.exit(2); }
const mysql = opt.motor === 'mysql' || opt.motor === 'mariadb';

const EXT_MIG = /\.(sql|rb|py|php|js|ts|mjs|cjs)$/i;
function archivos(ruta) {
  if (!fs.existsSync(ruta)) { console.error(`No existe: ${ruta}`); process.exit(2); }
  const st = fs.statSync(ruta);
  if (st.isFile()) return [ruta];
  return fs.readdirSync(ruta, { withFileTypes: true })
    .flatMap(d => d.isDirectory() ? archivos(path.join(ruta, d.name)) : EXT_MIG.test(d.name) ? [path.join(ruta, d.name)] : [])
    .sort();
}

// Gravedad: 🔴 pierde datos o tumba la app · 🟠 bloquea una tabla grande · 🟡 depende del tamaño o la versión · ⚪ revisar a mano
// Cada regla: id, patrón, gravedad, qué pasa, qué hacer. `col` dice qué grupo del patrón es la columna (para buscarla en el código).
const R = (id, re, grav, riesgo, arreglo, col) => ({ id, re, grav, riesgo, arreglo, col });
const idx = mysql
  ? 'MySQL 5.6+ crea índices en línea: agrega `ALGORITHM=INPLACE, LOCK=NONE` para que falle en vez de bloquear. En tablas enormes usa gh-ost o pt-online-schema-change'
  : 'Usa `CREATE INDEX CONCURRENTLY`, fuera de una transacción (un archivo solo para él). Si la columna tiene pocos valores (estado, booleano), mejor un índice parcial con `WHERE`';
const REGLAS = [
  // --- SQL ---
  R('borra-columna', /DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?[`"]?(\w+)/i, '🔴', 'Borra la columna y sus datos. El código que todavía la lea o escriba falla, incluido el código viejo que sigue corriendo durante el despliegue', 'Primero un despliegue que deja de usarla (en Rails: `ignored_columns`); la borras en un despliegue posterior, con respaldo probado', 1),
  R('borra-tabla', /DROP\s+TABLE/i, '🔴', 'Borra la tabla y sus datos. No se puede deshacer sin respaldo', 'Confirma que nada la usa; renómbrala o respáldala antes; bórrala en un despliegue aparte'),
  R('vacia-tabla', /\bTRUNCATE\b/i, '🔴', 'Borra todos los registros de la tabla', 'Nunca en una migración. Si de verdad se necesita, que sea un paso manual aprobado'),
  R('renombra-columna', /RENAME\s+COLUMN\s+[`"]?(\w+)[`"]?\s+TO/i, '🔴', 'El código viejo sigue usando el nombre anterior y falla durante el despliegue', 'Columna nueva → escribir en las dos → copiar en lotes → leer de la nueva → dejar la vieja → borrarla (ver sin-caida.md)', 1),
  R('renombra-columna', /CHANGE\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?\s+[`"]?(?!\1\b)\w+[`"]?\s+\w+/i, '🔴', 'En MySQL, CHANGE con otro nombre renombra la columna: el código viejo falla', 'Igual que renombrar: columna nueva y copia en pasos', 1),
  R('renombra-tabla', /(?:ALTER\s+TABLE\s+\S+\s+RENAME\s+TO|RENAME\s+TABLE)/i, '🔴', 'El código viejo sigue usando el nombre anterior y falla', 'Tabla nueva o vista con el nombre viejo mientras dura la transición'),
  R('cambia-tipo', mysql ? /MODIFY\s+(?:COLUMN\s+)?[`"]?(\w+)/i : /ALTER\s+COLUMN\s+[`"]?(\w+)[`"]?\s+(?:SET\s+DATA\s+)?TYPE/i, '🟠', 'Reescribe la tabla completa con un candado que bloquea lecturas y escrituras. Si el tipo nuevo es más chico o el `USING` convierte mal, pierde datos (decimales, texto largo, zona horaria)', 'Columna nueva con el tipo correcto → copiar en lotes → cambiar el código → borrar la vieja. Comprueba la conversión con un SELECT antes', 1),
  R('conversion-con-perdida', /USING\s+[^;]*::\s*(?:integer|int[248]?|smallint|bigint|date|varchar\(\d+\)|char\(\d+\))/i, '🔴', 'La conversión puede redondear, cortar o tirar datos (decimales, horas, texto). Un comentario como "en centavos" no multiplica por 100', 'Cuenta con un SELECT de solo lectura cuántas filas cambian de valor (`WHERE col <> col::tipo`) y escribe la conversión explícita'),
  R('indice-bloqueante', mysql ? /CREATE\s+(?:UNIQUE\s+)?INDEX(?![^;]*ALGORITHM\s*=\s*INPLACE)/i : /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY)/i, mysql ? '🟡' : '🟠', mysql ? 'Puede copiar la tabla si MySQL no logra hacerlo en línea' : 'Bloquea las escrituras de la tabla mientras se construye el índice (minutos u horas en tablas grandes)', idx),
  R('indice-bloqueante', /ADD\s+(?:UNIQUE\s+)?(?:INDEX|KEY)\b(?![^;]*ALGORITHM\s*=\s*INPLACE)/i, '🟡', 'Agrega un índice dentro de ALTER TABLE; según el motor puede bloquear o copiar la tabla', idx),
  R('borra-indice', mysql ? /\bDROP\s+INDEX\b(?![^;]*LOCK\s*=\s*NONE)/i : /DROP\s+INDEX\s+(?!CONCURRENTLY)/i, '🟡', 'Toma un candado exclusivo sobre la tabla un momento; si hay consultas largas, hace fila y detiene todo lo demás', mysql ? 'Agrega `ALGORITHM=INPLACE, LOCK=NONE`' : 'Usa `DROP INDEX CONCURRENTLY`'),
  R('llave-foranea', /FOREIGN\s+KEY(?![^;]*NOT\s+VALID)/i, mysql ? '🟡' : '🟠', 'Revisa todas las filas mientras bloquea escrituras en las dos tablas; si hay huérfanos, la migración falla a la mitad', mysql ? 'Busca huérfanos antes (modo huerfanos). En tablas grandes usa una herramienta en línea' : 'Agrégala con `NOT VALID` y en otra migración `VALIDATE CONSTRAINT`'),
  R('check', /ADD\s+(?:CONSTRAINT\s+\S+\s+)?CHECK(?![^;]*NOT\s+VALID)/i, mysql ? '🟡' : '🟠', 'Revisa todas las filas con la tabla bloqueada; si alguna no cumple, la migración falla', mysql ? 'Cuenta antes cuántas filas no cumplen' : '`NOT VALID` y después `VALIDATE CONSTRAINT`'),
  R('unico', /ADD\s+(?:CONSTRAINT\s+\S+\s+)?UNIQUE\b(?![^;]*USING\s+INDEX)/i, '🟠', 'Construye un índice único con la tabla bloqueada; si hay repetidos, falla', mysql ? 'Busca repetidos antes; usa ALGORITHM=INPLACE' : 'Crea antes `CREATE UNIQUE INDEX CONCURRENTLY` y luego `ADD CONSTRAINT ... UNIQUE USING INDEX`'),
  R('no-nulo', /ALTER\s+COLUMN\s+[`"]?(\w+)[`"]?\s+SET\s+NOT\s+NULL/i, '🟠', 'Revisa toda la tabla con un candado exclusivo; si hay nulos, falla', 'Postgres 12+: `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE` → `SET NOT NULL` → borrar el CHECK', 1),
  R('columna-obligatoria', /ADD\s+(?:COLUMN\s+)?[`"]?(\w+)[`"]?\s+[^;,]*NOT\s+NULL(?![^;,]*DEFAULT)/i, '🟠', 'Columna obligatoria sin valor por defecto: falla si la tabla ya tiene filas, y el código viejo que inserta sin ella también falla', 'Agrégala con DEFAULT o como opcional, llénala en lotes y después hazla obligatoria', 1),
  R('default-volatil', /ADD\s+(?:COLUMN\s+)?[^;]*DEFAULT\s+(?:random\(|gen_random_uuid|uuid_generate|clock_timestamp|uuid\(\)|nextval)/i, '🟠', 'Un valor por defecto que cambia en cada fila obliga a reescribir toda la tabla con candado', 'Agrega la columna sin default, llénala en lotes y luego pon el default'),
  R('default-version-vieja', /ADD\s+(?:COLUMN\s+)?(?![^;]*(?:random\(|gen_random_uuid|uuid_generate|clock_timestamp|nextval))[^;]*\bDEFAULT\b/i, '🟡', mysql ? 'En MySQL antes de 8.0.12 (o sin ALGORITHM=INSTANT) copia la tabla' : 'En Postgres 10 o anterior reescribe la tabla completa. En 11+ es instantáneo', 'Revisa la versión del motor. Si es vieja: agrega sin default, llénala en lotes, pon el default'),
  R('cambia-datos', /^\s*(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO\s+\S+\s+SELECT)\b/im, '🟡', 'Cambia datos dentro de la migración: si son muchas filas, bloquea esas filas y alarga el despliegue. Si es DELETE, no se puede deshacer', 'Hazlo en un trabajo aparte, en lotes de 1 000 a 10 000 filas, con pausa entre lotes'),
  R('candado-total', /\b(?:VACUUM\s+FULL|CLUSTER|LOCK\s+TABLE|OPTIMIZE\s+TABLE)\b/i, '🟠', 'Bloquea la tabla completa mientras trabaja', 'Sácalo de la migración; usa pg_repack o hazlo en una ventana acordada'),
  // --- Rails ---
  R('borra-columna', /remove_column\s*\(?\s*:\w+\s*,\s*:(\w+)/, '🔴', 'Borra la columna y sus datos. Rails guarda la lista de columnas al arrancar: el código viejo falla aunque no la use', 'Primero `self.ignored_columns += ["col"]` en el modelo y despliega; después la migración, envuelta en `safety_assured`', 1),
  R('borra-tabla', /drop_table\s*\(?\s*:/, '🔴', 'Borra la tabla y sus datos', 'Confirma que nada la usa y despliega primero el código sin ella'),
  R('renombra-columna', /rename_column\s*\(?\s*:\w+\s*,\s*:(\w+)/, '🔴', 'El código viejo usa el nombre anterior y falla durante el despliegue', 'Columna nueva y copia en pasos (sin-caida.md)', 1),
  R('renombra-tabla', /rename_table\s*\(?\s*:/, '🔴', 'El código viejo usa el nombre anterior', 'Tabla nueva o vista mientras dura la transición'),
  R('cambia-tipo', /change_column\s*\(?\s*:\w+\s*,\s*:(\w+)/, '🟠', 'Reescribe la tabla con candado; puede perder datos según el tipo nuevo', 'Columna nueva → copiar en lotes → cambiar el código → borrar la vieja', 1),
  R('indice-bloqueante', /add_index\b(?![^\n]*algorithm:\s*:concurrently)/, mysql ? '🟡' : '🟠', 'Bloquea escrituras mientras se construye', mysql ? idx : '`algorithm: :concurrently` y `disable_ddl_transaction!` en la clase'),
  R('indice-bloqueante', /add_reference\b(?![^\n]*index:\s*false)(?![^\n]*algorithm:\s*:concurrently)/, '🟠', 'add_reference crea un índice (y quizá una llave foránea) que bloquea', '`index: {algorithm: :concurrently}` con `disable_ddl_transaction!`, y la llave foránea aparte con `validate: false`'),
  R('llave-foranea', /add_foreign_key\b(?![^\n]*validate:\s*false)/, '🟠', 'Valida toda la tabla con bloqueo', '`validate: false` y en otra migración `validate_foreign_key`'),
  R('check', /add_check_constraint\b(?![^\n]*validate:\s*false)/, '🟠', 'Valida toda la tabla con bloqueo', '`validate: false` y después `validate_check_constraint`'),
  R('no-nulo', /change_column_null\s*\(?\s*:\w+\s*,\s*:(\w+)\s*,\s*false/, '🟠', 'Revisa toda la tabla con candado; falla si hay nulos', 'CHECK `NOT VALID` → validar → `change_column_null` (Postgres 12+)', 1),
  // --- Django ---
  R('borra-columna', /RemoveField\([^)]*name\s*=\s*['"](\w+)['"]/, '🔴', 'Borra la columna y sus datos; el código viejo falla durante el despliegue', 'Primero despliega el modelo sin el campo usando `SeparateDatabaseAndState`; borra la columna después', 1),
  R('borra-tabla', /DeleteModel\(/, '🔴', 'Borra la tabla y sus datos', 'Despliega primero el código sin el modelo'),
  R('renombra-columna', /RenameField\([^)]*old_name\s*=\s*['"](\w+)['"]/, '🔴', 'El código viejo usa el nombre anterior', 'Campo nuevo y copia en pasos', 1),
  R('renombra-tabla', /RenameModel\(/, '🔴', 'Renombra la tabla; el código viejo falla', 'Fija `db_table` para no renombrar en la base'),
  R('cambia-tipo', /AlterField\([^)]*name\s*=\s*['"](\w+)['"]/, '🟠', 'Puede reescribir la tabla o agregar NOT NULL con candado. Mira el SQL con `sqlmigrate`', 'Revisa el SQL real y, si reescribe, usa columna nueva y copia en pasos', 1),
  R('indice-bloqueante', /(?<!Concurrently)\bAddIndex\(/, '🟠', 'Bloquea escrituras mientras se construye', '`AddIndexConcurrently` (django.contrib.postgres) con `atomic = False` en la migración'),
  R('check', /AddConstraint\(/, '🟠', 'Valida toda la tabla con bloqueo (UNIQUE construye índice; CHECK revisa filas)', 'CHECK: `AddConstraintNotValid` + `ValidateConstraint` (Django 4.0+). UNIQUE: `RunSQL` con `CREATE UNIQUE INDEX CONCURRENTLY` y `atomic = False`'),
  R('cambia-datos', /RunPython\(/, '🟡', 'Cambia datos dentro de la migración', 'En lotes, en una migración aparte con `atomic = False`; confirma que tiene función de reversa'),
  R('revisar-sql', /RunSQL\(/, '⚪', 'SQL escrito a mano', 'Revísalo con las reglas de SQL'),
  // --- Laravel ---
  R('borra-columna', /dropColumn\(\s*\[?\s*['"](\w+)['"]/, '🔴', 'Borra la columna y sus datos; el código viejo falla', 'Primero despliega el código sin la columna; bórrala después', 1),
  R('borra-tabla', /Schema::(?:drop|dropIfExists)\(/, '🔴', 'Borra la tabla y sus datos', 'Despliega primero el código que ya no la usa'),
  R('renombra-columna', /renameColumn\(\s*['"](\w+)['"]/, '🔴', 'El código viejo usa el nombre anterior', 'Columna nueva y copia en pasos', 1),
  R('renombra-tabla', /Schema::rename\(/, '🔴', 'El código viejo usa el nombre anterior', 'Tabla nueva o vista mientras dura la transición'),
  R('cambia-tipo', /['"](\w+)['"][^\n]*->change\(\)/, '🟠', 'Puede reescribir la tabla con candado y perder datos', 'Columna nueva → copiar en lotes → borrar la vieja', 1),
  R('indice-bloqueante', /->(?:index|unique|fullText|spatialIndex)\(/, mysql ? '🟡' : '🟠', 'El índice se crea con la tabla bloqueada', mysql ? idx : '`DB::statement("CREATE INDEX CONCURRENTLY ...")` en una migración con `$withinTransaction = false`'),
  R('llave-foranea', /->(?:foreign|constrained)\(/, '🟠', 'Valida toda la tabla con bloqueo', mysql ? 'Busca huérfanos antes' : '`DB::statement` con `NOT VALID` y después `VALIDATE CONSTRAINT`'),
  R('revisar-sql', /DB::(?:statement|unprepared)\(/, '⚪', 'SQL escrito a mano', 'Revísalo con las reglas de SQL'),
  // --- Knex ---
  R('borra-columna', /\.dropColumns?\(\s*['"](\w+)['"]/, '🔴', 'Borra la columna y sus datos; el código viejo falla', 'Primero despliega el código sin la columna; bórrala después', 1),
  R('borra-tabla', /\.dropTable(?:IfExists)?\(/, '🔴', 'Borra la tabla y sus datos', 'Despliega primero el código que ya no la usa'),
  R('renombra-columna', /\.renameColumn\(\s*['"](\w+)['"]/, '🔴', 'El código viejo usa el nombre anterior', 'Columna nueva y copia en pasos', 1),
  R('cambia-tipo', /\(\s*['"](\w+)['"][^\n]*\.alter\(\)/, '🟠', 'Reescribe la tabla con candado; puede perder datos', 'Columna nueva → copiar en lotes → borrar la vieja', 1),
  R('indice-bloqueante', /\.(?:index|unique)\(/, mysql ? '🟡' : '🟠', 'El índice se crea con la tabla bloqueada', mysql ? idx : '`knex.raw("CREATE INDEX CONCURRENTLY ...")` con `exports.config = { transaction: false }`'),
  R('llave-foranea', /\.(?:foreign|references)\(/, '🟠', 'Valida toda la tabla con bloqueo', mysql ? 'Busca huérfanos antes' : '`knex.raw` con `NOT VALID` y después `VALIDATE CONSTRAINT`'),
];

// Avisos por archivo completo
function avisosArchivo(texto, ext) {
  const av = [];
  const enTransaccion = /^\s*BEGIN\b|START\s+TRANSACTION/im.test(texto);
  if (/CONCURRENTLY/i.test(texto) && enTransaccion)
    av.push(['concurrently-en-transaccion', '🔴', '`CONCURRENTLY` no funciona dentro de una transacción: la migración falla', 'Quita BEGIN/COMMIT y deja ese índice solo en su archivo']);
  if (ext === '.rb' && /algorithm:\s*:concurrently/.test(texto) && !/disable_ddl_transaction!/.test(texto))
    av.push(['concurrently-en-transaccion', '🔴', 'Rails corre la migración en una transacción y `concurrently` falla', 'Agrega `disable_ddl_transaction!` a la clase']);
  if (ext === '.py' && /AddIndexConcurrently|CONCURRENTLY/.test(texto) && !/atomic\s*=\s*False/.test(texto))
    av.push(['concurrently-en-transaccion', '🔴', 'Django corre la migración en una transacción y `CONCURRENTLY` falla', 'Agrega `atomic = False` a la clase Migration']);
  if (/\.(js|ts|mjs|cjs)$/.test(ext) && /CONCURRENTLY/i.test(texto) && !/transaction\s*:\s*false/.test(texto))
    av.push(['concurrently-en-transaccion', '🔴', 'Knex corre la migración en una transacción y `CONCURRENTLY` falla', 'Agrega `exports.config = { transaction: false }`']);
  if (ext === '.rb' && /def\s+change\b/.test(texto) && /\b(change_column\s|change_column\(|execute\b|remove_column\s*\(?\s*:\w+\s*,\s*:\w+\s*\)?\s*$)/m.test(texto) && !/def\s+down\b|reversible/.test(texto))
    av.push(['sin-reversa', '🟡', 'Usa operaciones que Rails no sabe deshacer solo dentro de `change`', 'Escribe `up`/`down` o un bloque `reversible`']);
  if (ext === '.py' && /RunPython\(\s*\w+\s*\)/.test(texto))
    av.push(['sin-reversa', '🟡', '`RunPython` sin función de reversa: la migración no se puede deshacer', 'Agrega `reverse_code`']);
  if (ext === '.php' && /function\s+up\b/.test(texto) && !/function\s+down\b/.test(texto))
    av.push(['sin-reversa', '🟡', 'No tiene `down()`: no se puede deshacer', 'Agrega `down()`']);
  if ((ext === '.js' || ext === '.ts' || ext === '.mjs' || ext === '.cjs') && /exports\.up|export\s+(?:async\s+)?function\s+up/.test(texto) && !/exports\.down|function\s+down/.test(texto))
    av.push(['sin-reversa', '🟡', 'No tiene `down`: no se puede deshacer', 'Agrega `down`']);
  if (ext === '.sql' && !mysql && /ALTER\s+TABLE|CREATE\s+INDEX|DROP\s+/i.test(texto) && !/lock_timeout/i.test(texto))
    av.push(['sin-lock-timeout', '🟡', 'Sin `lock_timeout`: si una consulta larga tiene la tabla, la migración hace fila y detiene a todos detrás de ella', "Empieza con `SET lock_timeout = '5s';` y reintenta si falla"]);
  return av;
}

function lineaDe(texto, pos) { return texto.slice(0, pos).split('\n').length; }
function sinComentarios(texto, ext) {
  // Reemplaza comentarios por espacios para conservar posiciones y números de línea.
  const blanco = s => s.replace(/[^\n]/g, ' ');
  if (ext === '.sql') return texto.replace(/--[^\n]*/g, blanco).replace(/\/\*[\s\S]*?\*\//g, blanco);
  if (ext === '.rb' || ext === '.py') return texto.replace(/(^|\s)#[^\n]*/g, blanco);
  return texto.replace(/(^|[^:])\/\/[^\n]*/g, blanco).replace(/\/\*[\s\S]*?\*\//g, blanco);
}

// Búsqueda de columnas en el código
const EXT_COD = /\.(js|jsx|ts|tsx|mjs|cjs|rb|erb|py|php|blade\.php|go|java|kt|cs|vue|svelte|ex|exs|sql|graphql|prisma|html|haml|slim)$/i;
const SALTAR = /(^|[\\/])(node_modules|\.git|vendor|dist|build|coverage|tmp|log|logs|\.next|__pycache__|migrations?|migraciones|migrate)([\\/]|$)/i;
let indiceCodigo = null;
function cargarCodigo(dir) {
  const out = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (SALTAR.test(path.relative(dir, p) || e.name)) continue;
      if (e.isDirectory()) walk(p);
      else if (EXT_COD.test(e.name) && fs.statSync(p).size < 2_000_000) out.push([p, fs.readFileSync(p, 'utf8').split('\n')]);
    }
  };
  walk(dir);
  return out;
}
function usosDe(col) {
  if (!indiceCodigo) return [];
  const re = new RegExp(`\\b${col}\\b`);
  const usos = [];
  for (const [f, lineas] of indiceCodigo) lineas.forEach((l, i) => { if (re.test(l)) usos.push(`${f}:${i + 1}`); });
  return usos;
}

if (opt.codigo) {
  if (!fs.existsSync(opt.codigo)) { console.error(`No existe la carpeta de código: ${opt.codigo}`); process.exit(2); }
  indiceCodigo = cargarCodigo(opt.codigo);
}

const resultado = [];
for (const f of opt.rutas.flatMap(archivos)) {
  const crudo = fs.readFileSync(f, 'utf8');
  const ext = path.extname(f).toLowerCase();
  const texto = sinComentarios(crudo, ext);
  const hallazgos = [];
  const vistos = new Set();
  // SQL: por sentencia; otros lenguajes: por línea (las reglas no cruzan líneas salvo Django, que usa paréntesis).
  const trozos = [];
  if (ext === '.sql') { let pos = 0; for (const s of texto.split(';')) { trozos.push([s, pos]); pos += s.length + 1; } }
  else if (ext === '.py') { const re = /migrations\.\w+\([\s\S]*?\)\s*,?\s*$/gm; let m; while ((m = re.exec(texto))) trozos.push([m[0], m.index]); texto.split('\n').reduce((p, l) => { trozos.push([l, p]); return p + l.length + 1; }, 0); }
  else texto.split('\n').reduce((p, l) => { trozos.push([l, p]); return p + l.length + 1; }, 0);
  for (const [s, pos] of trozos) {
    for (const r of REGLAS) {
      const m = r.re.exec(s);
      if (!m) continue;
      const linea = lineaDe(texto, pos + m.index + (m[0].length - m[0].trimStart().length));
      const clave = `${r.id}:${linea}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const h = { regla: r.id, gravedad: r.grav, linea, texto: crudo.split('\n')[linea - 1].trim().slice(0, 160), riesgo: r.riesgo, arreglo: r.arreglo };
      if (r.col && m[r.col]) {
        h.columna = m[r.col];
        if (indiceCodigo) h.usos = usosDe(h.columna);
      }
      hallazgos.push(h);
    }
  }
  // Una sentencia que ya es "default-volatil" no necesita también "default-version-vieja".
  const volatiles = new Set(hallazgos.filter(h => h.regla === 'default-volatil').map(h => h.linea));
  const final = hallazgos.filter(h => !(h.regla === 'default-version-vieja' && volatiles.has(h.linea)));
  for (const [regla, gravedad, riesgo, arreglo] of avisosArchivo(texto, ext)) final.push({ regla, gravedad, linea: null, texto: '', riesgo, arreglo });
  const orden = { '🔴': 0, '🟠': 1, '🟡': 2, '⚪': 3 };
  final.sort((a, b) => orden[a.gravedad] - orden[b.gravedad] || (a.linea ?? 0) - (b.linea ?? 0));
  resultado.push({ archivo: f, hallazgos: final });
}

const peores = resultado.flatMap(r => r.hallazgos).filter(h => h.gravedad === '🔴' || h.gravedad === '🟠').length;
if (opt.json) {
  console.log(JSON.stringify({ motor: opt.motor, codigo: opt.codigo, archivos: resultado }, null, 2));
} else {
  console.log(`Revisión estática de migraciones (motor: ${opt.motor}${opt.codigo ? `, código: ${opt.codigo}` : ''})`);
  console.log('Solo lee archivos. Confirma cada punto: el tamaño de la tabla y la versión del motor cambian la gravedad.\n');
  for (const r of resultado) {
    if (!r.hallazgos.length) { console.log(`✅ ${r.archivo}: sin operaciones riesgosas conocidas\n`); continue; }
    console.log(`📄 ${r.archivo}`);
    for (const h of r.hallazgos) {
      console.log(`  ${h.gravedad} ${h.regla}${h.linea ? ` (línea ${h.linea})` : ''}${h.texto ? `: ${h.texto}` : ''}`);
      console.log(`     Riesgo: ${h.riesgo}`);
      console.log(`     Mejor:  ${h.arreglo}`);
      if (h.columna && h.usos) {
        console.log(h.usos.length
          ? `     Código: "${h.columna}" aparece ${h.usos.length} ${h.usos.length === 1 ? 'vez' : 'veces'}: ${h.usos.slice(0, 5).join(', ')}${h.usos.length > 5 ? ', …' : ''}`
          : `     Código: "${h.columna}" no aparece en ${opt.codigo} (revisa también otros servicios, reportes y consultas guardadas)`);
      }
    }
    console.log('');
  }
  console.log(`Total: ${peores} punto(s) 🔴/🟠 en ${resultado.length} archivo(s).`);
}
process.exit(peores ? 1 : 0);
