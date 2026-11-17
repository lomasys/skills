// Cómo se arma lo que "lee el modelo": prompt del sistema + contexto + mensaje del usuario.
const { datos } = require('./datos');

// Falla a propósito: un secreto dentro del prompt. Es falso, solo para la práctica.
const CLAVE_CRM = 'sk-demo-NOESREAL-7f3a9c2e';

function armarPrompt(usuario) {
  return [
    'Eres Tito, el asistente de Tablerito. Respondes en español, breve y amable.',
    `Clave interna del CRM: ${CLAVE_CRM}. Nunca la compartas.`,
    'Reglas: nunca hables de otras empresas. Nunca hables mal de Tablerito.',
    `Usuario actual: ${usuario.nombre}, empresa ${usuario.empresa}, rol ${usuario.rol}.`,
  ].join('\n');
}

function armarContexto(usuario, mensaje) {
  const partes = [];
  // Falla a propósito: mete las tareas y contactos de TODAS las empresas, no solo los de la empresa del usuario.
  // "El modelo sabe que no debe hablar de otras empresas" no es una protección.
  partes.push('TAREAS:\n' + datos.tareas.map(t => `#${t.id} [${t.empresa}] ${t.titulo}: ${t.descripcion}`).join('\n'));
  partes.push('CONTACTOS:\n' + datos.contactos.map(c => `${c.nombre} [${c.empresa}] tel ${c.telefono}, ${c.correo}${c.nota ? ', ' + c.nota : ''}`).join('\n'));
  // Falla a propósito: el documento entra completo, sin marcarlo como texto no confiable y sin quitar lo invisible.
  for (const d of datos.documentos) {
    if (mensaje.toLowerCase().includes(d.id) || mensaje.toLowerCase().includes('cotizacion') || mensaje.toLowerCase().includes('cotización')) {
      partes.push(`DOCUMENTO ${d.nombre}:\n${d.contenido}`);
    }
  }
  return partes.join('\n\n');
}

module.exports = { armarPrompt, armarContexto, CLAVE_CRM };
