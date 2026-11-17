# Diagnóstico de solo lectura: índices, huérfanos y reglas

## Antes de cualquier consulta

1. Confirma a qué base apuntas (host, puerto, nombre). Si no es local y el usuario no lo autorizó explícitamente, **para**.
2. Abre una sesión de solo lectura con límite de tiempo:

```sql
-- Postgres
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';
-- ... consultas ...
ROLLBACK;

-- MySQL
SET SESSION MAX_EXECUTION_TIME = 30000;   -- milisegundos, solo SELECT
START TRANSACTION READ ONLY;
-- ... consultas ...
ROLLBACK;
```

Con `psql`: `PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=30s' psql ...` cubre toda la sesión.

3. `EXPLAIN` sin `ANALYZE` no ejecuta nada. `EXPLAIN ANALYZE` **ejecuta** la consulta: úsalo solo con `SELECT`, dentro de la sesión de solo lectura.
4. En producción (con permiso): fuera de horas pico, consultas con `LIMIT`, y conteos sobre tablas enormes con `TABLESAMPLE` o con las estadísticas
   (`pg_stat_user_tables.n_live_tup`) en lugar de `count(*)`.

---

## Modo `indices`

**Fuentes de consultas reales**, en este orden:
1. `pg_stat_statements` si está activo (con permiso): las que más tiempo **total** consumen, no solo las más lentas.
   ```sql
   SELECT calls, round(total_exec_time) AS ms_total, round(mean_exec_time,1) AS ms_prom, rows, left(query, 200)
   FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
   ```
   MySQL: `performance_schema.events_statements_summary_by_digest` ordenado por `SUM_TIMER_WAIT`.
2. Logs de consultas lentas (`log_min_duration_statement`, slow query log de MySQL): agrupa por consulta normalizada y cuenta.
3. El código: las pantallas y trabajos más usados (`WHERE`, `JOIN`, `ORDER BY`, `LIMIT`).

**Por cada consulta:** `EXPLAIN` (sin `ANALYZE` si no es `SELECT`). Señales: `Seq Scan` sobre una tabla grande con pocas filas de salida,
`Sort` antes de un `LIMIT`, `Rows Removed by Filter` enorme, `Nested Loop` con `Seq Scan` adentro.

**Cómo elegir el índice:**
- Igualdades primero, luego el rango o el `ORDER BY`: `WHERE cliente_id = ? ORDER BY creado_en DESC LIMIT 20` → `(cliente_id, creado_en DESC)`.
- Columna con pocos valores (estado, booleano): índice **parcial** para el valor raro: `ON pedidos (creado_en) WHERE estado = 'nuevo'`.
- `lower(email) = lower(?)` necesita índice de expresión `(lower(email))`; un índice en `email` no sirve.
- Columna de llave foránea sin índice: hace lentos los `JOIN` y cada borrado del padre.
- Antes de proponer, revisa los índices existentes (`\d tabla`, `SHOW INDEX FROM tabla`): quizá falta solo una columna en uno que ya existe.

**Costo de cada índice** (siempre en el reporte):
- **Disco:** aproximado = filas × (ancho de las columnas + ~20 bytes). Si puedes medirlo en una copia desechable, mejor.
- **Escrituras:** cada `INSERT` y cada `UPDATE` de esas columnas también escribe el índice. En tablas de mucha escritura, pocos índices.
- **Construcción:** con `CONCURRENTLY` no bloquea, pero lee la tabla dos veces; en tablas grandes, minutos u horas. Fuera de horas pico.

**Índices que sobran** (también ahorran):
```sql
SELECT s.relname AS tabla, s.indexrelname AS indice, s.idx_scan, pg_size_pretty(pg_relation_size(s.indexrelid)) AS tamano
FROM pg_stat_user_indexes s JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique ORDER BY pg_relation_size(s.indexrelid) DESC;
```
`idx_scan = 0` solo vale si las estadísticas tienen semanas y se revisan **todas** las réplicas.

**Formato de cada hallazgo:**

```markdown
### 🟠 "Mis pedidos" lee toda la tabla de pedidos en cada visita
`src/pedidos.js:5` · `WHERE cliente_id = $1 ORDER BY creado_en DESC LIMIT 20` · 2.3 s en el log, 8 veces en una hora

- **Lo comprobé:** `EXPLAIN` → Seq Scan sobre pedidos + Sort
- **Índice:** `CREATE INDEX CONCURRENTLY pedidos_cliente_fecha ON pedidos (cliente_id, creado_en DESC);`
- **Costo:** ~1.2 GB en producción (42 M filas × ~28 bytes) · cada pedido nuevo escribe un índice más · construcción: minutos, sin bloqueo
- **Mejora esperada:** de leer la tabla completa a leer ~20 filas
```

