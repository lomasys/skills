const test = require('node:test');
const assert = require('node:assert');
const { calcularTotal } = require('../src/precios');

test('total de un artículo con IVA', () => {
  assert.strictEqual(calcularTotal([{ precio: 100, cantidad: 1 }]), 116);
});

test('cupón DESC10 en un artículo', () => {
  assert.strictEqual(calcularTotal([{ precio: 100, cantidad: 1 }], 'DESC10'), 104.4);
});
