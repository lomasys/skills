// Base de datos simulada, en memoria. Cada consulta tarda como una base real en la misma máquina
// (~1.5 ms más un poco por fila) y se cuenta por petición, como lo hace el log de un ORM.
// Con SQL_LOG=1 imprime cada consulta, como `DEBUG=knex:query` o el logging de Prisma.
const { AsyncLocalStorage } = require('node:async_hooks');

const porPeticion = new AsyncLocalStorage();
const MS_POR_CONSULTA = 1.5;
const MS_POR_FILA = 0.004;

// Espera "ocupada": los timers de Node en Windows no bajan de ~15 ms y harían la demo distinta en cada sistema.
function esperar(ms) {
  const fin = process.hrtime.bigint() + BigInt(Math.round(ms * 1e6));
  while (process.hrtime.bigint() < fin) { /* la base está trabajando */ }
}

async function consulta(sql, producir) {
  await new Promise(r => setImmediate(r));
  const t0 = process.hrtime.bigint();
  const filas = producir();
  esperar(MS_POR_CONSULTA + MS_POR_FILA * filas.length);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const cuenta = porPeticion.getStore();
  if (cuenta) { cuenta.consultas++; cuenta.msDb += ms; }
  if (process.env.SQL_LOG === '1') console.log(`  [sql] ${ms.toFixed(1)}ms  ${sql}`);
  return filas;
}

// ---- Datos de ejemplo (siempre los mismos) ----
let semilla = 42;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648);
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));

const categorias = ['Café', 'Té', 'Tazas', 'Cafeteras', 'Molinos', 'Filtros', 'Galletas', 'Chocolate', 'Regalos', 'Termos', 'Básculas', 'Accesorios']
  .map((nombre, i) => ({ id: i + 1, nombre }));

const clientes = Array.from({ length: 300 }, (_, i) => ({
  id: i + 1, nombre: `Cliente ${i + 1}`, ciudad: ['CDMX', 'Monterrey', 'Guadalajara', 'Puebla', 'Mérida'][i % 5],
}));

const productos = Array.from({ length: 5000 }, (_, i) => ({
  id: i + 1,
  nombre: `Producto ${i + 1}`,
  categoriaId: (i % categorias.length) + 1,
  precio: entre(49, 2499),
  stock: entre(0, 300),
  imagen: `/static/producto-${(i % 20) + 1}.svg`,
  descripcion: 'Producto de muestra para la demo. '.repeat(6).trim(),
  creado: new Date(Date.UTC(2025, 0, 1) + i * 3600e3).toISOString(),
}));

const pedidos = [];
const items = [];
for (let i = 1; i <= 2000; i++) {
  pedidos.push({ id: i, clienteId: entre(1, clientes.length), fecha: new Date(Date.UTC(2026, 0, 1) + i * 3 * 3600e3).toISOString(), estado: i % 7 ? 'entregado' : 'en camino' });
  for (let k = entre(1, 5); k > 0; k--) items.push({ id: items.length + 1, pedidoId: i, productoId: entre(1, productos.length), cantidad: entre(1, 4) });
}
const conteoPorCategoria = new Map();
for (const p of productos) conteoPorCategoria.set(p.categoriaId, (conteoPorCategoria.get(p.categoriaId) || 0) + 1);

// ---- Consultas que ofrece la capa de datos (como lo haría un ORM) ----
module.exports = {
  porPeticion,
  pedidos: {
    recientes: (limite) => consulta(`SELECT * FROM pedidos ORDER BY fecha DESC LIMIT ${limite}`,
      () => pedidos.slice(-limite).reverse()),
    desde: (fechaIso) => consulta(`SELECT * FROM pedidos WHERE fecha >= '${fechaIso}'`,
      () => pedidos.filter(p => p.fecha >= fechaIso)),
  },
  clientes: {
    porId: (id) => consulta(`SELECT * FROM clientes WHERE id = ${id}`, () => clientes.filter(c => c.id === id)).then(f => f[0]),
    porIds: (ids) => consulta(`SELECT * FROM clientes WHERE id IN (${ids.length} ids)`, () => { const s = new Set(ids); return clientes.filter(c => s.has(c.id)); }),
  },
  items: {
    dePedido: (pedidoId) => consulta(`SELECT * FROM items WHERE pedido_id = ${pedidoId}`, () => items.filter(it => it.pedidoId === pedidoId)),
    dePedidos: (ids) => consulta(`SELECT * FROM items WHERE pedido_id IN (${ids.length} ids)`, () => { const s = new Set(ids); return items.filter(it => s.has(it.pedidoId)); }),
  },
  productos: {
    porId: (id) => consulta(`SELECT * FROM productos WHERE id = ${id}`, () => productos.filter(p => p.id === id)).then(f => f[0]),
    porIds: (ids) => consulta(`SELECT * FROM productos WHERE id IN (${ids.length} ids)`, () => { const s = new Set(ids); return productos.filter(p => s.has(p.id)); }),
    // Acepta límite y cursor, pero hoy nadie los usa.
    lista: ({ limite, despuesDeId = 0 } = {}) => consulta(
      `SELECT * FROM productos WHERE id > ${despuesDeId} ORDER BY id${limite ? ` LIMIT ${limite}` : ''}`,
      () => { const f = productos.filter(p => p.id > despuesDeId); return limite ? f.slice(0, limite) : f; }),
    total: () => consulta('SELECT COUNT(*) FROM productos', () => [productos.length]).then(f => f[0]),
  },
  categorias: {
    conConteo: () => consulta('SELECT c.*, COUNT(p.id) AS productos FROM categorias c LEFT JOIN productos p ON p.categoria_id = c.id GROUP BY c.id',
      () => categorias.map(c => ({ ...c, productos: conteoPorCategoria.get(c.id) || 0 }))),
  },
};
