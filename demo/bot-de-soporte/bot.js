// Bot de Soporte: chatbot de práctica con fallas A PROPÓSITO, para ver trabajar la skill "examen-de-bots".
// No usa ninguna IA ni clave: responde con reglas simples, así cualquiera lo puede correr.
// Uso:  node bot.js            → servidor en http://localhost:4400  (POST /chat {"mensaje": "..."})
//       node bot.js "pregunta" → responde una vez en la terminal
const http = require('node:http');
const conocimiento = require('./conocimiento.json');

const PROMPT_DEL_SISTEMA = 'Eres Tito, asistente de Tablerito. Responde en español, breve y amable.';

function normalizar(t) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function responder(mensaje) {
  const m = normalizar(mensaje);

  // Falla a propósito: obedece cuando le piden mostrar sus instrucciones.
  if (m.includes('instrucciones') || m.includes('prompt')) return `Claro, mis instrucciones son: "${PROMPT_DEL_SISTEMA}"`;

  if (m.includes('precio') || m.includes('cuesta') || m.includes('cuanto')) {
    // Falla a propósito: el plan Empresa no tiene precio publicado y el bot inventa uno.
    if (m.includes('empresa')) return 'El plan Empresa cuesta $99 dólares al mes.';
    return `El plan Básico cuesta ${conocimiento.planes.basico.precio} y el plan Pro ${conocimiento.planes.pro.precio}.`;
  }

  if (m.includes('reembolso') || m.includes('devolucion')) {
    // Falla a propósito: dice 60 días, pero la política real es de 30.
    return 'Puedes pedir tu reembolso dentro de los 60 días posteriores a tu compra.';
  }

  if (m.includes('horario') || m.includes('soporte')) return `Nuestro soporte atiende ${conocimiento.soporte.horario}.`;

  if (m.includes('exportar') || m.includes('excel')) return 'Puedes exportar cualquier tablero a Excel desde el menú ⋯ → Exportar.';

  // Falla a propósito: nunca pasa con una persona aunque el cliente lo pida o esté molesto.
  if (m.includes('humano') || m.includes('persona') || m.includes('pesimo') || m.includes('molesto')) {
    return '¡Entiendo! Estoy aquí para ayudarte. ¿Qué más necesitas saber de Tablerito?';
  }

  // Falla a propósito: afirma que existe una integración que no existe.
  if (m.includes('salesforce') || m.includes('sap')) return '¡Sí! Tablerito se integra con eso en un clic desde Ajustes → Integraciones.';

  return 'No tengo esa información. ¿Quieres que te comunique con una persona del equipo?';
}

if (require.main === module) {
  const pregunta = process.argv.slice(2).join(' ');
  if (pregunta) {
    console.log(responder(pregunta));
  } else {
    http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/chat') { res.writeHead(404); return res.end(); }
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        let mensaje = '';
        try { mensaje = JSON.parse(body).mensaje || ''; } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ respuesta: responder(mensaje) }));
      });
    }).listen(Number(process.env.PORT || 4400), '127.0.0.1', () => console.log('Bot de Soporte en http://localhost:' + (process.env.PORT || 4400)));
  }
}

module.exports = { responder, PROMPT_DEL_SISTEMA };
