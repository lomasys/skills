// Pantalla "implementada" de práctica para la skill mockup-vs-app.
// Sin dependencias. Node 18 o más nuevo. Solo escucha en 127.0.0.1.
//   node server.js            → http://127.0.0.1:4500/registro
//   PORT=4600 node server.js  → otro puerto
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const rutas = {
  '/': 'pagina.html',
  '/registro': 'pagina.html',
  '/estilos.css': 'estilos.css',
};
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((req, res) => {
  const archivo = rutas[new URL(req.url, 'http://x').pathname];
  if (!archivo) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No existe'); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo)] });
  res.end(fs.readFileSync(path.join(__dirname, archivo)));
});

const port = Number(process.env.PORT || 4500);
server.listen(port, '127.0.0.1', () => console.log(`Pantalla real en http://127.0.0.1:${port}/registro (mockup: mockup.html)`));
