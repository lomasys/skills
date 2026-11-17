// Tienda Lenta: app de demostración con problemas de velocidad A PROPÓSITO.
// Sirve para ver trabajar la skill "rendimiento". No la publiques en internet.
// Corre sin instalar nada:  node server.js   →  http://localhost:4400
// Con SQL_LOG=1 imprime cada consulta a la base.
const http = require('node:http');
const zlib = require('node:zlib');
const { URL } = require('node:url');
const db = require('./db');

function enviar(res, status, cuerpo, tipo = 'application/json') {
  const datos = Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
  res.writeHead(status, { 'Content-Type': tipo, 'Content-Length': datos.length });
  res.end(datos);
}

// ---------- API ----------

// Pedidos recientes con su cliente y sus productos.
async function pedidosRecientes() {
  const pedidos = await db.pedidos.recientes(100);
  const salida = [];
  for (const p of pedidos) {
    const cliente = await db.clientes.porId(p.clienteId);
    const items = await db.items.dePedido(p.id);
    const lineas = [];
    for (const it of items) {
      const producto = await db.productos.porId(it.productoId);
      lineas.push({ producto: producto.nombre, precio: producto.precio, cantidad: it.cantidad });
    }
    salida.push({ id: p.id, fecha: p.fecha, estado: p.estado, cliente: cliente.nombre, lineas,
      total: lineas.reduce((s, l) => s + l.precio * l.cantidad, 0) });
  }
  return salida;
}

// Catálogo completo. La página solo muestra 20.
async function productos() {
  return db.productos.lista();
}

// Categorías con cuántos productos tiene cada una. Una sola consulta.
async function categorias() {
  return db.categorias.conConteo();
}

// Los 10 productos que más vendieron en los últimos 90 días.
async function reporteVentas() {
  const ultimos = await db.pedidos.recientes(1);
  const desde = new Date(Date.parse(ultimos[0].fecha) - 90 * 864e5).toISOString();
  const pedidos = await db.pedidos.desde(desde);
  const items = await db.items.dePedidos(pedidos.map(p => p.id));
  const catalogo = await db.productos.lista();
  let ranking = [];
  for (const it of items) {
    const producto = catalogo.find(p => p.id === it.productoId);
    let fila = ranking.find(r => r.id === producto.id);
    if (!fila) { fila = { id: producto.id, nombre: producto.nombre, vendido: 0 }; ranking.push(fila); }
    fila.vendido += producto.precio * it.cantidad;
    ranking = ranking.sort((a, b) => b.vendido - a.vendido);
  }
  return { desde, pedidos: pedidos.length, top: ranking.slice(0, 10) };
}

// ---------- Archivos de la página ----------

const paginaInicio = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Tienda Lenta</title>
<script src="/static/app.js"></script>
<style>body{font-family:sans-serif;margin:0}main{max-width:960px;margin:auto;padding:16px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card img{width:100%}</style>
</head><body><main>
<h1>Tienda Lenta</h1>
<img src="/static/portada.png" alt="Portada" style="width:100%;max-width:960px">
<h2>Productos</h2><div class="grid" id="productos"></div>
<p><a href="/reportes">Ver reportes</a></p>
</main>
<script>
fetch('/api/productos').then(r => r.json()).then(lista => {
  document.getElementById('productos').innerHTML = lista.slice(0, 20).map(p =>
    '<div class="card"><img src="' + p.imagen + '"><b>' + p.nombre + '</b><br>$' + p.precio + '</div>').join('');
});
</script></body></html>`;

// "Paquete" de JavaScript: el código de la página más una librería de gráficas que solo usa /reportes.
const appJs = (() => {
  let s = 1, codigo = '// app.js: código de la tienda\nwindow.tienda={iniciar(){}};\n// --- librería de gráficas (solo se usa en /reportes) ---\n';
  const r = () => ((s = (s * 48271) % 2147483647) / 2147483647).toString(36).slice(2, 10);
  while (codigo.length < 900_000) codigo += `function g_${r()}(d){var a_${r()}=d.map(function(x){return x*${r().length}+"${r()}"});return a_${r()}}\n`;
  return codigo;
})();

function png(ancho, alto) {
  const tabla = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = tabla[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const bloque = (tipo, datos) => {
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const td = Buffer.concat([Buffer.from(tipo), datos]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([largo, td, c]);
  };
  const crudo = Buffer.alloc((ancho * 3 + 1) * alto);
  let s = 7;
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const i = y * (ancho * 3 + 1) + 1 + x * 3;
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    crudo[i] = (x / ancho) * 200 + (s & 31); crudo[i + 1] = (y / alto) * 120 + (s >> 5 & 31); crudo[i + 2] = 90 + (s >> 10 & 31);
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0); cabecera.writeUInt32BE(alto, 4); cabecera[8] = 8; cabecera[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloque('IHDR', cabecera),
    bloque('IDAT', zlib.deflateSync(crudo, { level: 0 })), bloque('IEND', Buffer.alloc(0))]);
}
let portada; // se genera la primera vez que se pide

const svgProducto = n => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="hsl(${n * 18},50%,80%)"/><text x="100" y="110" text-anchor="middle" font-size="40">${n}</text></svg>`;

// ---------- Rutas ----------

async function manejar(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const ruta = url.pathname;
  if (ruta === '/') return enviar(res, 200, paginaInicio, 'text/html; charset=utf-8');
  if (ruta === '/reportes') return enviar(res, 200, '<!doctype html><h1>Reportes</h1><script src="/static/app.js"></script>', 'text/html; charset=utf-8');
  if (ruta === '/static/app.js') return enviar(res, 200, appJs, 'text/javascript');
  if (ruta === '/static/portada.png') return enviar(res, 200, portada ??= png(1600, 1000), 'image/png');
  const svg = ruta.match(/^\/static\/producto-(\d+)\.svg$/);
  if (svg) return enviar(res, 200, svgProducto(Number(svg[1])), 'image/svg+xml');
  if (ruta === '/api/pedidos') return enviar(res, 200, await pedidosRecientes());
  if (ruta === '/api/productos') return enviar(res, 200, await productos());
  if (ruta === '/api/categorias') return enviar(res, 200, await categorias());
  if (ruta === '/api/reporte-ventas') return enviar(res, 200, await reporteVentas());
  return enviar(res, 404, { error: 'no existe' });
}

// Log de cada petición, como el de Rails o Laravel: tiempo total, tiempo en la base y número de consultas.
function handle(req, res) {
  const cuenta = { consultas: 0, msDb: 0 };
  const t0 = process.hrtime.bigint();
  res.on('finish', () => {
    if (process.env.LOG === '0') return;
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`${req.method} ${req.url} ${res.statusCode} en ${ms.toFixed(0)}ms (base: ${cuenta.msDb.toFixed(0)}ms en ${cuenta.consultas} consultas)`);
  });
  db.porPeticion.run(cuenta, () => manejar(req, res).catch(e => { console.error(e); enviar(res, 500, { error: 'falló' }); }));
}

module.exports = { handle };

if (require.main === module) {
  const puerto = Number(process.env.PORT || 4400);
  http.createServer(handle).listen(puerto, '127.0.0.1', () => console.log(`Tienda Lenta en http://localhost:${puerto}`));
}
