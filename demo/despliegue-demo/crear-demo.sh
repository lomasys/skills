#!/usr/bin/env bash
# Crea el proyecto de práctica "despliegue-demo" con historial de git y un cambio pendiente.
# Uso: bash crear-demo.sh <carpeta-destino>
set -e
D="$1"
[ -z "$D" ] && { echo "falta carpeta destino"; exit 1; }
if [ -e "$D" ] && [ -n "$(ls -A "$D" 2>/dev/null)" ]; then
  echo "La carpeta \"$D\" ya existe y no está vacía. Por seguridad no la toco: elige una carpeta nueva."
  exit 1
fi
mkdir -p "$D"; cd "$D"
git init -q -b main
git config user.name "Dev Demo"; git config user.email "dev@demo.test"; git config core.autocrlf false
printf 'node_modules/\n*.log\n.env\n' > .gitignore
mkdir -p src test migrations scripts

# ---------- v1.2.0 (lo que está en producción) ----------
cat > package.json <<'EOF'
{
  "name": "despliegue-demo",
  "version": "1.2.0",
  "private": true,
  "description": "Tienda de práctica para revisar despliegues. Node 18+, sin dependencias.",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test",
    "build": "node scripts/build.mjs",
    "migrate": "node scripts/migrar.mjs"
  },
  "engines": { "node": ">=18" }
}
EOF
cat > .env.example <<'EOF'
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://usuario:clave@localhost:5432/tienda
PAGOS_API_KEY=sk_test_cambiame
FLAG_NUEVO_CHECKOUT=0
EOF
cat > render.yaml <<'EOF'
services:
  - type: web
    name: tienda
    env: node
    buildCommand: npm ci && npm run build
    preDeployCommand: npm run migrate
    startCommand: npm start
    healthCheckPath: /salud
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase: { name: tienda-db, property: connectionString }
      - key: PAGOS_API_KEY
        sync: false
      - key: FLAG_NUEVO_CHECKOUT
        value: "0"
EOF
cat > src/config.js <<'EOF'
module.exports = {
  puerto: Number(process.env.PORT || 3000),
  baseDatos: process.env.DATABASE_URL,
  pagosClave: process.env.PAGOS_API_KEY,
};
EOF
cat > src/flags.js <<'EOF'
// Banderas de funciones: se prenden y apagan con variables de entorno, sin subir código.
module.exports = {
  nuevoCheckout: process.env.FLAG_NUEVO_CHECKOUT === '1',
};
EOF
cat > src/pedidos.js <<'EOF'
const { cobrar } = require('./pagos');

function resumenPedido(pedido) {
  const total = pedido.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  return {
    id: pedido.id,
    total,
    // El pedido de invitado no trae cliente.
    correo: pedido.cliente.email,
  };
}

async function confirmarPedido(pedido) {
  const resumen = resumenPedido(pedido);
  await cobrar(resumen.total, pedido.tarjeta);
  return resumen;
}

module.exports = { resumenPedido, confirmarPedido };
EOF
cat > src/pagos.js <<'EOF'
const config = require('./config');

async function cobrar(monto, tarjeta) {
  // Sin tiempo límite ni reintento: si el proveedor tarda, el cliente espera hasta que se corta.
  const r = await fetch('https://api.pagos.example/v1/cargos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.pagosClave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ monto, tarjeta }),
  });
  if (!r.ok) throw new Error(`pago rechazado: ${r.status}`);
  return r.json();
}

module.exports = { cobrar };
EOF
cat > src/webhooks.js <<'EOF'
const db = require('./db');

async function recibirAvisoDePago(evento) {
  // No revisa si el evento ya se procesó: el proveedor reintenta y llega dos veces.
  await db.insertar('pagos', { id_evento: evento.id, pedido_id: evento.pedido, monto: evento.monto });
  await db.actualizar('pedidos', evento.pedido, { estado: 'pagado' });
}

module.exports = { recibirAvisoDePago };
EOF
cat > src/clientes.js <<'EOF'
const db = require('./db');

async function perfil(clienteId) {
  const c = await db.buscar('clientes', clienteId);
  return { nombre: c.nombre, correo: c.correo, telefono: c.telefono };
}

