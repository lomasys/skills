const test = require('node:test');
const assert = require('node:assert');
const { generarFactura } = require('../src/factura');

test('la factura trae folio de 4 dígitos y total', () => {
  const f = generarFactura({ cliente: 'Cliente Demo', articulos: [{ precio: 100, cantidad: 1 }] });
  assert.match(f.folio, /^F-\d{4}$/);
  assert.strictEqual(f.total, 116);
});
