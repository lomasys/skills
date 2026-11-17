const { calcularTotal } = require('./precios');

function resumenCarrito(carrito) {
  return {
    piezas: carrito.articulos.reduce((n, a) => n + a.cantidad, 0),
    total: calcularTotal(carrito.articulos, carrito.cupon),
  };
}

module.exports = { resumenCarrito };
