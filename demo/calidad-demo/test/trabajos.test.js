const test = require('node:test');
const assert = require('node:assert');
const { correrTrabajos } = require('../src/trabajos');

test('el cierre diario suma lo vendido', async () => {
  const [r] = correrTrabajos([{ articulos: [{ precio: 100, cantidad: 1 }] }, { articulos: [{ precio: 50, cantidad: 2 }] }]);
  await new Promise(listo => setTimeout(listo, 1500)); // esperar a que termine el trabajo
  assert.strictEqual(r.resultado, 232);
});
