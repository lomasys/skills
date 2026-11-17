const trabajos = require('../../config/trabajos.json');

// Corre los trabajos programados. Cada uno se carga por el nombre de su módulo.
function correrTrabajos(pedidos) {
  return trabajos.map(t => ({ nombre: t.nombre, resultado: require('./' + t.modulo)(pedidos, t) }));
}

module.exports = { correrTrabajos };
