// Quién puede hacer qué. El servidor pregunta con puede(usuario, accion).
const reglas = {
  'documentos.ver': ['admin', 'editor', 'lector'],
  'documentos.crear': ['admin', 'editor'],
  'documentos.editar': ['admin', 'editor'],
  'documentos.borrar': ['admin'],
  'documentos.exportar': ['admin', 'editor'],
  'usuarios.ver': ['admin', 'editor', 'lector'],
  'usuarios.cambiar_rol': ['admin'],
  'auditoria.ver': ['admin'],
  'ver_como': ['admin'],
  'cuenta.borrar': ['admin'],
};

function puede(usuario, accion) {
  return Boolean(usuario && (reglas[accion] || []).includes(usuario.rol));
}

module.exports = { reglas, puede };
