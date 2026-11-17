const test = require('node:test');
const assert = require('node:assert');
const { resumenCarrito } = require('../src/carrito');
const { generarFactura } = require('../src/factura');

test('resumen del carrito', () => {
  const r = resumenCarrito({ articulos: [{ precio: 50, cantidad: 2 }, { precio: 10, cantidad: 1 }], cupon: 'DESC10' });
  assert.ok(r);
  assert.ok(r.total !== undefined);
});

test('genera factura', () => {
  generarFactura({ cliente: 'Cliente Demo', articulos: [{ precio: 10, cantidad: 1 }] });
});
