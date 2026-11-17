# Cómo encontrar la causa en el servidor

Cada receta dice **cómo verlo**, **cómo confirmarlo en el código** y **cómo se arregla**, con ejemplos para los stacks más comunes.
Todo se mide contra la app local. Usa lo que el proyecto ya trae; si hace falta instalar algo, pregunta antes.

---

## 1. Lento por qué: separar el tiempo

Para cada ruta lenta necesitas cuatro números: **tiempo total**, **número de consultas**, **tiempo en la base** y **tiempo en llamadas externas**.
Lo que sobra es tiempo en el código.

| Stack | Dónde salen sin instalar nada |
|---|---|
| Rails | `log/development.log`: `Completed 200 OK in 812ms (Views: 20ms \| ActiveRecord: 760ms)` y una línea por consulta |
| Laravel | `DB::enableQueryLog()` + `DB::getQueryLog()` en un tinker o prueba; Telescope o Debugbar si ya están instalados |
| Django | `django.db.connection.queries` con `DEBUG=True`; logger `django.db.backends` en nivel DEBUG; `assertNumQueries` en pruebas |
| Node + Prisma | `new PrismaClient({ log: ['query'] })` o `DEBUG=prisma:query` |
| Node + Knex | `DEBUG=knex:query` |
| Node + Sequelize | `logging: console.log` y `benchmark: true` |
| Node + TypeORM | `logging: ['query']` y `maxQueryExecutionTime` |
| Postgres | `log_min_duration_statement = 0` en la base **local**; `pg_stat_statements` si ya está activo; `EXPLAIN (ANALYZE, BUFFERS)` |
| MySQL | `slow_query_log` con `long_query_time = 0` en la base **local**; `EXPLAIN ANALYZE` |
| Cualquiera | encabezado `Server-Timing` si la app lo manda: la herramienta lo muestra |

Si no hay nada de eso, mide el tiempo total con `medir.mjs` y, **en la copia**, agrega un contador temporal alrededor de la consulta o la llamada sospechosa.

**Cómo leer los números:**

| Lo que ves | Causa probable | Sigue en |
|---|---|---|
| Muchas consultas casi iguales (`WHERE id = 1`, `= 2`, `= 3`…) | N+1 | §2 |
| Pocas consultas, pero una tarda mucho | Falta un índice o la consulta trae de más | §4 |
| Respuesta de cientos de KB o MB | Falta paginar o regresa campos de más | §3 |
| Base rápida, total lento | El código: ciclos dentro de ciclos, ordenar en cada vuelta, serializar de más | §5 |
| Tiempo muerto sin consultas | Llamada a otro servicio (pagos, correo, otra API) | §6 |
| Primer byte rápido, total lento | La respuesta es pesada o se descomprime lento | §3 |

## 2. Consultas repetidas (N+1)

**Busca en el código:** una consulta dentro de un ciclo, o un acceso a una relación dentro de un ciclo o una plantilla
(`pedido.cliente.nombre` dentro de `@pedidos.each`, `{% for p in pedidos %}{{ p.cliente.nombre }}`, `await db.x.findUnique()` dentro de `for`).

**Confírmalo:** el log muestra la misma consulta N veces en una sola petición. Anota el número exacto.

**Herramientas que lo detectan (solo si ya están; si no, pregunta):** Bullet (Rails), `nplusone` o django-debug-toolbar (Django),
`Model::preventLazyLoading()` (Laravel 8+), el log de consultas de Prisma o Knex (Node).

| Stack | Arreglo |
|---|---|
| Rails | `Pedido.includes(:cliente, items: :producto)`; `preload` o `eager_load` si necesitas forzar una forma |
| Django | `select_related('cliente')` para uno-a-uno o muchos-a-uno; `prefetch_related('items__producto')` para listas |
| Laravel | `Pedido::with(['cliente', 'items.producto'])->get()` |
| Prisma | `include: { cliente: true, items: { include: { producto: true } } }` |
| Knex / SQL | un `JOIN`, o juntar los ids y hacer **una** consulta `WHERE id IN (...)` y armar un mapa en memoria |
| GraphQL | DataLoader para juntar las cargas de cada nivel |

**Mide el después:** el número de consultas debe bajar de ~N a una cantidad fija (2–5), sin importar cuántos registros haya.
Compara que la respuesta sea la misma (`comparar` avisa si cambió).

## 3. Listas sin paginar

**Busca:** rutas de lista que regresan todo (`Model.all`, `findMany()` sin `take`, `objects.all()`, `SELECT *` sin `LIMIT`),
pantallas que piden todo y muestran una parte (`.slice(0, 20)` en el front), exportaciones que arman todo en memoria.

**Confírmalo:** `medir.mjs` muestra el peso de la respuesta; cuenta cuántos registros trae y cuántos se muestran.
Si hoy son pocos registros, di cuánto crecerá: una lista que hoy pesa 200 KB con 1,000 filas pesará 2 MB con 10,000.

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| Por cursor (recomendada) | Listas largas, scroll infinito, APIs | `WHERE id > :ultimo ORDER BY id LIMIT 50`; Rails `where('id > ?', x).limit(50)`; Prisma `cursor` + `take` |
| Por página (`OFFSET`) | Pantallas con "página 3 de 20" y pocos miles de filas | Rails `pagy`/`kaminari` si ya están; Django `Paginator`; Laravel `paginate()` |

Reglas del arreglo: **límite máximo en el servidor** (que nadie pida 100,000 con `?limite=`), orden estable (por `id` o fecha + `id`),
y **avisa que cambia el contrato** de la API. Si otros clientes la usan sin parámetros, propón mantener el formato viejo un tiempo.
Regresa solo los campos que la pantalla usa (`select`, `only`, `values`).

## 4. Una consulta lenta

Corre `EXPLAIN ANALYZE` **en la base local** (es solo lectura). Busca `Seq Scan` o `type: ALL` sobre tablas grandes y filtros u órdenes sin índice.
Propón el índice como migración; mide en local con datos de un tamaño parecido al real (créalos si hace falta y dilo).
Avisa que crear un índice en una tabla grande de producción puede bloquearla: en Postgres usa `CREATE INDEX CONCURRENTLY`.

## 5. El código es lo lento

Señales: base rápida, total lento. Busca ciclos dentro de ciclos sobre listas grandes (`find` dentro de `for`),
ordenar o copiar una lista en cada vuelta, convertir a JSON objetos enormes, leer archivos en cada petición, expresiones regulares en ciclos.
Para ubicar la línea, usa el perfilador que ya existe: `node --cpu-prof`, `py-spy` o `cProfile` si están, `rack-mini-profiler` si ya está.
Arreglo típico: un `Map` o diccionario en lugar de buscar en una lista, ordenar una sola vez al final, calcular una vez y guardar.

## 6. Llamadas externas

Busca `fetch`, `axios`, `requests`, `Net::HTTP`, `Http::` dentro de la petición. En local mide su tiempo con un temporizador en la copia.
Arreglos: mandarlas a un trabajo en segundo plano, hacerlas en paralelo si son independientes, guardar el resultado si cambia poco,
y ponerles un tiempo máximo. **Nunca** llames a la API real de pagos o correo para medir: usa el modo de prueba o un simulado.

---

## Si la app no levanta

Intenta los comandos del proyecto (`package.json`, `Procfile`, `docker-compose.yml`, `bin/dev`, README).
Si después de dos intentos no levanta, haz solo revisión de código y pon todo en "Sin medir", con lo que faltó.
