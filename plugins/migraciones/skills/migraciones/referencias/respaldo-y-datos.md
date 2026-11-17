# Respaldo probado y datos de prueba realistas

## Modo `respaldo`

Un respaldo solo sirve si ya se restauró y se revisó. La prueba se hace **siempre en una base nueva**, nunca encima de una existente
y nunca en el servidor de producción.

### 1. Encuentra el respaldo y cómo se hace

Documentación, scripts (`pg_dump`, `mysqldump`, `mariadb-dump`), tareas programadas, el proveedor (RDS, Cloud SQL, Supabase, Neon: snapshots y PITR).
Anota: formato, frecuencia, dónde se guarda, cuánto pesa y desde cuándo no se prueba.
Si es un snapshot del proveedor, la restauración se hace en su consola hacia una **instancia nueva**: entrega los pasos, no la hagas tú.

### 2. Revisa el archivo sin restaurar

```bash
pg_restore --list respaldo.dump > /dev/null && echo "legible"     # formato -Fc
head -c 300 respaldo.sql ; tail -c 300 respaldo.sql                # un dump completo de mysqldump termina en "-- Dump completed"
```
Compara su tamaño con los anteriores: uno mucho más chico es una alarma.

Si no hay archivo de respaldo a la mano o no tienes permiso para crear una base, **no improvises**: el veredicto es
**No lo pude probar**, y entregas los pasos 3 y 4 listos para que el equipo los corra (o para que te den el archivo y el permiso).

### 3. Restaura en una base nueva (con permiso)

Usa un servidor local desechable. Si ya hay una imagen de Postgres o MySQL en Docker, levanta **tu** contenedor y guarda su id;
si no la hay, pregunta antes de descargar nada.

```bash
NUEVA=restaurada_$(date +%Y%m%d_%H%M)
# Postgres
psql -h 127.0.0.1 -p 55999 -U postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$NUEVA'"   # debe salir vacío
createdb -h 127.0.0.1 -p 55999 -U postgres "$NUEVA"
time pg_restore -h 127.0.0.1 -p 55999 -U postgres --no-owner --no-acl -j 4 -d "$NUEVA" respaldo.dump
# MySQL
mysql -h 127.0.0.1 -P 33999 -u root -e "CREATE DATABASE $NUEVA"      # falla si ya existe: así debe ser
time mysql -h 127.0.0.1 -P 33999 -u root "$NUEVA" < respaldo.sql
```

Nunca: `--clean`, `--if-exists` sobre una base con datos, `DROP DATABASE`, `dropdb`, ni `-d` apuntando a una base que ya existía.
Al terminar, la base restaurada **se queda** y le dices al usuario cómo borrarla si quiere; si levantaste un contenedor, detienes ese id.

### 4. Comprueba que sirve

| Prueba | Cómo | Pasa si |
|---|---|---|
| Restauró sin errores | Salida de `pg_restore` / `mysql` | Cero errores (avisos de dueños o permisos se anotan aparte) |
| Tablas completas | Conteo por tabla en la restaurada contra el conteo de la fuente (estadísticas, o lo que diga el usuario) | Iguales o explicables por la hora del respaldo |
| Datos recientes | `max(creado_en)` de las tablas principales | Cerca de la hora del respaldo |
| Esquema al día | Última versión en `schema_migrations` (o equivalente) | Igual a la de producción en esa fecha |
| Estructura | Índices, llaves, secuencias (`SELECT last_value FROM <secuencia>` mayor que `max(id)`) | Todo presente |
| La app arranca | Apunta la app local a la base restaurada en modo lectura y abre 2–3 pantallas | Funcionan |
| Tiempo de recuperación | El `time` del paso 3 | Lo comparas con lo que el negocio aguanta caído |
| Lo que no trae | `pg_dump` no incluye usuarios ni permisos (`pg_dumpall --globals-only`); los archivos subidos viven fuera de la base | Hay un plan para eso |

### 5. Reporte del modo `respaldo`

Veredicto (**Sirve / Sirve con huecos / No sirve / No lo pude probar**), la tabla de pruebas con su resultado, cuánto tardó la restauración,
cuántas horas de datos se perderían con la frecuencia actual, y el comando exacto para repetir la prueba cada mes.

---

## Modo `datos-prueba`

Datos que se parecen a los reales en **forma** (cuántos, cómo se reparten, cuántos nulos, fechas) pero no contienen a ninguna persona real.

### 1. Mide la forma real (solo lectura, sin copiar valores)

```sql
-- Postgres: estadísticas que ya tiene la base
SELECT attname, null_frac, n_distinct, most_common_vals FROM pg_stats WHERE tablename = 'pedidos';
SELECT estado, count(*) FROM pedidos GROUP BY estado;                         -- reparto de valores
SELECT width_bucket(total, 0, 10000, 10), count(*) FROM pedidos GROUP BY 1;     -- reparto de montos
SELECT percentile_cont(array[0.5, 0.9, 0.99]) WITHIN GROUP (ORDER BY n) FROM (SELECT count(*) n FROM pedidos GROUP BY cliente_id) s;  -- pedidos por cliente
```
No muestres `most_common_vals` de columnas con datos personales (correos, nombres, teléfonos, direcciones).

### 2. Genera con esa forma

- **Personas:** nombres de una lista ficticia o "Cliente 123", correos `@ejemplo.test`, teléfonos con `0000`, documentos con formato válido pero inventados.
- **Repartos:** la misma proporción de estados, de nulos y de "clientes con muchos pedidos" (pocos clientes con muchos, muchos con pocos).
- **Fechas:** repartidas en el mismo rango, con más actividad en las horas pico si importa para la prueba.
- **Casos raros a propósito:** textos largos, acentos y eñes, emojis, montos en cero, nulos donde la base los permite.
- **Repetible:** semilla fija (`setseed(0.42)` en Postgres, `faker.seed(42)`, `Faker::Config.random = Random.new(42)`).

Postgres (rápido, sin herramientas extra):
```sql
SELECT setseed(0.42);
INSERT INTO clientes (nombre, email, creado_en)
SELECT 'Cliente ' || g, CASE WHEN random() < 0.02 THEN NULL ELSE 'cliente' || g || '@ejemplo.test' END,
       now() - random() * interval '730 days'
FROM generate_series(1, 100000) g;
```
MySQL 8: `WITH RECURSIVE` para generar la serie, o un script por lotes. Rails: `insert_all` en lotes con Faker (si ya está en el Gemfile).
Django: `bulk_create(batch_size=5000)`. Laravel: factories con `->count(n)->create()` en lotes. Node: lotes de `INSERT ... VALUES` de 1 000 filas.

### 3. Dónde se cargan

Solo en una base local o de pruebas que el usuario indique, **con permiso**, y nunca en una base con datos reales que alguien use.
Entrega el script en el proyecto (por ejemplo `db/datos-prueba.sql` o un seed) para que se pueda repetir; escríbelo solo si el usuario lo pide.

**Nunca** copies datos reales "anonimizados a mano": un correo con el dominio cambiado o un nombre con iniciales sigue siendo dato personal.
