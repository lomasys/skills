// Facturas con Copia: SaaS de facturación de práctica, con errores de base de datos A PROPÓSITO.
// Tiene una base principal (escribe) y una copia (lee) que se actualiza con retraso.
// Corre sin instalar nada:  node server.js   →  http://localhost:4500
const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const config = require('./config');
const db = require('./db');

const sesiones = new Map(); // token → usuarioId

function enviar(res, estado, cuerpo, headers = {}) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(cuerpo));
}

function leerCuerpo(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

// Busca por id: hay índice, es rápido.
const porId = (base, tabla, id) =>
  db[base].consulta(`${tabla} por id`, 'lectura', 2, t => t[tabla].find(f => f.id === id) || null);

async function manejar(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const partes = url.pathname.split('/').filter(Boolean);

  // Registro: escribe en la principal.
  if (req.method === 'POST' && url.pathname === '/registro') {
    const { email, password } = await leerCuerpo(req);
    if (!email || !password) return enviar(res, 400, { error: 'faltan datos' });
    const usuario = await db.escribir('insertar usuario', { op: 'insertar', tabla: 'usuarios', fila: { email, password, cuentaId: 1 } });
    return enviar(res, 201, { id: usuario.id, email });
  }

  // Login: busca al usuario en la COPIA.
  if (req.method === 'POST' && url.pathname === '/login') {
    const { email, password } = await leerCuerpo(req);
    const usuario = await db.copia.consulta('usuario por email', 'lectura', 2,
      t => t.usuarios.find(u => u.email === email && u.password === password));
    if (!usuario) return enviar(res, 401, { error: 'correo o contraseña incorrectos' });
    const token = crypto.randomBytes(16).toString('hex');
    sesiones.set(token, usuario.id);
    return enviar(res, 200, { ok: true }, { 'Set-Cookie': `sesion=${token}; HttpOnly; SameSite=Lax; Path=/` });
  }

  // Crear factura: escribe en la principal y regresa lo que lee de la COPIA.
  if (req.method === 'POST' && url.pathname === '/api/facturas') {
    const { cuentaId, total } = await leerCuerpo(req);
    if (!cuentaId || !total) return enviar(res, 400, { error: 'faltan datos' });
    const nueva = await db.escribir('insertar factura', {
      op: 'insertar', tabla: 'facturas', fila: { cuentaId: Number(cuentaId), total: Number(total), pagada: false, creada: new Date().toISOString() },
    });
    const factura = await porId('copia', 'facturas', nueva.id);
    if (!factura) return enviar(res, 500, { error: 'no se encontró la factura recién creada' });
    return enviar(res, 201, factura);
  }

  // Listado de facturas de una cuenta: en la copia, pero sin índice por cuentaId (revisa toda la tabla).
  if (req.method === 'GET' && url.pathname === '/api/facturas') {
    const cuentaId = Number(url.searchParams.get('cuenta'));
    const lista = await db.copia.consulta('facturas por cuenta (sin índice)', 'lectura', Math.round(db.copia.tablas.facturas.length / 1000),
      t => t.facturas.filter(f => f.cuentaId === cuentaId));
    return enviar(res, 200, lista.slice(-50));
  }

  if (partes[0] === 'api' && partes[1] === 'facturas' && partes[2]) {
    const id = Number(partes[2]);

    if (req.method === 'GET') {
      const factura = await porId('copia', 'facturas', id);
      return factura ? enviar(res, 200, factura) : enviar(res, 404, { error: 'no existe' });
    }

    // Editar: escribe en la principal y contesta con lo que hay en la COPIA (todavía el valor viejo).
    if (req.method === 'PATCH') {
      const { total } = await leerCuerpo(req);
      await db.escribir('actualizar factura', { op: 'actualizar', tabla: 'facturas', id, valores: { total: Number(total) } });
      const factura = await porId('copia', 'facturas', id);
      return enviar(res, 200, factura);
    }
  }

  // Pagar: revisa en la COPIA si ya estaba pagada. Dos clics seguidos cobran dos veces.
  if (req.method === 'POST' && url.pathname === '/api/pagos') {
    const { facturaId } = await leerCuerpo(req);
    const factura = await porId('copia', 'facturas', Number(facturaId));
    if (!factura) return enviar(res, 404, { error: 'no existe' });
    if (factura.pagada) return enviar(res, 409, { error: 'ya estaba pagada' });
    const pago = await db.escribir('insertar pago', { op: 'insertar', tabla: 'pagos', fila: { facturaId: factura.id, monto: factura.total } });
    await db.escribir('marcar factura pagada', { op: 'actualizar', tabla: 'facturas', id: factura.id, valores: { pagada: true } });
    return enviar(res, 201, { pagoId: pago.id, monto: factura.total });
  }

  // Reporte de ventas del mes: consulta pesada, y corre en la PRINCIPAL.
  if (req.method === 'GET' && url.pathname === '/api/reportes/ventas') {
    const r = await db.principal.consulta('reporte de ventas', 'lectura', 150, t => {
      const porCuenta = {};
      for (const f of t.facturas) porCuenta[f.cuentaId] = (porCuenta[f.cuentaId] || 0) + f.total;
      return { cuentas: Object.keys(porCuenta).length, total: Object.values(porCuenta).reduce((a, b) => a + b, 0) };
    });
    return enviar(res, 200, r);
  }

  // Tablero (dashboard): también en la PRINCIPAL.
  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    const r = await db.principal.consulta('dashboard', 'lectura', 60, t => ({
      facturas: t.facturas.length,
      pendientes: t.facturas.filter(f => !f.pagada).length,
      pagos: t.pagos.length,
    }));
    return enviar(res, 200, r);
  }

  // ---- Solo para practicar en local ----
  if (req.method === 'GET' && url.pathname === '/debug/estadisticas') {
    return enviar(res, 200, { retrasoCopiaMs: db.RETRASO_MS, bases: [db.principal.resumen(), db.copia.resumen()] });
  }
  if (req.method === 'POST' && url.pathname === '/debug/copia') {
    const { caida } = await leerCuerpo(req);
    db.copia.caida = Boolean(caida);
    return enviar(res, 200, { copiaCaida: db.copia.caida });
  }

  enviar(res, 404, { error: 'no encontrado' });
}

const servidor = http.createServer((req, res) => {
  manejar(req, res).catch(err => enviar(res, 500, { error: err.message }));
});

if (require.main === module) {
  const puerto = Number(process.env.PORT || config.puerto);
  servidor.listen(puerto, '127.0.0.1', () => {
    console.log(`Facturas con Copia en http://localhost:${puerto} (retraso de la copia: ${db.RETRASO_MS} ms)`);
  });
}

module.exports = servidor;
