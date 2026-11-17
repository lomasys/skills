# Presupuesto de velocidad

Un presupuesto es un límite por página o endpoint que **hace fallar una prueba** cuando alguien lo pasa.
Así un N+1 o una librería pesada no vuelve meses después sin que nadie lo note.

## 1. Qué limitar

| Límite | Qué tan estable es | Úsalo para |
|---|---|---|
| **Número de consultas** por petición | Exacto: no cambia entre máquinas | Detener N+1. Es el mejor límite del servidor |
| **Peso de la respuesta** (bytes) | Exacto con los mismos datos | Listas sin paginar, campos de más |
| **Peso del JavaScript** de la primera pantalla | Exacto por build | Librerías nuevas, imports de más |
| **Tiempo p95** | Cambia según la máquina | Solo con margen: 2 a 3 veces lo que mide hoy en local |

Fija cada límite **con números medidos hoy**, nunca inventados: el valor de hoy de un arreglo ya hecho, más un margen pequeño
(consultas: el número exacto; bytes: +20%; tiempo: ×2 o ×3). Si la ruta hoy está mal, el presupuesto se pone con el número **después** del arreglo,
y la prueba se agrega marcada como pendiente hasta que el usuario apruebe el arreglo: se ejecuta y muestra el fallo, pero no rompe la suite.

| Framework | Pendiente |
|---|---|
| `node:test` | `test('…', { todo: 'falta el arreglo #1' }, async () => …)` |
| Jest / Vitest | `test.failing(…)` (o `test.todo` si no hay `failing`) |
| RSpec | `pending 'falta el arreglo #1'` dentro del ejemplo |
| Minitest | `skip 'falta el arreglo #1'` |
| pytest | `@pytest.mark.xfail(strict=True, reason='falta el arreglo #1')` |
| PHPUnit | `$this->markTestIncomplete('falta el arreglo #1')` al final |

Escribe en un comentario de la prueba de dónde salió cada número (fecha, medición, margen).

**El tiempo dentro de las pruebas:** las pruebas del proyecto limitan consultas y bytes, que son exactos.
El tiempo se limita mejor con `medir.mjs --max-p95` (§3) en un paso aparte de CI. Si el usuario lo quiere dentro de la prueba,
calienta 3 peticiones, mide 20, usa el p95 y un margen de ×3.

## 2. La prueba, en el estilo del proyecto

Agrega la prueba con el framework que ya usa el proyecto, en una carpeta o archivo marcado (por ejemplo `test/rendimiento/`).
Córrela y confirma qué pasa hoy: **falla** si la ruta está mal, **pasa** si ya está bien.

| Stack | Contar consultas |
|---|---|
| Rails | `ActiveSupport::Notifications.subscribed(->(*) { n += 1 }, 'sql.active_record') { get '/pedidos' }`, o `assert_queries_count` (Rails 7.2+) |
| Django | `with self.assertNumQueries(4): self.client.get('/pedidos/')` |
| Laravel | `DB::enableQueryLog(); $this->get('/pedidos'); $this->assertLessThanOrEqual(4, count(DB::getQueryLog()));` |
| Node + Prisma | `prisma.$on('query', () => n++)` con `log: [{ emit: 'event', level: 'query' }]` |
| Node + Knex | `knex.on('query', () => n++)` |
| Cualquiera | Si la app manda `Server-Timing` con el conteo, léelo en la prueba |

Ejemplo con `node:test` (Node sin dependencias):

```js
test('pedidos: máximo 5 consultas y 60 KB', async () => {
  const r = await fetch(`${base}/api/pedidos`);
  const cuerpo = await r.text();
  assert.ok(contador.consultas <= 5, `hizo ${contador.consultas} consultas`);
  assert.ok(Buffer.byteLength(cuerpo) <= 60_000, `pesa ${Buffer.byteLength(cuerpo)} bytes`);
});
```

## 3. Con la herramienta de la skill (sin escribir pruebas)

Sirve en CI o a mano, contra la app levantada localmente o en el ambiente de pruebas del CI:

```bash
node medir.mjs medir http://localhost:3000/api/pedidos --n 20 --max-p95 300 --max-bytes 60000
node medir.mjs peso  http://localhost:3000/ --max-js 300000 --max-total 1000000
```

Terminan con código 1 si se pasa algún límite. `--max-bytes` cuenta la respuesta sin comprimir (los datos que arma el servidor);
`--max-js` y `--max-total` cuentan lo que viaja por la red. Pon los dos comandos en un archivo del proyecto (por ejemplo `rendimiento/presupuesto.md`)
con la fecha y los números de hoy, para que el siguiente sepa de dónde salieron.

## 4. Reporte del modo presupuesto

Es el reporte normal de la skill (las secciones que apliquen) más esta tabla, justo después de "Mediciones de hoy":

| Ruta | Límite | Hoy | Prueba | Estado hoy |
|---|---|---|---|---|
| `GET /api/pedidos` | ≤ 5 consultas, ≤ 60 KB | 500 consultas | `test/rendimiento/pedidos.test.js` | ❌ falla (falta el arreglo #1) |
| `GET /api/categorias` | ≤ 1 consulta, p95 ≤ 20 ms | 1 consulta, 4 ms | `test/rendimiento/categorias.test.js` | ✅ pasa |
