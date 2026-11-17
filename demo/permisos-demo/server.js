// Permisos Demo: app de práctica con fallas de permisos A PROPÓSITO.
// Sirve para ver trabajar la skill "permisos". NUNCA la publiques en internet.
// Corre sin instalar nada:  node server.js   ->  http://localhost:4400
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { crearDatos } = require('./db');
const { crearAlmacen } = require('./almacen');
const { puede } = require('./permisos');

function enviar(res, status, cuerpo, encabezados = {}) {
  const esTexto = typeof cuerpo === 'string';
  res.writeHead(status, { 'Content-Type': esTexto ? 'text/html; charset=utf-8' : 'application/json', ...encabezados });
  res.end(esTexto ? cuerpo : JSON.stringify(cuerpo));
}

function leerCuerpo(req) {
  return new Promise(resolve => {
    let datos = '';
    req.on('data', c => { datos += c; });
    req.on('end', () => { try { resolve(datos ? JSON.parse(datos) : {}); } catch { resolve({}); } });
  });
}

const claveArchivo = doc => `cuenta-${doc.cuentaId}/doc-${doc.id}.txt`;

function crearApp({ almacenDir = path.join(__dirname, 'almacen') } = {}) {
  const db = crearDatos();
  const almacen = crearAlmacen(almacenDir);
  const sesiones = new Map(); // token -> { usuarioId, adminOriginalId }

  for (const doc of db.documentos) {
    almacen.guardar(claveArchivo(doc), doc.texto);
    db.indice.push({ cuentaId: doc.cuentaId, docId: doc.id, texto: `${doc.titulo} ${doc.texto}` });
  }
  for (const c of db.cuentas) {
    db.cache.set(`resumen:${c.id}`, { documentos: db.documentos.filter(d => d.cuentaId === c.id).length });
  }

  function registrar(usuario, accion, objeto) {
    db.auditoria.push({ cuentaId: usuario.cuentaId, usuarioId: usuario.id, accion, objeto, cuando: new Date().toISOString() });
  }

  function sesionDe(req) {
    const token = ((req.headers.cookie || '').match(/sesion=([^;]+)/) || [])[1];
    return token ? sesiones.get(token) : null;
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const partes = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && url.pathname === '/') {
      return enviar(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8'));
    }

    if (req.method === 'POST' && url.pathname === '/login') {
      const { email, password } = await leerCuerpo(req);
      const u = db.usuarios.find(x => x.email === email && x.password === password);
      if (!u) return enviar(res, 401, { error: 'credenciales inválidas' });
      const token = crypto.randomBytes(16).toString('hex');
      sesiones.set(token, { usuarioId: u.id });
      return enviar(res, 200, { ok: true }, { 'Set-Cookie': `sesion=${token}; Path=/; HttpOnly; SameSite=Lax` });
    }

    const sesion = sesionDe(req);
    const yo = sesion && db.usuarios.find(u => u.id === sesion.usuarioId);
    if (!yo) return enviar(res, 401, { error: 'inicia sesión' });

    if (req.method === 'GET' && url.pathname === '/api/yo') {
      return enviar(res, 200, { id: yo.id, nombre: yo.nombre, rol: yo.rol, cuentaId: yo.cuentaId });
    }

    // ---- Documentos ----
    if (partes[0] === 'api' && partes[1] === 'documentos' && !partes[2]) {
      if (req.method === 'GET') {
        if (!puede(yo, 'documentos.ver')) return enviar(res, 403, { error: 'sin permiso' });
        return enviar(res, 200, db.documentos.filter(d => d.cuentaId === yo.cuentaId));
      }
      if (req.method === 'POST') {
        if (!puede(yo, 'documentos.crear')) return enviar(res, 403, { error: 'sin permiso' });
        const { titulo = 'Sin título', texto = '' } = await leerCuerpo(req);
        const doc = { id: db.siguienteId++, cuentaId: yo.cuentaId, titulo, texto };
        db.documentos.push(doc);
        almacen.guardar(claveArchivo(doc), texto);
        db.indice.push({ cuentaId: doc.cuentaId, docId: doc.id, texto: `${titulo} ${texto}` });
        return enviar(res, 201, doc);
      }
    }

    if (partes[0] === 'api' && partes[1] === 'documentos' && partes[2] && partes[2] !== 'exportar') {
      const doc = db.documentos.find(d => d.id === Number(partes[2]) && d.cuentaId === yo.cuentaId);
      if (!doc) return enviar(res, 404, { error: 'no existe' });
      if (req.method === 'GET') {
        if (!puede(yo, 'documentos.ver')) return enviar(res, 403, { error: 'sin permiso' });
        return enviar(res, 200, doc);
      }
      if (req.method === 'PATCH') {
        if (!puede(yo, 'documentos.editar')) return enviar(res, 403, { error: 'sin permiso' });
        const { titulo, texto } = await leerCuerpo(req);
        if (titulo !== undefined) doc.titulo = titulo;
        if (texto !== undefined) { doc.texto = texto; almacen.guardar(claveArchivo(doc), texto); }
        return enviar(res, 200, doc);
      }
      if (req.method === 'DELETE') {
        if (!puede(yo, 'documentos.borrar')) return enviar(res, 403, { error: 'sin permiso' });
        db.documentos.splice(db.documentos.indexOf(doc), 1);
        almacen.borrar(claveArchivo(doc));
        db.indice = db.indice.filter(e => e.docId !== doc.id);
        registrar(yo, 'documentos.borrar', `documento:${doc.id}`);
        return enviar(res, 200, { borrado: true });
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/documentos/exportar') {
      if (!puede(yo, 'documentos.exportar')) return enviar(res, 403, { error: 'sin permiso' });
      const usuarios = db.usuarios.map(u => ({ nombre: u.nombre, email: u.email, rol: u.rol }));
      return enviar(res, 200, { documentos: db.documentos, usuarios });
    }

    if (req.method === 'GET' && url.pathname === '/api/buscar') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const ids = db.indice.filter(e => e.cuentaId === yo.cuentaId && e.texto.toLowerCase().includes(q)).map(e => e.docId);
      return enviar(res, 200, db.documentos.filter(d => ids.includes(d.id)));
    }

    // ---- Usuarios ----
    if (req.method === 'GET' && url.pathname === '/api/usuarios') {
      if (!puede(yo, 'usuarios.ver')) return enviar(res, 403, { error: 'sin permiso' });
      return enviar(res, 200, db.usuarios.filter(u => u.cuentaId === yo.cuentaId).map(u => ({ id: u.id, nombre: u.nombre, rol: u.rol })));
    }

    if (req.method === 'PATCH' && partes[0] === 'api' && partes[1] === 'usuarios' && partes[3] === 'rol') {
      const otro = db.usuarios.find(u => u.id === Number(partes[2]) && u.cuentaId === yo.cuentaId);
      if (!otro) return enviar(res, 404, { error: 'no existe' });
      const { rol } = await leerCuerpo(req);
      if (!['admin', 'editor', 'lector'].includes(rol)) return enviar(res, 400, { error: 'rol inválido' });
      otro.rol = rol;
      return enviar(res, 200, { id: otro.id, rol: otro.rol });
    }

    // ---- Ver como (soporte entra como otro usuario de su cuenta) ----
    if (req.method === 'POST' && partes[0] === 'api' && partes[1] === 'ver-como' && partes[2] && partes[2] !== 'salir') {
      if (!puede(yo, 'ver_como')) return enviar(res, 403, { error: 'sin permiso' });
      const otro = db.usuarios.find(u => u.id === Number(partes[2]) && u.cuentaId === yo.cuentaId);
      if (!otro) return enviar(res, 404, { error: 'no existe' });
      sesion.adminOriginalId = yo.id;
      sesion.usuarioId = otro.id;
      return enviar(res, 200, { ahoraEres: otro.nombre });
    }

    if (req.method === 'POST' && url.pathname === '/api/ver-como/salir') {
      if (sesion.adminOriginalId) { sesion.usuarioId = sesion.adminOriginalId; delete sesion.adminOriginalId; }
      return enviar(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/cuenta/contrasena') {
      const { nueva } = await leerCuerpo(req);
      if (!nueva || nueva.length < 8) return enviar(res, 400, { error: 'mínimo 8 caracteres' });
      yo.password = nueva;
      return enviar(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/api/auditoria') {
      if (!puede(yo, 'auditoria.ver')) return enviar(res, 403, { error: 'sin permiso' });
      return enviar(res, 200, db.auditoria.filter(a => a.cuentaId === yo.cuentaId));
    }

    // ---- Borrar la cuenta completa (el cliente se va) ----
    if (req.method === 'DELETE' && url.pathname === '/api/cuenta') {
      if (!puede(yo, 'cuenta.borrar')) return enviar(res, 403, { error: 'sin permiso' });
      const cuentaId = yo.cuentaId;
      db.documentos = db.documentos.filter(d => d.cuentaId !== cuentaId);
      db.usuarios = db.usuarios.filter(u => u.cuentaId !== cuentaId);
      db.cuentas = db.cuentas.filter(c => c.id !== cuentaId);
      return enviar(res, 200, { borrada: true });
    }

    return enviar(res, 404, { error: 'ruta desconocida' });
  }

  return { handle, db, almacen, sesiones };
}

if (require.main === module) {
  const app = crearApp({ almacenDir: process.env.ALMACEN_DIR || path.join(__dirname, 'almacen') });
  const puerto = Number(process.env.PORT || 4400);
  http.createServer((req, res) => app.handle(req, res).catch(() => enviar(res, 500, { error: 'error' })))
    .listen(puerto, '127.0.0.1', () => console.log(`Permisos Demo en http://localhost:${puerto}`));
}

module.exports = { crearApp };
