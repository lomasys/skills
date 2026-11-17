const http = require('node:http');
const { manejar } = require('./rutas');

const puerto = Number(process.env.PORT || 4500);

http.createServer((req, res) => {
  let datos = '';
  req.on('data', d => { datos += d; });
  req.on('end', () => {
    let cuerpo = {};
    try {
      cuerpo = datos ? JSON.parse(datos) : {};
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end('{"error":"json"}');
    }
    const r = manejar(req.method, req.url, cuerpo);
    res.writeHead(r.estado, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(r.cuerpo));
  });
}).listen(puerto, '127.0.0.1', () => console.log('Tiendita en http://127.0.0.1:' + puerto));
