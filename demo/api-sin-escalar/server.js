// API sin escalar: app de práctica con problemas para crecer PUESTOS A PROPÓSITO.
// Sirve para ver trabajar la skill "escalar". Funciona bien con 5 clientes… y se cae con 500.
// Corre sin instalar nada:  node server.js   →  http://127.0.0.1:4500
const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const db = require('./db');

const PUERTO = Number(process.env.PUERTO || 4500);
const espera = ms => new Promise(r => setTimeout(r, ms));

// Dos clientes (empresas) comparten el sistema. El token dice quién eres.
const TOKENS = { 'token-a': { usuario: 'ana', cuenta: 'A' }, 'token-b': { usuario: 'beto', cuenta: 'B' } };

// Caché "rápida" en memoria del proceso: sin tiempo de vida, sin límite de tamaño.
const cache = new Map();

// Archivos subidos: se guardan en la memoria del servidor y se sirven desde aquí.
const archivos = new Map();

// Interruptores para simular caídas: POST /_demo/romper?que=db|correo|externo  y  /_demo/arreglar
const roto = { db: false, correo: false, externo: false };

function enviar(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function leerCuerpo(req) {
  return new Promise(resolve => {
    const partes = [];
    req.on('data', c => partes.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(partes).toString() || '{}')); } catch { resolve({}); } });
  });
}

// Correo de confirmación: el proveedor tarda 1.5 s y falla 1 de cada 5 veces.
async function enviarCorreo(para, asunto) {
  await espera(roto.correo ? 30000 : 1500);
  if (Math.random() < 0.2) throw new Error('el proveedor de correo no respondió');
  db.correos.push({ para, asunto, fecha: new Date().toISOString() });
}

// Servicio externo de tipo de cambio: a veces tarda 20 s. No hay tiempo límite.
async function pedirTipoCambio() {
  await espera(roto.externo || Math.random() < 0.05 ? 20000 : 200);
  return 17.2 + Math.random() / 10;
}

async function manejar(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const ruta = url.pathname;

  // Siempre dice que todo está bien, aunque la base esté caída.
  if (ruta === '/salud') return enviar(res, 200, { ok: true });

  if (ruta.startsWith('/_demo/')) {
    const que = url.searchParams.get('que');
    if (ruta === '/_demo/romper' && que in roto) roto[que] = true;
    if (ruta === '/_demo/arreglar') for (const k in roto) roto[k] = false;
    db.roto = roto.db;
    return enviar(res, 200, { roto });
  }

  const sesion = TOKENS[(req.headers.authorization || '').replace('Bearer ', '')];
  if (!sesion) return enviar(res, 401, { error: 'sin sesión' });

  // Resumen del tablero. Caché con llave fija: la primera cuenta que entra "gana" y las demás ven sus números.
  // Además nunca se borra: un pedido nuevo no aparece en el resumen.
  if (req.method === 'GET' && ruta === '/api/resumen') {
    if (cache.has('resumen')) return enviar(res, 200, cache.get('resumen'));
    const pedidos = await db.consulta(80, () => db.pedidos.filter(p => p.cuenta === sesion.cuenta));
    const resumen = { cuenta: sesion.cuenta, pedidos: pedidos.length, total: pedidos.reduce((s, p) => s + p.monto, 0) };
    cache.set('resumen', resumen);
    return enviar(res, 200, resumen);
  }

  // Reporte de ventas: una consulta por producto (N+1) y un cálculo pesado que bloquea el proceso. Sin caché.
  if (req.method === 'GET' && ruta === '/api/reporte') {
    const productos = await db.consulta(30, () => db.productos);
    const filas = [];
    for (const p of productos) {
      const ventas = await db.consulta(20, () => db.pedidos.filter(x => x.cuenta === sesion.cuenta && x.producto === p.id));
      filas.push({ producto: p.nombre, ventas: ventas.length });
    }
    let h = '';
    for (let i = 0; i < 15000; i++) h = crypto.createHash('sha256').update(h + i).digest('hex'); // ~30 ms de CPU
    return enviar(res, 200, { cuenta: sesion.cuenta, filas, firma: h.slice(0, 8) });
  }

  // Crear pedido. Manda el correo DENTRO de la petición. Si el correo falla, responde 500
  // aunque el pedido ya se guardó: el cliente reintenta y queda duplicado.
  if (req.method === 'POST' && ruta === '/api/pedidos') {
    const { producto = 1, monto = 100 } = await leerCuerpo(req);
    const pedido = await db.consulta(40, () => {
      const p = { id: db.pedidos.length + 1, cuenta: sesion.cuenta, producto, monto, fecha: new Date().toISOString() };
      db.pedidos.push(p);
      return p;
    });
    try {
      await enviarCorreo(`${sesion.usuario}@empresa-${sesion.cuenta.toLowerCase()}.test`, `Pedido ${pedido.id}`);
    } catch (e) {
      return enviar(res, 500, { error: e.message });
    }
    return enviar(res, 201, pedido);
  }

  // Precio en dólares: llama a un servicio externo sin tiempo límite ni plan B.
  if (req.method === 'GET' && ruta === '/api/precio-usd') {
    const tc = await pedirTipoCambio();
    return enviar(res, 200, { tipoCambio: tc });
  }

  // Subir archivo: la imagen viaja completa por la app y se queda en su memoria.
  if (req.method === 'POST' && ruta === '/api/archivos') {
    const { nombre = 'foto.png', base64 = '' } = await leerCuerpo(req);
    const id = crypto.randomUUID();
    archivos.set(id, { cuenta: sesion.cuenta, nombre, datos: Buffer.from(base64, 'base64') });
    return enviar(res, 201, { id, url: `/api/archivos/${id}` });
  }
  if (req.method === 'GET' && ruta.startsWith('/api/archivos/')) {
    const a = archivos.get(ruta.split('/')[3]);
    if (!a || a.cuenta !== sesion.cuenta) return enviar(res, 404, { error: 'no existe' });
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); // sin Cache-Control
    return res.end(a.datos);
  }

  enviar(res, 404, { error: 'no existe' });
}

http.createServer((req, res) => {
  manejar(req, res).catch(e => enviar(res, 500, { error: e.message }));
}).listen(PUERTO, '127.0.0.1', () => console.log(`API sin escalar en http://127.0.0.1:${PUERTO}`));
