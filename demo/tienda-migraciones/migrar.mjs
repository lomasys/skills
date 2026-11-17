// Aplica las migraciones pendientes de db/migraciones a la base de docker-compose.yml.
// Uso: node migrar.mjs            (aplica todo lo pendiente)
//      node migrar.mjs --estado   (solo muestra qué falta, sin aplicar nada)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const psql = (args, input) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'tienda', '-d', 'tienda', '-v', 'ON_ERROR_STOP=1', '-At', ...args], {
    input, encoding: 'utf8',
  });

const aplicadas = new Set(psql(['-c', 'SELECT version FROM schema_migrations']).split('\n').filter(Boolean));
const pendientes = fs.readdirSync('db/migraciones').filter(f => f.endsWith('.sql') && !aplicadas.has(f.slice(0, 3))).sort();

if (process.argv.includes('--estado')) {
  console.log(pendientes.length ? 'Pendientes:\n' + pendientes.join('\n') : 'Todo aplicado.');
  process.exit(0);
}
for (const f of pendientes) {
  console.log('Aplicando', f);
  psql(['-f', '/demo/migraciones/' + f]);
  psql(['-c', `INSERT INTO schema_migrations (version) VALUES ('${f.slice(0, 3)}')`]);
}
console.log(pendientes.length ? 'Listo.' : 'Nada pendiente.');
