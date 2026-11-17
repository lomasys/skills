// Botones de la app.

export function BotonGuardar({ onClick }) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'boton-guardar';
  boton.textContent = 'Guardar';
  boton.addEventListener('click', onClick);
  return boton;
}

export function BotonEnviar({ onClick, cargando = false }) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'boton-enviar';
  boton.textContent = cargando ? 'Enviando...' : 'Enviar';
  boton.disabled = cargando;
  boton.addEventListener('click', onClick);
  return boton;
}
