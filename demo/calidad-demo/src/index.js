// Punto de entrada público del paquete.
const precios = require('./precios');
const { resumenCarrito } = require('./carrito');

module.exports = {
  total: precios.calcularTotal,
  resumenCarrito,
};
