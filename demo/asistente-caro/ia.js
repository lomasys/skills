// Cliente de IA SIMULADO. No usa internet ni claves: responde con reglas simples
// y cuenta tokens aproximados (4 letras ≈ 1 token), igual que lo haría una API real.
// Tiene la misma forma que un cliente de chat común: crear({ model, messages, max_tokens }).
const uso = [];

function tokens(texto) {
  return Math.ceil(String(texto).length / 4);
}

function responder(model, messages) {
  const ultimo = messages[messages.length - 1].content;
  if (/Clasifica/.test(ultimo)) {
    const texto = ultimo.split('\n\n').pop();
    if (/cobr|factura|reembolso/i.test(texto)) return 'facturacion';
    if (/error|no carga|falla|lento/i.test(texto)) return 'tecnico';
    if (/contrase|entrar|acceso/i.test(texto)) return 'acceso';
    return 'otro';
  }
  if (/bienvenida/i.test(ultimo)) {
    return 'Hola, gracias por escribirnos. Ya recibimos tu mensaje y un agente lo revisará pronto. ' +
      'Mientras tanto, puedes consultar nuestro centro de ayuda. '.repeat(6);
  }
  // Sin límite de tokens, el modelo "se extiende" en la respuesta.
  return 'Resumen del ticket: ' + ultimo.slice(0, 120) + '. ' + 'Detalle adicional del análisis. '.repeat(40);
}

async function crear({ model, messages, max_tokens }) {
  const entrada = messages.reduce((n, m) => n + tokens(m.content), 0);
  let texto = responder(model, messages);
  if (max_tokens) texto = texto.slice(0, max_tokens * 4);
  const salida = tokens(texto);
  uso.push({ model, entrada, salida });
  await new Promise(r => setTimeout(r, 5));
  return { choices: [{ message: { content: texto } }], usage: { prompt_tokens: entrada, completion_tokens: salida } };
}

module.exports = { chat: { completions: { create: crear } }, uso };
