// Configuración de la demo. En local todo vive en memoria (db.js).
// Las direcciones de producción son de ejemplo: NO existen y ninguna herramienta debe conectarse a ellas.
module.exports = {
  puerto: 4500,
  produccion: {
    principal: process.env.DATABASE_URL || 'postgres://app:prod-ejemplo-9f3k@db-principal.prod.ejemplo.test:5432/facturas',
    copias: [process.env.DATABASE_REPLICA_URL || 'postgres://app:prod-ejemplo-9f3k@db-copia-1.prod.ejemplo.test:5432/facturas'],
    pool: { max: 200 }, // una conexión por petición, sin agrupador de conexiones
  },
};