---

## Modo `huerfanos`

1. **Encuentra las relaciones**, declaradas o no:
   - declaradas: `information_schema.table_constraints` con `constraint_type = 'FOREIGN KEY'`;
   - implícitas: columnas `*_id` sin llave foránea, y las asociaciones del código (`belongs_to`, `ForeignKey`, `belongsTo`, `@relation`).
   Incluye las polimórficas (`*_type` + `*_id`) y los borrados lógicos (`deleted_at`): un hijo de un padre "borrado" también es huérfano.
2. **Cuenta** con una consulta por relación (solo lectura):
   ```sql
   SELECT count(*) AS huerfanos, count(DISTINCT h.cliente_id) AS padres_faltantes, min(h.id), max(h.id)
   FROM pedidos h WHERE h.cliente_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM clientes p WHERE p.id = h.cliente_id);
   ```
   (Igual en MySQL.) Agrega lo que le importa al negocio: ¿hay pedidos vivos (`estado = 'nuevo'`)? ¿cuánto dinero suman?
3. **Busca la causa** en el código: el borrado que no revisa hijos (`DELETE FROM clientes` sin `dependent:`, `on_delete`, cascada), importaciones, scripts manuales.
4. **Propón la limpieza, no la hagas.** Opciones, de la más segura a la menos:
   - recuperar los padres desde un respaldo (y de paso se prueba el respaldo);
   - crear un padre de reemplazo ("Cliente eliminado") y apuntar ahí;
   - marcar los hijos como archivados;
   - borrar los hijos, en lotes, después de guardarlos aparte. Solo si el usuario lo decide.
   Junto con la limpieza, la regla que evita que vuelva a pasar (modo `reglas`).

**Formato de cada hallazgo:** `### 🔴 <cuántos> <hijos> apuntan a <padres> borrados` con relación, conteo, ejemplos de **ids** (máximo 5, sin datos personales),
qué ve el cliente por esto, causa en el código (`archivo:línea`) y las opciones de limpieza.

---

## Modo `reglas`

1. **Lista lo que vigila el código:** `validates :email, uniqueness: true`, `presence: true`, `unique=True`/`null=False` en modelos que
   no se reflejan en la base, `Rule::unique`, revisiones tipo "si ya existe, error" antes de insertar, listas de valores permitidos (`estado in [...]`).
2. **Compáralo con la base:** `\d tabla` o `information_schema.table_constraints` y `pg_indexes` / `SHOW INDEX`.
3. **Cuenta cuántas filas violan cada regla hoy** (solo lectura): repetidos (`GROUP BY lower(email) HAVING count(*) > 1`),
   nulos, valores fuera de la lista, huérfanos. Una regla con violaciones no se puede validar hasta limpiar.
4. **Explica por qué el código no basta:** dos peticiones al mismo tiempo pasan la revisión y las dos insertan; scripts y consolas no pasan por el código.
5. **Propón cómo ponerla sin bloquear** ([operaciones.md](operaciones.md)):

| Regla | Postgres | MySQL |
|---|---|---|
| Única | `CREATE UNIQUE INDEX CONCURRENTLY` (+ `ADD CONSTRAINT ... USING INDEX` si quieres el nombre de restricción) | `ADD UNIQUE INDEX ..., ALGORITHM=INPLACE, LOCK=NONE` |
| Única sin importar mayúsculas | índice único sobre `(lower(email))` | columna con collation `_ci` o índice funcional (8.0.13+) |
| No nula | `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE` → `SET NOT NULL` | `MODIFY ... NOT NULL` copia la tabla: gh-ost o ventana |
| Llave foránea | `ADD CONSTRAINT ... FOREIGN KEY ... NOT VALID` → `VALIDATE CONSTRAINT` | Copia la tabla; valora si conviene en tablas enormes |
| Check | `ADD CONSTRAINT ... CHECK (...) NOT VALID` → `VALIDATE` | 8.0.16+ respeta `CHECK`; se valida al agregarlo |

Con `NOT VALID` la regla ya protege las filas **nuevas** desde el primer paso; `VALIDATE` revisa las viejas después de limpiarlas.
Di qué cambio necesita el código (por ejemplo, atrapar el error de duplicado y mostrar un mensaje en lugar de un error 500).

**Formato de cada hallazgo:** `### 🟠 <regla que falta, en palabras de negocio>` con dónde la vigila hoy el código (`archivo:línea`),
cuántas filas la violan hoy, el SQL en pasos y el cambio en el código.
