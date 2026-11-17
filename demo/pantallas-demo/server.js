// Pantallas Demo: app de práctica con fallas de interfaz A PROPÓSITO.
// Sirve para ver la skill "pantallas" trabajar. Corre sin instalar nada:
//   node server.js   →   http://localhost:4500
// Para ver los estados de la lista, agrega ?modo= a la página o a la API:
//   vacio · error · sinpermiso · lento
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PUBLICO = path.join(__dirname, 'public');
const PUERTO = Number(process.env.PORT) || 4500;

const clientes = [
  { id: 1, nombre: 'Rosa Méndez', ultimaCompra: '2026-10-02', foto: 'avatar.svg' },
  { id: 2, nombre: 'Jorge Salas', ultimaCompra: '2026-09-18', foto: 'avatar.svg' },
  { id: 3, nombre: 'Lucía Paredes', ultimaCompra: '2026-11-01', foto: 'avatar.svg' },
];
const pedidos = [
  { id: 'P-101', cliente: 'Rosa Méndez', total: 540 },
  { id: 'P-102', cliente: 'Lucía Paredes', total: 1290 },
];

const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function json(res, status, datos) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(datos));
}

function api(res, modo, datos) {
  if (modo === 'vacio') return json(res, 200, []);
  if (modo === 'error') return json(res, 500, { error: 'ECONNREFUSED 127.0.0.1:5432' });
  if (modo === 'sinpermiso') return json(res, 403, { error: 'forbidden' });
  if (modo === 'lento') return setTimeout(() => json(res, 200, datos), 3000);
  return json(res, 200, datos);
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const modo = url.searchParams.get('modo');
  if (url.pathname === '/api/clientes') return api(res, modo, clientes);
  if (url.pathname === '/api/pedidos') return api(res, modo, pedidos);

  const ruta = path.normalize(path.join(PUBLICO, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!ruta.startsWith(PUBLICO)) { res.writeHead(403); return res.end(); }
  fs.readFile(ruta, (err, contenido) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': tipos[path.extname(ruta)] || 'application/octet-stream' });
    res.end(contenido);
  });
});

servidor.listen(PUERTO, '127.0.0.1', () => console.log(`Pantallas Demo en http://localhost:${PUERTO}`));
