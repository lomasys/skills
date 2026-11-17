// Precios de la tiendita: total con IVA y cupones.
const IVA = 0.16;

function calcularTotal(articulos, cupon) {
  const subtotal = articulos.reduce((suma, a) => suma + a.precio * a.cantidad, 0);
  let descuento = 0;
  if (cupon === 'DESC10') {
    const primero = articulos[0];
    descuento = primero.precio * primero.cantidad * 0.1;
  }
  return Math.round((subtotal - descuento) * (1 + IVA) * 100) / 100;
}

function formatoMoneda(n) {
  return '$' + n.toFixed(2);
}

function precioConIvaViejo(precio) {
  return precio * 1.15;
}

module.exports = { calcularTotal, formatoMoneda, precioConIvaViejo, IVA };
