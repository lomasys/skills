const precios = require('../precios');

// Suma lo vendido en el día. La función de cálculo viene de config/trabajos.json.
module.exports = function cierre(pedidos, conf) {
  return pedidos.reduce((suma, p) => suma + precios[conf.calculo](p.articulos, p.cupon), 0);
};
