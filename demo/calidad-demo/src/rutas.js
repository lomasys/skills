const precios = require('./precios');
const { generarFactura } = require('./factura');

// Cada ruta dice qué función de precios atiende la petición.
const rutas = [
  { metodo: 'POST', ruta: '/api/total', accion: 'calcularTotal' },
  { metodo: 'POST', ruta: '/api/factura' },
];

function manejar(metodo, ruta, cuerpo) {
  const r = rutas.find(x => x.metodo === metodo && x.ruta === ruta);
  if (!r) return { estado: 404, cuerpo: { error: 'no existe' } };
  if (r.ruta === '/api/factura') return { estado: 200, cuerpo: generarFactura(cuerpo) };
  return { estado: 200, cuerpo: { total: precios[r.accion](cuerpo.articulos, cuerpo.cupon) } };
}

module.exports = { rutas, manejar };
