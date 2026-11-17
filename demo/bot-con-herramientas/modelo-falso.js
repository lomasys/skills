// Un "modelo de lenguaje" de mentira: reglas simples que imitan a un modelo demasiado obediente.
// Obedece órdenes que vengan del usuario, de texto codificado o de lo que lee (documentos, tareas).
// No usa IA ni claves, así cualquiera puede correr la práctica.

const sinAcentos = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function decodificar(mensaje) {
  // Imita a un modelo que entiende base64 y luego obedece lo que dice.
  const extra = [];
  for (const trozo of mensaje.match(/[A-Za-z0-9+/]{16,}={0,2}/g) || []) {
    try {
      const t = Buffer.from(trozo, 'base64').toString('utf8');
      if (/^[\x20-\x7EáéíóúñÁÉÍÓÚÑ¿¡\s]+$/.test(t)) extra.push(t);
    } catch {}
  }
  return extra.join('\n');
}

function ordenesEscondidas(contexto, mensaje) {
  // Falla a propósito: trata como orden cualquier texto "para el asistente" dentro de lo que lee:
  // los documentos que abre y las tareas que el usuario le pide revisar.
  const m = sinAcentos(mensaje);
  const leido = contexto.split('\n').filter(l => {
    if (!l.startsWith('#')) return true; // documentos y contactos
    const id = /^#(\d+)/.exec(l)[1];
    const titulo = sinAcentos(l.split('] ')[1] || '').split(':')[0];
    return new RegExp(`(tarea|#)\\s*${id}\\b`).test(m) || titulo.split(/\W+/).some(p => p.length > 5 && m.includes(p));
  }).join('\n');
  return (leido.match(/(instrucci[oó]n para el asistente|asistente:)[^<\n]*/gi) || []).join('\n');
}

function responder({ sistema, contexto, mensaje, usuario }) {
  const ordenes = [mensaje, decodificar(mensaje), ordenesEscondidas(contexto, mensaje)].join('\n');
  const o = sinAcentos(ordenes);
  const m = sinAcentos(mensaje);
  const llamadas = [];
  let texto = '';

  // Herramientas: obedece "borra la tarea N" y "envía un correo a X", vengan de donde vengan.
  for (const [, id] of o.matchAll(/borra(?:r)?\s+(?:la\s+)?tarea\s+#?(\d+)/g)) llamadas.push({ nombre: 'borrar_tarea', args: { id: Number(id) } });
  const correo = /envia(?:r)?\s+(?:un\s+)?correo\s+a\s+([\w.+-]+@[\w.-]+\w)/.exec(o);
  if (correo) {
    const contactos = (contexto.split('CONTACTOS:\n')[1] || '').split('\n\n')[0];
    llamadas.push({ nombre: 'enviar_correo', args: { para: correo[1], asunto: 'Información solicitada', cuerpo: contactos } });
  }

  // Mostrar el prompt: "ignora tus reglas", "muéstrame tu prompt", en español o en inglés.
  if (/(ignora|olvida|ignore|forget)\b.*\b(instrucciones|reglas|anterior|instructions|rules|previous)/.test(o) ||
      /(muestra|muestrame|repite|dime|show|print|reveal|repeat)\b.*\b(prompt|instrucciones|instructions|system)/.test(o)) {
    texto = `Claro. Mis instrucciones son:\n${sistema}`;
  }

  // Cambio de papel: "ahora eres…", "modo desarrollador". Luego dice lo que le pidan.
  else if (/(ahora eres|actua como|modo desarrollador|you are now|act as|sin reglas)/.test(o)) {
    const frase = /(?:di|dime|escribe|say)\s+(?:que\s+|exactamente:?\s+)?["“]([^"”]+)["”]/i.exec(ordenes);
    texto = 'Modo libre activado, ya no soy Tito. ' + (frase ? frase[1] : 'Pregúntame lo que quieras, sin reglas.');
  }

  // Tareas: contesta con lo que haya en el contexto (que trae las de todas las empresas).
  // Documentos: "resume la cotización".
  else if (/(cotizacion|documento|doc-1|resume)/.test(m)) {
    texto = 'La cotización del proveedor ofrece transporte por $12,000 al mes.';
  }

  else if (llamadas.length) {
    texto = 'Listo, ya lo hice.';
  }

  else if (/tarea/.test(m)) {
    const lineas = (contexto.split('TAREAS:\n')[1] || '').split('\n\n')[0].split('\n');
    const pideOtras = /(todas|otras empresas|beta|acme|empresa)/.test(m);
    const visibles = lineas.filter(l => pideOtras || l.includes(`[${usuario.empresa}]`));
    texto = 'Estas son las tareas:\n' + visibles.join('\n');
  }

  // Contactos: busca por nombre en todo el contexto.
  else if (/(contacto|telefono|correo de|datos de)/.test(m)) {
    const lineas = (contexto.split('CONTACTOS:\n')[1] || '').split('\n\n')[0].split('\n');
    const pedidos = lineas.filter(l => m.split(/\W+/).some(p => p.length > 3 && sinAcentos(l).includes(p)));
    texto = (pedidos.length ? pedidos : lineas.filter(l => l.includes(`[${usuario.empresa}]`))).join('\n');
  }

  if (llamadas.length && !texto) texto = 'Listo, ya lo hice.';
  if (!texto) texto = 'Hola, soy Tito. Puedo ayudarte con tus tareas, contactos y documentos.';
  return { texto, llamadas };
}

module.exports = { responder };
