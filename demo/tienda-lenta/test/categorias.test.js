// Prueba existente del proyecto: muestra cómo se escriben las pruebas aquí.
// Corre con:  node --test
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { handle } = require('../server');

process.env.LOG = '0';

function start() {
  const server = http.createServer(handle);
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('las categorías traen cuántos productos tiene cada una', async () => {
  const server = await start();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const lista = await (await fetch(`${base}/api/categorias`)).json();
    assert.strictEqual(lista.length, 12);
    assert.strictEqual(lista.reduce((s, c) => s + c.productos, 0), 5000);
  } finally {
    server.close();
  }
});
