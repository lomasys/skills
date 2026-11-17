import { cargar, t, traducirPagina } from './i18n.js';
import { BotonGuardar, BotonEnviar } from './componentes/botones.js';

const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

await cargar('es');
traducirPagina();

async function cargarClientes() {
  const lista = document.getElementById('lista-clientes');
  lista.textContent = 'Loading...';
  const res = await fetch('/api/clientes' + location.search);
  const clientes = await res.json();
  document.getElementById('contador').textContent = t('clientes.contador', { n: clientes.length });
  lista.innerHTML = clientes.map(c => `
    <li>
      <img src="${esc(c.foto)}">
      <strong>${esc(c.nombre)}</strong>
      <span class="fecha">Última compra: ${esc(c.ultimaCompra)}</span>
      <button class="icono borrar" data-id="${c.id}">
        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      </button>
    </li>`).join('');
}

window.exportar = () => alert('Not implemented yet');
window.cerrarModal = () => { document.getElementById('modal').hidden = true; };

document.getElementById('btn-nuevo').addEventListener('click', () => {
  document.getElementById('modal').hidden = false;
});

const botones = document.getElementById('botones-modal');
botones.append(
  BotonGuardar({ onClick: () => alert('Cliente guardado') }),
  BotonEnviar({ onClick: () => alert('Invitación enviada') }),
);

cargarClientes();