module.exports = { perfil };
EOF
cat > src/db.js <<'EOF'
// Base en memoria para la práctica. En producción sería Postgres.
const tablas = { clientes: new Map(), pedidos: new Map(), pagos: new Map() };
module.exports = {
  async buscar(t, id) { return tablas[t].get(id); },
  async insertar(t, fila) {
    const id = fila.id_evento || fila.id;
    if (tablas[t].has(id)) throw new Error(`duplicate key value violates unique constraint "${t}_pkey"`);
    tablas[t].set(id, fila);
  },
  async actualizar(t, id, cambios) { tablas[t].set(id, { ...tablas[t].get(id), ...cambios }); },
};
EOF
cat > src/server.js <<'EOF'
const http = require('node:http');
const config = require('./config');
const { perfil } = require('./clientes');

const server = http.createServer(async (req, res) => {
  if (req.url === '/salud') { res.end('ok'); return; }
  if (req.url.startsWith('/api/clientes/')) {
    const datos = await perfil(req.url.split('/')[3]);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(datos));
    return;
  }
  res.statusCode = 404; res.end('no encontrado');
});

if (require.main === module) server.listen(config.puerto, '127.0.0.1', () => console.log(`tienda en ${config.puerto}`));
module.exports = server;
EOF
cat > scripts/build.mjs <<'EOF'
// "Build" de práctica: revisa que cada archivo de src/ cargue sin errores de sintaxis.
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const f of readdirSync('src').filter(f => f.endsWith('.js') && f !== 'server.js')) require(`../src/${f}`);
console.log('build ok');
EOF
cat > scripts/migrar.mjs <<'EOF'
// Corre las migraciones de migrations/ en orden. En la práctica solo las lista.
import { readdirSync } from 'node:fs';
for (const f of readdirSync('migrations').sort()) console.log('migración', f);
EOF
cat > migrations/20260901_crear_tablas.sql <<'EOF'
CREATE TABLE clientes (id text PRIMARY KEY, nombre text NOT NULL, correo text NOT NULL);
CREATE TABLE pedidos (id text PRIMARY KEY, cliente_id text REFERENCES clientes(id), estado text NOT NULL);
CREATE TABLE pagos (id_evento text PRIMARY KEY, pedido_id text REFERENCES pedidos(id), monto integer NOT NULL);
EOF
cat > migrations/20261020_agregar_telefono.sql <<'EOF'
ALTER TABLE clientes ADD COLUMN telefono text;
EOF
cat > test/pedidos.test.js <<'EOF'
const test = require('node:test');
const assert = require('node:assert');
const { resumenPedido } = require('../src/pedidos');

test('suma el total del pedido', () => {
  const r = resumenPedido({ id: 'p1', cliente: { email: 'a@b.test' }, lineas: [{ precio: 100, cantidad: 2 }] });
  assert.strictEqual(r.total, 200);
});
EOF
cat > CHANGELOG.md <<'EOF'
# Cambios

## 1.2.0
- Los clientes pueden guardar su teléfono.
- Pagos con tarjeta.
EOF
cat > README.md <<'EOF'
# Tienda (práctica)

`npm start`, `npm test`, `npm run build`, `npm run migrate`.

Se publica en Render: cada push a `main` despliega solo (ver `render.yaml`).
EOF
git add -A; git commit -qm "Versión 1.2.0"; git tag v1.2.0

# ---------- commits después de lo publicado ----------
cat > src/exportar.js <<'EOF'
const db = require('./db');

// Exporta los pedidos de una empresa en CSV.
async function exportarPedidos(pedidos) {
  const filas = pedidos.map(p => [p.id, p.estado, p.total].join(','));
  return ['id,estado,total', ...filas].join('\n');
}

module.exports = { exportarPedidos, db };
EOF
git add -A; git commit -qm "feat: exportar pedidos a CSV desde el panel"

cat > src/facturas.js <<'EOF'
const db = require('./db');

// Antes buscaba la factura solo por id y una empresa podía ver las facturas de otra.
async function verFactura(usuario, facturaId) {
  const f = await db.buscar('pedidos', facturaId);
  if (!f || f.empresa_id !== usuario.empresa_id) return null;
  return f;
}

module.exports = { verFactura };
EOF
git add -A; git commit -qm "fix: IDOR en /api/facturas, una empresa podía ver facturas de otra (lo reportó Ferretería López, ticket #4411)"

cat >> CHANGELOG.md <<'EOF'

