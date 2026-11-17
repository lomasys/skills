// Bot con Herramientas: asistente de práctica con fallas de seguridad A PROPÓSITO, para la skill "probar-bots".
// No usa IA ni claves: un "modelo" de reglas simples (modelo-falso.js) imita a un modelo demasiado obediente.
// Nada sale de tu máquina: el correo es simulado y los datos viven en memoria.
//
// Uso:  node bot.js                         → servidor en http://127.0.0.1:4500
//         POST /chat  {"mensaje": "..."}  con  Authorization: Bearer tok-luis-acme
//         GET  /api/tareas                (las tareas de tu empresa, bien filtradas)
//         GET  /buzon-de-prueba           (correos "enviados" por el bot)
//         POST /reiniciar-demo            (regresa los datos a como estaban)
//       node bot.js "mensaje"             → responde una vez (usuario: variable BOT_TOKEN, por defecto tok-luis-acme)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { datos, reiniciar } = require('./datos');
const { armarPrompt, armarContexto } = require('./prompt');
const herramientas = require('./herramientas');
const modelo = require('./modelo-falso');

const BITACORA = path.join(__dirname, 'bitacora.log');

function chat(token, mensaje) {
  const usuario = datos.usuarios[token];
  if (!usuario) return { status: 401, cuerpo: { error: 'sin sesión' } };

  const sistema = armarPrompt(usuario);
  const contexto = armarContexto(usuario, mensaje);
  const salida = modelo.responder({ sistema, contexto, mensaje, usuario });

  // Falla a propósito: ejecuta lo que pida el modelo, con los argumentos del modelo, sin confirmar nada.
  const usadas = salida.llamadas.map(l => ({ ...l, resultado: herramientas.ejecutar(l.nombre, l.args, { usuario }) }));

  // Falla a propósito: guarda el token y la conversación completa (con teléfonos y diagnósticos) en la bitácora.
  fs.appendFileSync(BITACORA, JSON.stringify({ fecha: new Date().toISOString(), token, mensaje, respuesta: salida.texto, herramientas: usadas }) + '\n');

  return { status: 200, cuerpo: { respuesta: salida.texto, herramientas: usadas } };
}

function enviar(res, status, cuerpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

if (require.main === module) {
  const pregunta = process.argv.slice(2).join(' ');
  if (pregunta) {
    const r = chat(process.env.BOT_TOKEN || 'tok-luis-acme', pregunta);
    console.log(JSON.stringify(r.cuerpo));
  } else {
    const puerto = Number(process.env.PORT || 4500);
    http.createServer((req, res) => {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (req.method === 'GET' && req.url === '/api/tareas') {
        const u = datos.usuarios[token];
        if (!u) return enviar(res, 401, { error: 'sin sesión' });
        return enviar(res, 200, datos.tareas.filter(t => t.empresa === u.empresa));
      }
      if (req.method === 'GET' && req.url === '/buzon-de-prueba') return enviar(res, 200, datos.buzon);
      if (req.method === 'POST' && req.url === '/reiniciar-demo') { reiniciar(); return enviar(res, 200, { ok: true }); }
      if (req.method !== 'POST' || req.url !== '/chat') { res.writeHead(404); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        let mensaje = '';
        try { mensaje = String(JSON.parse(body).mensaje || ''); } catch {}
        const r = chat(token, mensaje);
        enviar(res, r.status, r.cuerpo);
      });
    }).listen(puerto, '127.0.0.1', () => console.log(`Bot con Herramientas en http://127.0.0.1:${puerto}`));
  }
}

module.exports = { chat };
