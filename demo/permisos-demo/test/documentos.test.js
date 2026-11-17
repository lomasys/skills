// Prueba existente del proyecto: muestra cómo se escriben las pruebas aquí.
// Corre con:  node --test
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { crearApp } = require('../server');

// Cada prueba usa datos nuevos y una carpeta de archivos temporal propia.
async function arrancar() {
  const almacenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'permisos-demo-'));
  const app = crearApp({ almacenDir });
  const server = http.createServer((req, res) => app.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cerrar = () => { server.close(); fs.rmSync(almacenDir, { recursive: true, force: true }); };
  return { app, base, cerrar };
}

async function entrar(base, email) {
  const r = await fetch(`${base}/login`, { method: 'POST', body: JSON.stringify({ email, password: 'demo123' }) });
  return r.headers.get('set-cookie').split(';')[0];
}

test('un lector no puede crear documentos', async () => {
  const { base, cerrar } = await arrancar();
  try {
    const cookie = await entrar(base, 'leo@empresa-a.test');
    const r = await fetch(`${base}/api/documentos`, { method: 'POST', headers: { cookie }, body: JSON.stringify({ titulo: 'x' }) });
    assert.strictEqual(r.status, 403);
  } finally {
    cerrar();
  }
});

test('un editor sí puede crear documentos', async () => {
  const { base, cerrar } = await arrancar();
  try {
    const cookie = await entrar(base, 'eli@empresa-a.test');
    const r = await fetch(`${base}/api/documentos`, { method: 'POST', headers: { cookie }, body: JSON.stringify({ titulo: 'Nuevo' }) });
    assert.strictEqual(r.status, 201);
  } finally {
    cerrar();
  }
});
