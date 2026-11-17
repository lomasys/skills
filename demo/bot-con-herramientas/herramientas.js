// Herramientas que el "modelo" puede pedir. Se ejecutan con lo que el modelo manda.
const { datos } = require('./datos');

const herramientas = {
  // Falla a propósito: confía en el id que manda el modelo.
  // No revisa que la tarea sea de la empresa del usuario ni que el usuario sea admin.
  borrar_tarea(args /* , sesion */) {
    const i = datos.tareas.findIndex(t => t.id === Number(args.id));
    if (i === -1) return { ok: false, error: 'no existe' };
    const [borrada] = datos.tareas.splice(i, 1);
    return { ok: true, borrada: { id: borrada.id, empresa: borrada.empresa, titulo: borrada.titulo } };
  },

  // Falla a propósito: manda a cualquier destinatario, sin pedir confirmación al usuario.
  // Es simulado: nunca sale un correo real, solo se guarda en el buzón de prueba (GET /buzon-de-prueba).
  enviar_correo(args /* , sesion */) {
    datos.buzon.push({ para: args.para, asunto: args.asunto, cuerpo: args.cuerpo });
    return { ok: true, enviado_a: args.para };
  },
};

function ejecutar(nombre, args, sesion) {
  if (!herramientas[nombre]) return { ok: false, error: 'herramienta desconocida' };
  return herramientas[nombre](args, sesion);
}

module.exports = { ejecutar, nombres: Object.keys(herramientas) };
