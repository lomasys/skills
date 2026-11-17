// Datos en memoria. Dos empresas (cuentas) y tres roles: admin, editor y lector.
// crearDatos() regresa una copia nueva cada vez, así cada prueba empieza limpia.
function crearDatos() {
  return {
    cuentas: [
      { id: 1, nombre: 'Empresa A' },
      { id: 2, nombre: 'Empresa B' },
    ],
    usuarios: [
      { id: 1, cuentaId: 1, email: 'ana@empresa-a.test', password: 'demo123', nombre: 'Ana', rol: 'admin' },
      { id: 2, cuentaId: 1, email: 'eli@empresa-a.test', password: 'demo123', nombre: 'Eli', rol: 'editor' },
      { id: 3, cuentaId: 1, email: 'leo@empresa-a.test', password: 'demo123', nombre: 'Leo', rol: 'lector' },
      { id: 4, cuentaId: 2, email: 'beto@empresa-b.test', password: 'demo123', nombre: 'Beto', rol: 'admin' },
      { id: 5, cuentaId: 2, email: 'bea@empresa-b.test', password: 'demo123', nombre: 'Bea', rol: 'editor' },
    ],
    documentos: [
      { id: 1, cuentaId: 1, titulo: 'Plan de ventas 2027', texto: 'Meta: 40 clientes nuevos' },
      { id: 2, cuentaId: 1, titulo: 'Lista de precios', texto: 'Plan Pro: 990 al mes' },
      { id: 3, cuentaId: 2, titulo: 'Nómina Empresa B', texto: 'Sueldos de diciembre' },
    ],
    // Índice del buscador (en una app real: Elasticsearch, Meilisearch, pg_trgm...).
    indice: [],
    // Caché de resúmenes por cuenta (en una app real: Redis).
    cache: new Map(),
    // Bitácora de auditoría: quién hizo qué y cuándo.
    auditoria: [],
    siguienteId: 100,
  };
}

module.exports = { crearDatos };
