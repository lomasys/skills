const { total } = require('./index');

function generarFolio() {
  return 'F-' + Math.floor(Math.random() * 10000);
}

function generarFactura(pedido) {
  return { folio: generarFolio(), cliente: pedido.cliente, total: total(pedido.articulos, pedido.cupon) };
}

module.exports = { generarFactura, generarFolio };
