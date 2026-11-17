// Asistente de tickets: clasifica cada ticket, manda una bienvenida y hace un resumen para el agente humano.
// Usa un cliente de IA simulado (ia.js), así que corre sin claves ni internet:  node tickets.js
const fs = require('node:fs');
const path = require('node:path');
const ia = require('./ia');

// El manual completo del producto va en TODAS las llamadas, aunque la tarea no lo necesite.
const MANUAL = fs.readFileSync(path.join(__dirname, 'manual.md'), 'utf8');
const SISTEMA = `Eres el asistente de soporte de Tablerito. Este es el manual completo del producto:\n\n${MANUAL}`;

async function llamar(model, pregunta) {
  // Reintenta para siempre si falla. No hay tiempo límite ni límite de tokens de respuesta.
  while (true) {
    try {
      const r = await ia.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SISTEMA },
          { role: 'user', content: pregunta },
        ],
      });
      return r.choices[0].message.content;
    } catch (e) {
      console.error('Falló la IA, reintentando…', e.message);
    }
  }
}

async function clasificar(ticket) {
  // Elegir una de cuatro etiquetas, con el modelo más caro.
  return (await llamar('gpt-4.1', `Clasifica este ticket en facturacion, tecnico, acceso u otro. Responde solo la etiqueta.\n\n${ticket.texto}`)).trim();
}

async function bienvenida() {
  // Siempre es el mismo texto, pero se le pide a la IA en cada ticket.
  return llamar('gpt-4.1', 'Escribe el mensaje de bienvenida estándar para un cliente que abrió un ticket.');
}

async function resumir(ticket) {
  return llamar('gpt-4.1', `Resume este ticket para el agente humano:\n\n${ticket.texto}`);
}

async function procesar(ticket) {
  const categoria = await clasificar(ticket);
  const saludo = await bienvenida();
  const resumen = await resumir(ticket);
  return { id: ticket.id, categoria, saludo, resumen };
}

async function main() {
  const tickets = JSON.parse(fs.readFileSync(path.join(__dirname, 'tickets.json'), 'utf8'));
  for (const t of tickets) {
    const r = await procesar(t);
    console.log(`#${r.id} → ${r.categoria}`);
  }
  const total = ia.uso.reduce((a, u) => ({ entrada: a.entrada + u.entrada, salida: a.salida + u.salida }), { entrada: 0, salida: 0 });
  console.log(`\nLlamadas a la IA: ${ia.uso.length} · tokens de entrada: ${total.entrada} · tokens de salida: ${total.salida}`);
}

if (require.main === module) main();

module.exports = { procesar, clasificar, bienvenida, resumir };
