// Prueba básica: la app levanta y lista facturas. (Los errores de la copia no se prueban aquí: ese es el reto.)
const test = require('node:test');
const assert = require('node:assert');
const servidor = require('../server');

test('lista las facturas de una cuenta', async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const { port } = servidor.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/facturas?cuenta=1`);
    assert.strictEqual(res.status, 200);
    const lista = await res.json();
    assert.ok(lista.length > 0);
  } finally {
    servidor.close();
  }
});
