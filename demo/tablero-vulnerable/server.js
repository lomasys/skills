// Tablero Vulnerable: app de demostración con hoyos de seguridad A PROPÓSITO.
// Sirve para ver la skill "seguridad" trabajar. NUNCA la publiques en internet.
// Corre sin instalar nada:  node server.js   →  http://localhost:4300
const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const config = require('./config');
const db = require('./db');

const sessions = new Map(); // token → userId

function send(res, status, body, headers = {}) {
  const isText = typeof body === 'string';
  res.writeHead(status, { 'Content-Type': isText ? 'text/html; charset=utf-8' : 'application/json', ...headers });
  res.end(isText ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

function currentUser(req) {
  const cookie = req.headers.cookie || '';
  const token = (cookie.match(/session=([^;]+)/) || [])[1];
  const userId = token && sessions.get(token);
  return userId ? db.users.find(u => u.id === userId) : null;
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  // Login. Sin límite de intentos; la cookie no es HttpOnly ni SameSite.
  if (req.method === 'POST' && url.pathname === '/login') {
    const { email, password } = await readBody(req);
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) return send(res, 401, { error: 'credenciales inválidas' });
    const token = crypto.randomBytes(16).toString('hex');
    sessions.set(token, user.id);
    return send(res, 200, { ok: true, name: user.name }, { 'Set-Cookie': `session=${token}; Path=/` });
  }

  // Webhook de pagos. No valida la firma ni evita procesar dos veces el mismo evento.
  if (req.method === 'POST' && url.pathname === '/webhooks/pagos') {
    const event = await readBody(req);
    const account = db.accounts.find(a => a.id === event.accountId);
    if (account && event.type === 'pago.completado') account.credits += Number(event.amount || 0);
    return send(res, 200, { received: true });
  }

  // Redirección abierta.
  if (url.pathname === '/salir') {
    return send(res, 302, '', { Location: url.searchParams.get('to') || '/' });
  }

  // Enlace público: id consecutivo, nunca caduca y muestra el correo del dueño.
  if (parts[0] === 'compartir' && parts[1]) {
    const board = db.boards.find(b => b.shareId === Number(parts[1]));
    if (!board) return send(res, 404, { error: 'no existe' });
    const owner = db.users.find(u => u.id === board.ownerId);
    return send(res, 200, { title: board.title, cards: board.cards, ownerEmail: owner.email });
  }

  const user = currentUser(req);
  if (!user) return send(res, 401, { error: 'inicia sesión' });

  // Correcto: solo los tableros de la cuenta del usuario.
  if (req.method === 'GET' && url.pathname === '/api/mis-tableros') {
    return send(res, 200, db.boards.filter(b => b.accountId === user.accountId));
  }

  // Buscador: pinta el texto de búsqueda en HTML sin escapar.
  if (req.method === 'GET' && url.pathname === '/buscar') {
    const q = url.searchParams.get('q') || '';
    const found = db.boards.filter(b => b.accountId === user.accountId && b.title.includes(q));
    return send(res, 200, `<h1>Resultados para ${q}</h1><ul>${found.map(b => `<li>${b.title}</li>`).join('')}</ul>`);
  }

  if (parts[0] === 'api' && parts[1] === 'tableros' && parts[2]) {
    // Busca el tablero solo por id: no revisa que sea de la cuenta del usuario.
    const board = db.boards.find(b => b.id === Number(parts[2]));
    if (!board) return send(res, 404, { error: 'no existe' });
    if (req.method === 'GET') return send(res, 200, board);
    if (req.method === 'PATCH') {
      Object.assign(board, await readBody(req));
      return send(res, 200, board);
    }
  }

  // Solo administradores... según el front. Aquí no se revisa el rol.
  if (req.method === 'DELETE' && parts[0] === 'api' && parts[1] === 'usuarios' && parts[2]) {
    const i = db.users.findIndex(u => u.id === Number(parts[2]) && u.accountId === user.accountId);
    if (i < 0) return send(res, 404, { error: 'no existe' });
    db.users.splice(i, 1);
    return send(res, 200, { deleted: true });
  }

  return send(res, 404, { error: 'ruta desconocida' });
}

if (require.main === module) {
  http.createServer((req, res) => handle(req, res).catch(() => send(res, 500, { error: 'error' })))
    .listen(config.port, '127.0.0.1', () => console.log(`Tablero Vulnerable en http://localhost:${config.port}`));
}

module.exports = { handle, sessions };
