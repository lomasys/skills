// Archivos adjuntos en disco (en una app real: S3, GCS, Active Storage...).
// Cada documento guarda su archivo en <dir>/cuenta-<id>/doc-<id>.txt
const fs = require('node:fs');
const path = require('node:path');

function crearAlmacen(dir) {
  fs.mkdirSync(dir, { recursive: true });
  function listar(base) {
    return fs.readdirSync(base, { withFileTypes: true }).flatMap(e => {
      const p = path.join(base, e.name);
      return e.isDirectory() ? listar(p) : [path.relative(dir, p).split(path.sep).join('/')];
    });
  }
  return {
    dir,
    guardar(clave, contenido) {
      const p = path.join(dir, clave);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, contenido);
    },
    borrar(clave) {
      fs.rmSync(path.join(dir, clave), { force: true });
    },
    listar: () => listar(dir),
  };
}

module.exports = { crearAlmacen };
