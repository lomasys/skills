# Operaciones riesgosas y su versión segura

Basado en las reglas de [strong_migrations](https://github.com/ankane/strong_migrations) (Rails), que valen igual para cualquier framework,
porque el riesgo está en lo que hace el motor, no en el lenguaje de la migración.

## Las cuatro preguntas

| Pregunta | Qué mirar |
|---|---|
| ¿Pierde datos? | `DROP`, `RENAME`, cambiar a un tipo más chico, `USING` que convierte mal, `UPDATE`/`DELETE` sin `WHERE` |
| ¿Bloquea? | Qué candado toma y por cuánto tiempo (tabla de abajo). Depende del tamaño en producción |
| ¿Se deshace? | Reversa escrita, y si recupera **datos** o solo la estructura (un `DROP COLUMN` se "deshace" con una columna vacía) |
| ¿Funciona el código? | Código viejo y nuevo conviven durante el despliegue; trabajos en segundo plano; reportes y otros servicios que leen la misma base |

## Postgres

| Operación | Qué pasa | Versión segura |
|---|---|---|
| `DROP COLUMN` | Rápido, pero el código que la usa falla. Datos perdidos | 1) desplegar código que no la usa (Rails: `ignored_columns`); 2) borrarla en otro despliegue |
| `RENAME COLUMN` / `RENAME TO` | Rápido, pero el código viejo falla al instante | Columna nueva → escribir en las dos → copiar en lotes → leer de la nueva → borrar la vieja |
| `ALTER COLUMN ... TYPE` | Reescribe la tabla con `ACCESS EXCLUSIVE` (nadie lee ni escribe). Excepciones baratas: `varchar(n)` a más grande o a `text`, `numeric(p,s)` a más precisión con la misma escala | Columna nueva y copia en pasos ([sin-caida.md](sin-caida.md)) |
| `CREATE INDEX` | `SHARE` lock: bloquea escrituras mientras se construye | `CREATE INDEX CONCURRENTLY`, fuera de transacción. Si falla queda `INVALID`: `DROP INDEX CONCURRENTLY` y repetir |
| `DROP INDEX` | `ACCESS EXCLUSIVE` breve | `DROP INDEX CONCURRENTLY` |
| `ADD COLUMN ... DEFAULT x` | Instantáneo en Postgres 11+ si `x` es constante. En 10 o menos, o con default volátil (`gen_random_uuid()`, `random()`, `clock_timestamp()`), reescribe la tabla | Sin default → llenar en lotes → poner default |
| `ADD COLUMN ... NOT NULL` sin default | Falla si hay filas; el código viejo que inserta sin ella falla | Opcional o con default → llenar → `NOT NULL` en pasos |
| `SET NOT NULL` | Recorre toda la tabla con `ACCESS EXCLUSIVE` | 12+: `ADD CONSTRAINT c CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE CONSTRAINT c` → `SET NOT NULL` (ya no recorre) → `DROP CONSTRAINT c` |
| `ADD FOREIGN KEY` | Recorre la tabla con candados en las dos tablas | `... NOT VALID` y en otra migración `VALIDATE CONSTRAINT` (este solo toma `SHARE UPDATE EXCLUSIVE`: no bloquea lecturas ni escrituras) |
| `ADD CHECK` | Recorre la tabla con candado | `NOT VALID` + `VALIDATE CONSTRAINT` |
| `ADD UNIQUE` / `ADD PRIMARY KEY` | Construye el índice con la tabla bloqueada | `CREATE UNIQUE INDEX CONCURRENTLY i` → `ADD CONSTRAINT c UNIQUE USING INDEX i` |
| `UPDATE` / `DELETE` grande en la migración | Una transacción larga: candados en filas, crece el WAL, réplicas atrasadas | Trabajo aparte, lotes de 1 000–10 000 por id, pausa entre lotes |
| `VACUUM FULL`, `CLUSTER`, `LOCK TABLE` | Bloqueo total | `pg_repack` (si ya está instalado) o ventana acordada |
| Cualquier `ALTER TABLE` | Aun siendo instantáneo, espera su candado; mientras espera, **todos** los que llegan después hacen fila | `SET lock_timeout = '5s';` al inicio y reintentar |

## MySQL (InnoDB)

| Operación | Qué pasa | Versión segura |
|---|---|---|
| `ADD COLUMN` | 8.0.12+: `ALGORITHM=INSTANT` (al final de la tabla; en 8.0.29+ en cualquier posición). Antes: copia en línea, lenta pero sin bloquear escrituras | Pon `ALGORITHM=INSTANT` para que falle si no puede |
| `CREATE INDEX` / `ADD INDEX` | En línea desde 5.6 (`ALGORITHM=INPLACE, LOCK=NONE`), pero tarda y atrasa réplicas | Explícito `ALGORITHM=INPLACE, LOCK=NONE`. Tablas enormes: gh-ost o pt-online-schema-change (si ya los tienen) |
| `MODIFY` / `CHANGE` (tipo) | Casi siempre copia la tabla (`ALGORITHM=COPY`): bloquea escrituras | Columna nueva y copia en pasos, o gh-ost |
| `CHANGE old new` | Renombra: el código viejo falla | Igual que renombrar en Postgres |
| `DROP COLUMN` | Reconstruye la tabla (8.0.29+ puede ser instantáneo) y el código viejo falla | Código primero, borrar después |
| `ADD FOREIGN KEY` | Con `foreign_key_checks=1` copia la tabla | Busca huérfanos antes; en tablas grandes gh-ost no soporta llaves foráneas: valora no ponerla en la base |
| DDL en general | MySQL **no** tiene DDL transaccional: si una migración falla a la mitad, lo que ya corrió se queda | Una operación por migración |

`SET SESSION lock_wait_timeout = 5;` es el equivalente de `lock_timeout`.

## Cómo estimar sin escribir

1. **Tamaño real** (con permiso, solo lectura; o lo que diga el usuario):
   - Postgres: `SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;`
   - MySQL: `SELECT table_name, table_rows, ROUND((data_length+index_length)/1024/1024) AS mb FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY mb DESC;`
2. **Orden de magnitud**, dilo siempre como estimado: reescribir o indexar una tabla va de decenas a cientos de MB por segundo
   según el disco. 18 GB son minutos, nunca segundos. Lo que importa es el candado: si bloquea lecturas, la app se cae ese tiempo.
3. **Conversión de datos:** antes de un cambio de tipo, cuenta cuántas filas cambian de valor:
   `SELECT count(*) FROM pedidos WHERE total <> total::integer;` (solo lectura).
4. **Si el usuario quiere medir de verdad:** pide permiso y hazlo en una **copia desechable** (contenedor nuevo con un respaldo
   restaurado, [respaldo-y-datos.md](respaldo-y-datos.md)), nunca en su base de desarrollo ni en una compartida.
