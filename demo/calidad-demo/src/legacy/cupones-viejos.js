// Cupones del sistema anterior.
function validarCuponViejo(codigo) {
  return /^OLD-\d{3}$/.test(codigo);
}

module.exports = { validarCuponViejo };
