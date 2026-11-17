import { cargar, t, traducirPagina } from './i18n.js';
import { BotonEnviar } from './componentes/botones.js';

await cargar('es');
traducirPagina();

const filas = document.getElementById('filas');
const sinPedidos = document.getElementById('sin-pedidos');

filas.innerHTML = '<tr><td colspan="3">Cargando pedidos…</td></tr>';
const res = await fetch('/api/pedidos' + location.search);
const pedidos = await res.json();

if (pedidos.length === 0) {
  filas.innerHTML = '';
  sinPedidos.hidden = false;
} else {
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  filas.innerHTML = pedidos.map(p => `<tr><td>${esc(p.id)}</td><td>${esc(p.cliente)}</td><td>$${esc(p.total)}</td></tr>`).join('');
}

document.getElementById('botones').append(BotonEnviar({ onClick: () => alert(t('pedidos.enviados')) }));
