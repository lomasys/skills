// Base de datos de mentira: datos en memoria detrás de un "pool" de 5 conexiones.
// Como en una base real, si las 5 están ocupadas la consulta espera turno. Aquí, sin tiempo límite.
const CONEXIONES = 5;
let ocupadas = 0;
const fila = [];

const datos = {
  roto: false, // true = la base "no contesta" (cada consulta se queda colgada)
  productos: [
    { id: 1, nombre: 'Plan Básico' }, { id: 2, nombre: 'Plan Pro' }, { id: 3, nombre: 'Soporte' },
    { id: 4, nombre: 'Capacitación' }, { id: 5, nombre: 'Integración' }, { id: 6, nombre: 'Licencia extra' },
  ],
  pedidos: [],
  correos: [],
};

for (let i = 1; i <= 40; i++) {
  datos.pedidos.push({ id: i, cuenta: i % 3 === 0 ? 'B' : 'A', producto: (i % 6) + 1, monto: 100 * ((i % 5) + 1), fecha: '2026-01-01T00:00:00Z' });
}

function tomarConexion() {
  if (ocupadas < CONEXIONES) { ocupadas++; return Promise.resolve(); }
  return new Promise(resolve => fila.push(resolve));
}

function soltarConexion() {
  const siguiente = fila.shift();
  if (siguiente) siguiente(); else ocupadas--;
}

// Simula una consulta que tarda `ms` y devuelve lo que regrese `fn`.
async function consulta(ms, fn) {
  await tomarConexion();
  try {
    if (datos.roto) await new Promise(() => {}); // nunca contesta y nunca suelta la conexión
    await new Promise(r => setTimeout(r, ms));
    return fn();
  } finally {
    soltarConexion();
  }
}

module.exports = Object.assign(datos, { consulta, estado: () => ({ ocupadas, enFila: fila.length }) });
