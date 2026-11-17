// Simula una base PRINCIPAL (escribe y lee) y una COPIA (réplica, solo lee) que recibe los cambios con retraso.
// Todo vive en memoria. Cada consulta "cuesta" milisegundos y ocupa uno de los pocos núcleos de su base,
// así que si una base recibe demasiado trabajo, las consultas hacen fila y todo se pone lento.
const RETRASO_MS = Number(process.env.RETRASO_MS || 500);
const NUCLEOS = Number(process.env.NUCLEOS || 4);

const espera = ms => new Promise(r => setTimeout(r, ms));

class Base {
  constructor(nombre) {
    this.nombre = nombre;
    this.tablas = { usuarios: [], cuentas: [], facturas: [], pagos: [] };
    this.caida = false;
    this.activas = 0;
    this.fila = [];
    this.inicio = Date.now();
    this.stats = { lecturas: 0, escrituras: 0, ocupadoMs: 0, consultas: {} };
  }

  async ocupar() {
    if (this.activas < NUCLEOS) { this.activas++; return; }
    await new Promise(r => this.fila.push(r));
    this.activas++;
  }

  liberar() {
    this.activas--;
    const siguiente = this.fila.shift();
    if (siguiente) siguiente();
  }

  // nombre: etiqueta de la consulta (como en pg_stat_statements); costoMs: lo que tarda; fn: la consulta.
  async consulta(nombre, tipo, costoMs, fn) {
    if (this.caida) throw new Error(`la base ${this.nombre} no responde`);
    const t0 = Date.now();
    await this.ocupar();
    try {
      await espera(costoMs);
      if (this.caida) throw new Error(`la base ${this.nombre} no responde`);
      return fn(this.tablas);
    } finally {
      this.liberar();
      const ms = Date.now() - t0;
      this.stats.ocupadoMs += costoMs;
      this.stats[tipo === 'escritura' ? 'escrituras' : 'lecturas']++;
      const c = (this.stats.consultas[nombre] ||= { veces: 0, totalMs: 0, maxMs: 0 });
      c.veces++; c.totalMs += ms; c.maxMs = Math.max(c.maxMs, ms);
    }
  }

  aplicar(cambio) {
    const tabla = this.tablas[cambio.tabla];
    if (cambio.op === 'insertar') tabla.push(structuredClone(cambio.fila));
    if (cambio.op === 'actualizar') {
      const fila = tabla.find(f => f.id === cambio.id);
      if (fila) Object.assign(fila, structuredClone(cambio.valores));
    }
  }

  resumen() {
    const seg = (Date.now() - this.inicio) / 1000;
    const consultas = Object.entries(this.stats.consultas)
      .map(([nombre, c]) => ({ nombre, veces: c.veces, promedioMs: Math.round(c.totalMs / c.veces), maxMs: c.maxMs, totalMs: c.totalMs }))
      .sort((a, b) => b.totalMs - a.totalMs);
    return {
      base: this.nombre,
      caida: this.caida,
      lecturas: this.stats.lecturas,
      escrituras: this.stats.escrituras,
      ocupacionPct: Math.min(100, Math.round((this.stats.ocupadoMs / (seg * 1000 * NUCLEOS)) * 100)),
      enFila: this.fila.length,
      consultas,
    };
  }
}

const principal = new Base('principal');
const copia = new Base('copia');

// Escribir solo en la principal. La copia recibe el mismo cambio RETRASO_MS después (replicación asíncrona).
async function escribir(nombre, cambio) {
  const costo = cambio.op === 'insertar' ? 3 : 2;
  await principal.consulta(nombre, 'escritura', costo, t => {
    if (cambio.op === 'insertar') cambio.fila.id = t[cambio.tabla].length + 1;
    principal.aplicar(cambio);
  });
  const copiaDelCambio = structuredClone(cambio);
  setTimeout(() => copia.aplicar(copiaDelCambio), RETRASO_MS).unref();
  return cambio.fila || null;
}

// Datos iniciales: 500 cuentas (clientes del SaaS) con 80 facturas cada una. Iguales en las dos bases.
function sembrar() {
  for (const base of [principal, copia]) {
    const t = base.tablas;
    t.usuarios.push({ id: 1, email: 'ana@demo.test', password: 'demo123', cuentaId: 1 });
    let id = 1;
    for (let c = 1; c <= 500; c++) {
      t.cuentas.push({ id: c, nombre: `Cuenta ${c}` });
      for (let i = 0; i < 80; i++) {
        t.facturas.push({ id: id++, cuentaId: c, total: 100 + ((id * 37) % 900), pagada: i % 3 === 0, creada: '2026-01-01' });
      }
    }
  }
}
sembrar();

module.exports = { principal, copia, escribir, RETRASO_MS };
