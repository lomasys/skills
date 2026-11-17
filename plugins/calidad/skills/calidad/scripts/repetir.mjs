#!/usr/bin/env node
// Repetir: corre el mismo comando de pruebas varias veces y cuenta cuántas falla y cuánto tarda.
// Sirve para encontrar pruebas inestables (fallan al azar) y lentas. Sin dependencias. Node 18 o más nuevo.
//
//   node repetir.mjs [--veces 20] [--pausa ms] [--salida archivo.json] -- <comando de pruebas>
//
// Ejemplos:
//   node repetir.mjs --veces 30 -- node --test test/factura.test.js
//   node repetir.mjs --veces 20 -- npx jest src/carrito.test.ts
//   node repetir.mjs --veces 20 -- bundle exec rspec spec/models/pedido_spec.rb
//   node repetir.mjs --veces 20 -- python -m pytest tests/test_pedidos.py -p no:randomly
//
// Para cada corrida guarda: si pasó, cuánto tardó y, si falló, las líneas del error.
// Al final agrupa los errores por mensaje (así ves si siempre falla igual o de formas distintas).
// Termina con código 1 si alguna corrida falló, 0 si todas pasaron.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const args = process.argv.slice(2);
const corte = args.indexOf('--');
if (corte === -1 || corte === args.length - 1) {
  console.log('Uso: node repetir.mjs [--veces 20] [--pausa ms] [--salida archivo.json] -- <comando de pruebas>');
  process.exit(2);
}
const opciones = {};
for (let i = 0; i < corte; i++) {
  if (args[i].startsWith('--')) opciones[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
}
const comando = args.slice(corte + 1).map(a => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(' ');
const veces = Math.max(1, Math.min(500, Number(opciones.veces || 20)));
const pausa = Number(opciones.pausa || 0);

// Líneas que suelen traer la causa de la falla en los frameworks comunes.
const FUERTES = /(AssertionError|Assertion|Expected|expected:|Received|actual:|Error:|Exception|Timeout|timed out|did not match)/;
const PISTAS = /(assert|expected|expect\(|received|actual|error|fail|failed|falla|✖|not ok|timeout|timed out|E\s{2,})/i;

function correr() {
  return new Promise(resolve => {
    const t0 = Date.now();
    const p = spawn(comando, { shell: true, env: { ...process.env, CI: process.env.CI || '1', FORCE_COLOR: '0', NO_COLOR: '1' } });
    let salida = '';
    p.stdout.on('data', d => { salida += d; });
    p.stderr.on('data', d => { salida += d; });
    p.on('close', codigo => resolve({ codigo, ms: Date.now() - t0, salida }));
    p.on('error', e => resolve({ codigo: -1, ms: Date.now() - t0, salida: String(e) }));
  });
}

function firma(salida) {
  // Resumen corto y estable del error, sin números que cambian en cada corrida (tiempos, ids, folios).
  const todas = salida.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fuertes = todas.filter(l => FUERTES.test(l));
  const lineas = fuertes.length ? fuertes : todas.filter(l => PISTAS.test(l));
  return lineas.slice(0, 3).join(' | ').slice(0, 240) || '(sin mensaje reconocible; revisa la salida completa)';
}

// Para agrupar: quita lo que cambia en cada corrida (tiempos y valores entre comillas).
const grupo = error => error.replace(/\d+(\.\d+)?\s?ms/g, 'Nms').replace(/'[^']*'|"[^"]*"/g, '«valor»');

const corridas = [];
console.log(`Comando: ${comando}`);
console.log(`Corriendo ${veces} veces…`);
for (let i = 0; i < veces; i++) {
  const r = await correr();
  const paso = r.codigo === 0;
  corridas.push({ n: i + 1, paso, codigo: r.codigo, ms: r.ms, error: paso ? undefined : firma(r.salida), salida: paso ? undefined : r.salida.slice(-4000) });
  process.stdout.write(paso ? '.' : 'F');
  if (pausa) await new Promise(s => setTimeout(s, pausa));
}
process.stdout.write('\n\n');

const fallas = corridas.filter(c => !c.paso);
const tiempos = corridas.map(c => c.ms).sort((a, b) => a - b);
const mediana = tiempos[Math.floor(tiempos.length / 2)];
const p95 = tiempos[Math.min(tiempos.length - 1, Math.floor(tiempos.length * 0.95))];
const pct = Math.round((fallas.length / veces) * 1000) / 10;

console.log(`Fallas: ${fallas.length}/${veces} (${pct}%)`);
console.log(`Tiempo: mediana ${mediana} ms · p95 ${p95} ms · mínimo ${tiempos[0]} ms · máximo ${tiempos[tiempos.length - 1]} ms`);
if (fallas.length === 0) console.log(`Veredicto: estable en ${veces} corridas (una falla de 1 en ${veces * 3} todavía podría no haber salido).`);
else if (fallas.length === veces) console.log('Veredicto: falla siempre. No es inestable: está rota (o falta algo en el ambiente).');
else console.log('Veredicto: INESTABLE. Pasa a veces y falla a veces con el mismo código.');

if (fallas.length) {
  const grupos = new Map();
  for (const f of fallas) {
    const g = grupo(f.error);
    if (!grupos.has(g)) grupos.set(g, { ns: [], ejemplos: [] });
    grupos.get(g).ns.push(f.n);
    if (grupos.get(g).ejemplos.length < 3) grupos.get(g).ejemplos.push(f.error);
  }
  console.log('\nErrores agrupados:');
  for (const [g, { ns, ejemplos }] of grupos) {
    console.log(`  ${ns.length}× (corridas ${ns.join(', ')}): ${g}`);
    for (const e of ejemplos) console.log(`     ejemplo: ${e}`);
  }
  console.log(`\nSalida completa de la primera falla (corrida ${fallas[0].n}):\n${fallas[0].salida.split(/\r?\n/).slice(-40).join('\n')}`);
}

if (opciones.salida) {
  fs.writeFileSync(opciones.salida, JSON.stringify({ fecha: new Date().toISOString(), comando, veces, fallas: fallas.length, mediana_ms: mediana, p95_ms: p95, corridas }, null, 2) + '\n');
  console.log(`\nGuardado en ${opciones.salida}`);
}
process.exitCode = fallas.length ? 1 : 0;
