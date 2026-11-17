// Traducciones mínimas: carga i18n/<idioma>.json y reemplaza los elementos con data-t.
let textos = {};

export async function cargar(idioma) {
  const res = await fetch(`i18n/${idioma}.json`);
  textos = await res.json();
}

export function t(llave, valores = {}) {
  const texto = llave.split('.').reduce((o, k) => (o == null ? o : o[k]), textos);
  if (typeof texto !== 'string') return llave;
  return texto.replace(/\{(\w+)\}/g, (_, k) => valores[k] ?? '');
}

export function traducirPagina() {
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
}