## Sin publicar
- Exportar pedidos a CSV.
- Arreglo de permisos en facturas (ticket #4411, Ferretería López).
- Refactor interno de db.js y subir timeout de pruebas en CI.
EOF
git add -A; git commit -qm "chore: refactor interno de db.js y timeout de CI"

# ---------- cambio pendiente (sin commit): costo de envío ----------
cat > src/envios.js <<'EOF'
const flags = require('./flags');

const ENVIOS_URL = process.env.ENVIOS_API_URL;

// Envío gratis desde 500. Abajo de eso cuesta 99.
function costoEnvio(subtotal) {
  if (!flags.cobroEnvio) return 0;
  return subtotal > 500 ? 0 : 0;
}

async function cotizar(cp) {
  const r = await fetch(`${ENVIOS_URL}/cotizar?cp=${cp}`, {
    headers: { Authorization: `Bearer ${process.env.ENVIOS_API_TOKEN}` },
  });
  return r.json();
}

module.exports = { costoEnvio, cotizar };
EOF
cat > src/flags.js <<'EOF'
// Banderas de funciones: se prenden y apagan con variables de entorno, sin subir código.
module.exports = {
  nuevoCheckout: process.env.FLAG_NUEVO_CHECKOUT === '1',
  cobroEnvio: true,
};
EOF
cat > src/config.js <<'EOF'
module.exports = {
  puerto: Number(process.env.PORT || 3000),
  baseDatos: process.env.DATABASE_URL,
  pagosClave: process.env.PAGOS_API_KEY,
  enviosUrl: process.env.ENVIOS_API_URL,
};
EOF
cat > migrations/20261115_quitar_telefono.sql <<'EOF'
-- El teléfono ahora vive en el servicio de envíos.
ALTER TABLE clientes DROP COLUMN telefono;
EOF
cat > test/envios.test.js <<'EOF'
const test = require('node:test');
const assert = require('node:assert');
const { costoEnvio } = require('../src/envios');

test('envío gratis desde 500', () => {
  assert.strictEqual(costoEnvio(800), 0);
});

test('abajo de 500 el envío cuesta 99', () => {
  assert.strictEqual(costoEnvio(300), 99);
});
EOF

# ---------- errores.log (export de errores de producción) ----------
node - <<'EOF'
const fs = require('fs');
const base = Date.parse('2026-11-14T08:00:00Z');
const t = m => new Date(base + m * 60000).toISOString();
const L = [];
const usuarios = n => `usr_${String(1000 + n)}`;
// 1) Pedido de invitado sin cliente: muchos usuarios, desde el 14
for (let i = 0; i < 46; i++) L.push([i * 37, `ERROR TypeError: Cannot read properties of undefined (reading 'email')\n    at resumenPedido (/app/src/pedidos.js:9:28)\n    at confirmarPedido (/app/src/pedidos.js:14:19)  usuario=${usuarios(i % 31)} ruta=POST /api/pedidos`]);
// 2) Proveedor de pagos tarda: pocas veces pero en el cobro
for (let i = 0; i < 9; i++) L.push([200 + i * 190, `ERROR Error: connect ETIMEDOUT 52.10.4.7:443\n    at cobrar (/app/src/pagos.js:5:19)\n    at confirmarPedido (/app/src/pedidos.js:15:9)  usuario=${usuarios(50 + i)} ruta=POST /api/pedidos monto=1890 PAGOS_API_KEY=sk_live_DEMO_FALSA_0000`]);
// 3) Aviso de pago duplicado
for (let i = 0; i < 14; i++) L.push([90 + i * 120, `ERROR Error: duplicate key value violates unique constraint "pagos_pkey"\n    at insertar (/app/src/db.js:7:39)\n    at recibirAvisoDePago (/app/src/webhooks.js:5:12)  ruta=POST /webhooks/pagos evento=evt_${7700 + (i % 5)} cliente=maria.gonzalez@correo.test`]);
// 4) Ruido: aviso de desuso, sin impacto
for (let i = 0; i < 120; i++) L.push([i * 15, `WARN (node:1) [DEP0005] DeprecationWarning: Buffer() is deprecated due to security and usability issues.`]);
// 5) Un solo error raro
L.push([1500, `ERROR Error: ENOSPC: no space left on device, write '/app/tmp/export-20261115.csv'\n    at exportarPedidos (/app/src/exportar.js:6:10)  usuario=${usuarios(3)}`]);
L.sort((a, b) => a[0] - b[0]);
fs.writeFileSync('errores.log', L.map(([m, x]) => `${t(m)} ${x}`).join('\n') + '\n');
EOF
echo "listo: $D"
