# Medir: ¿ya necesitas copias?

Una copia (réplica) solo ayuda si **las lecturas** son las que saturan la base. Si el problema es una consulta sin índice,
demasiadas conexiones o poca memoria, la copia cuesta dinero, agrega retraso y el sistema sigue lento.

## De dónde salen los números

| Ambiente | Quién corre las consultas | Cómo |
|---|---|---|
| Producción | **El usuario**, nunca el agente | Le das el bloque de consultas de abajo para que lo pegue en su consola (son solo lectura) o le pides capturas de su panel |
| Panel del proveedor | El usuario | RDS: *Performance Insights / Database Insights* · Cloud SQL: *Query Insights* · Supabase: *Reports → Query Performance* · Azure: *Query Performance Insight* |
| Staging o local | El agente, con permiso para staging | Las mismas consultas, más una prueba de carga local ([carga.md](carga.md)) |

Pide **una semana** de datos o, al menos, la hora pico. Un promedio del día esconde el problema.

## Postgres (consultas de solo lectura)

```sql
-- 1. Las 15 consultas que más tiempo consumen (requiere pg_stat_statements; si no está activo, NO lo actives en producción: pídelo al usuario)
SELECT calls, round(total_exec_time) AS total_ms, round(mean_exec_time::numeric, 1) AS promedio_ms, rows,
       round(100 * total_exec_time / sum(total_exec_time) OVER (), 1) AS pct_del_tiempo, left(query, 120) AS consulta
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 15;

-- 2. Proporción lectura / escritura por TIEMPO (lo que importa) y por número de llamadas
SELECT CASE WHEN query ~* '^\s*(select|with\s.*select)' THEN 'lectura' ELSE 'escritura/otro' END AS tipo,
       sum(calls) AS llamadas, round(sum(total_exec_time)) AS total_ms,
       round(100 * sum(total_exec_time) / sum(sum(total_exec_time)) OVER (), 1) AS pct_tiempo
FROM pg_stat_statements GROUP BY 1;

-- 3. Conexiones: cuántas hay, en qué estado y el máximo permitido
SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY state;
SHOW max_connections;

-- 4. Tablas grandes que se leen completas (falta un índice)
SELECT relname AS tabla, n_live_tup AS filas, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables WHERE n_live_tup > 10000 ORDER BY seq_tup_read DESC LIMIT 10;

-- 5. ¿Cabe lo que se usa en memoria? (debajo de 99 % → falta memoria)
SELECT round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS pct_en_memoria
FROM pg_statio_user_tables;

-- 6. Transacciones largas (bloquean y estorban a las copias)
SELECT pid, now() - xact_start AS duracion, state, left(query, 80) AS consulta
FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY duracion DESC LIMIT 5;

-- 7. Tamaño total
SELECT pg_size_pretty(pg_database_size(current_database()));
```

## MySQL / MariaDB (solo lectura)

```sql
-- 1. Consultas que más tiempo consumen
SELECT LEFT(DIGEST_TEXT, 120) AS consulta, COUNT_STAR AS llamadas, ROUND(SUM_TIMER_WAIT / 1e12, 1) AS total_s,
       ROUND(AVG_TIMER_WAIT / 1e9, 1) AS promedio_ms, SUM_ROWS_EXAMINED AS filas_revisadas, SUM_NO_INDEX_USED AS sin_indice
FROM performance_schema.events_statements_summary_by_digest ORDER BY SUM_TIMER_WAIT DESC LIMIT 15;

-- 2. Lecturas contra escrituras, conexiones y memoria
SHOW GLOBAL STATUS WHERE Variable_name IN ('Com_select','Com_insert','Com_update','Com_delete',
  'Threads_connected','Max_used_connections','Innodb_buffer_pool_reads','Innodb_buffer_pool_read_requests','Uptime');
SHOW VARIABLES LIKE 'max_connections';

-- 3. Consultas que leen tablas completas
SELECT * FROM sys.statements_with_full_table_scans LIMIT 10;
```

Memoria en MySQL: `1 - Innodb_buffer_pool_reads / Innodb_buffer_pool_read_requests` debajo de 0.99 → falta memoria.

## Del lado de la app

- El log de consultas lentas del framework (Rails: `ActiveRecord` en el log y `rack-mini-profiler`; Django: `django-debug-toolbar`;
  Laravel: `DB::listen` o Telescope; Node: el `logging` del ORM). Busca **N+1**: la misma consulta repetida decenas de veces en una petición.
- El monitoreo que ya tenga (APM): qué rutas tardan más y cuánto de ese tiempo es base de datos.

## Tabla de números (llénala siempre)

| Métrica | Cómo se obtiene | Señal de alarma |
|---|---|---|
| CPU de la principal en hora pico | Panel del proveedor (p95 de 1 minuto, una semana) | > 70 % sostenido |
| % del tiempo de base que son lecturas | Consulta 2 | > 70 % → las copias ayudan; < 50 % → no ayudan |
| % del tiempo en las 5 consultas más pesadas | Consulta 1 | > 50 % → arréglalas primero |
| Tablas grandes leídas completas | Consulta 4 | Tabla > 100 000 filas con `seq_tup_read` alto en una ruta frecuente |
| Conexiones en uso / máximo | Consulta 3 | > 80 % o errores "too many connections" |
| Datos en memoria | Consulta 5 | < 99 % |
| Transacción más larga | Consulta 6 | > 1 minuto en horario normal |

## Qué hacer según los números (en este orden)

| Si ves… | Primero haz… | Por qué no una copia |
|---|---|---|
| Pocas consultas consumen la mitad del tiempo | Índice o reescritura de esas consultas (`EXPLAIN ANALYZE`) | Un índice cuesta $0 y baja esa consulta 10× a 1000× |
| N+1 en las rutas más usadas | `includes`/`select_related`/`with`/`include` | La copia solo reparte el mismo desperdicio |
| Conexiones cerca del máximo | Agrupador de conexiones: PgBouncer (modo *transaction*), RDS Proxy, Supavisor (Supabase), ProxySQL (MySQL), o bajar el `pool` por proceso | Una copia no reduce las conexiones a la principal |
| Datos en memoria < 99 % | Subir memoria (un tamaño más) | Cada copia también necesita esa memoria |
| Escrituras > 50 % del tiempo | Subir tamaño, mandar trabajo a colas, archivar datos viejos; a la larga, repartir clientes ([armar.md](armar.md#cuándo-repartir-clientes-en-varias-bases)) | Las copias repiten todas las escrituras: no alivian nada |
| Reportes pesados que frenan a todos | **Sí**: una copia solo para reportes | Aísla a los clientes de los reportes |
| CPU > 70 % con lecturas > 70 % y lo anterior ya hecho | **Sí**: copias para leer | Es justo el caso para el que sirven |

Subir un tamaño (más CPU y memoria) **también es una respuesta válida**: no cambia código y cuesta parecido a una copia.
Compara las dos opciones con números en el reporte. Hasta 16–32 núcleos, crecer la principal suele ser lo más simple.

## Cómo decirlo

Siempre con números y la fuente: *"El 62 % del tiempo de la base es una sola consulta (`facturas por cuenta`) que lee 40 000 filas
porque no tiene índice (pg_stat_statements, semana del 3 al 10). Con el índice esa consulta debería bajar de ~60 ms a ~1 ms;
después mide otra vez antes de pagar una copia."* Si un número no se pudo medir, escribe **"sin medir"** y qué hace falta.
