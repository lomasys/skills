const fs = require('node:fs');
const path = require('node:path');
const ayudas = require('./precios');

// Reemplaza {{funcion campo1 campo2}} con ayudas[funcion](datos[campo1], datos[campo2]).
function render(nombre, datos) {
  const texto = fs.readFileSync(path.join(__dirname, '..', 'plantillas', nombre), 'utf8');
  return texto.replace(/\{\{(\w+)((?:\s+\w+)*)\}\}/g, (_, fn, args) => {
    const valores = args.trim() ? args.trim().split(/\s+/).map(c => datos[c]) : [];
    const v = ayudas[fn](...valores);
    return typeof v === 'number' ? ayudas.formatoMoneda(v) : String(v);
  });
}

module.exports = { render };
