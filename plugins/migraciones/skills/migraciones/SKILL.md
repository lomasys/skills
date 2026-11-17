---
name: migraciones
description: Use when the user is about to run or deploy database migrations and wants them reviewed (revisar migraciones, ¿es seguro correr esta migración?, migración pendiente), needs to rename, split or change the type of a column or table without downtime (migración sin caída, zero-downtime), has slow queries and suspects missing indexes (índices, consultas lentas, EXPLAIN, pg_stat_statements), finds records pointing to deleted rows (huérfanos, datos basura, orphans), wants unique, not null, foreign key or check rules enforced by the database instead of only the code, wants to know if a backup really restores (respaldo, backup, restore), or needs realistic test data without personal data (datos de prueba, seeds). Rails, Django, Laravel, Prisma, Knex, raw SQL; Postgres and MySQL.
---

# Migraciones

Revisa las migraciones **antes** de que lleguen a producción, parte los cambios grandes en pasos sin caída y encuentra lo que le falta
a la base: índices, reglas, datos huérfanos y un respaldo que de verdad se pueda restaurar.

**Principio:** una migración se juzga por lo que le pasa a producción mientras corre: cuántas filas toca, qué bloquea y qué código
está vivo al mismo tiempo. Lo que no puedas medir sin escribir, dilo como supuesto. No lo "pruebes" en la base del usuario.

## Modos

| Argumento | Qué hace |
|---|---|
| *(nada)* | Revisa las migraciones pendientes y dice si se pueden correr así |
| `plan <cambio>` | Diseña un cambio grande sin caída, paso por paso y despliegue por despliegue ([referencias/sin-caida.md](referencias/sin-caida.md)) |
| `indices` | Propone los índices que faltan, a partir de las consultas reales, con su costo ([referencias/diagnostico.md](referencias/diagnostico.md)) |
| `huerfanos` | Encuentra registros que apuntan a cosas borradas y propone cómo limpiarlos |
| `reglas` | Encuentra reglas que hoy solo vigila el código (únicos, no nulos, llaves foráneas, checks) y cómo ponerlas sin bloquear |
| `respaldo` | Restaura el respaldo en una base nueva y comprueba que sirve ([referencias/respaldo-y-datos.md](referencias/respaldo-y-datos.md)) |
| `datos-prueba [tabla] [n]` | Genera muchos registros parecidos a los reales, sin datos personales |

Ejemplos por framework (cómo ver pendientes y el SQL sin correr nada): [referencias/frameworks.md](referencias/frameworks.md).
Qué operación es peligrosa y su alternativa segura: [referencias/operaciones.md](referencias/operaciones.md).

## Reglas (no negociables)

1. **Nunca corres migraciones ni escribes en producción.** Ni con permiso: entregas el SQL y los pasos; los corre el equipo.
   Leer producción para un diagnóstico solo con permiso explícito, en modo solo lectura y fuera de horas pico.
2. **En local, migraciones solo con permiso.** Tampoco "dentro de una transacción con ROLLBACK": un `CREATE INDEX` o un `ALTER`
   toma los mismos candados aunque después se deshaga, y la base puede ser compartida. Si hace falta medir, pide permiso
   y hazlo en una **copia desechable que tú creaste**.
3. **Diagnóstico siempre de solo lectura.** En la base local de desarrollo no necesitas permiso para leer. Abre la sesión con
   `BEGIN READ ONLY; SET LOCAL statement_timeout = '30s';` (MySQL: `START TRANSACTION READ ONLY`). Nunca `EXPLAIN ANALYZE` de un `INSERT`, `UPDATE` o `DELETE`: lo ejecuta. No crees índices "para probar".
4. **Respaldo y restauración solo hacia una base nueva.** Nombre nuevo con fecha (`restaurada_20261117_1530`), comprueba antes que no existe.
   Nunca `--clean`, `DROP DATABASE`, `dropdb` ni restaurar encima de una base que ya existe. Nunca hacia el servidor de producción.
5. **No cambias código, migraciones ni configuración sin permiso.** Propones el archivo corregido en el reporte.
   Lo escribes solo si el usuario lo pide, uno por uno.
6. **Solo apagas lo que tú prendiste.** Si levantas un contenedor, guarda su id y detén ese. Nunca `docker compose down -v`
   del proyecto ni detengas contenedores por nombre.
7. **Nada destructivo y nada instalado.** Sin `DELETE`, `TRUNCATE` ni `UPDATE` masivos. Sin instalar herramientas sin preguntar.
8. **Sin datos personales ni secretos en el reporte.** Muestra ids y conteos, nunca correos, nombres ni teléfonos.
   Tapa la clave de cualquier cadena de conexión (máximo 4 caracteres).

| Pensamiento | Realidad |
|---|---|
| "La corro con ROLLBACK y mido cuánto tarda" | Bloqueó la tabla mientras corría, y 300 mil filas locales no dicen nada de 40 millones. Estima con el tamaño real. |
| "Creo el índice en local para ver el EXPLAIN" | Eso es escribir. Usa `EXPLAIN` sin `ANALYZE`, o pide permiso para una copia desechable. |
| "Borro los huérfanos y listo" | Pueden ser ventas reales. Primero se entiende por qué existen; borrar lo decide el usuario. |
| "El respaldo existe, entonces sirve" | Solo sirve el que ya restauraste y revisaste. |

## Proceso

1. **Entiende el contexto.** Anota, con la fuente de cada dato:
   - motor y versión (`SELECT version()`, `docker-compose.yml`, configuración del framework);
   - framework y cómo marca las migraciones aplicadas;
   - cómo se despliega: ¿la migración corre antes o después de reiniciar? ¿conviven código viejo y nuevo? ¿cuánto tiempo?
   - tamaño de las tablas en **producción** (documentación, el usuario o una consulta de solo lectura con permiso) y horas pico.
   Si falta el tamaño, pregúntalo una vez; si no hay respuesta, sigue y márcalo como supuesto.
2. **Encuentra lo pendiente sin correr nada:** el comando de estado del framework, o la carpeta contra la tabla de versiones con un `SELECT`.
   Si no hay base a la mano, usa `git diff` contra la rama principal.
3. **Pasa la herramienta** (ruta relativa a esta skill). Es el primer filtro, no el veredicto:
   ```bash
   node <carpeta-de-esta-skill>/scripts/revisar.mjs <migraciones pendientes> --codigo <carpeta del código> [--motor mysql]
   ```
   Termina con código 1 cuando encuentra algo 🔴 o 🟠 (sirve para CI); no es un error. No ve la lógica: una conversión mal hecha o el índice equivocado los encuentras tú.
4. **Lee cada migración y contesta cuatro preguntas**, con evidencia (archivo:línea o una consulta de solo lectura):
   - **¿Pierde datos?** Borrar o renombrar, tipos más chicos, conversiones con `USING`. Comprueba la conversión con un `SELECT`
     (por ejemplo, cuántas filas cambian de valor con el tipo nuevo).
   - **¿Bloquea?** Qué candado toma, sobre qué tabla, de qué tamaño, y un estimado de tiempo con el tamaño de producción.
   - **¿Se puede deshacer?** ¿Tiene reversa? ¿La reversa recupera los datos o solo la estructura?
   - **¿Funciona el código durante el despliegue?** Busca cada columna tocada en el código, incluido el que sigue corriendo
     mientras se despliega, los trabajos en segundo plano y los reportes.
5. **Propón la versión segura** de cada migración riesgosa y, si hace falta, el plan por despliegues ([referencias/sin-caida.md](referencias/sin-caida.md)).
   Di cómo sacar del despliegue la que no debe correr ([referencias/frameworks.md](referencias/frameworks.md#posponer-una-migración)).
   Los tiempos y tamaños estimados por fórmula son válidos: márcalos como estimados.
6. **Entrega el reporte.** Termina con la lista de lo que hiciste en la base (todo de solo lectura).

En los modos `indices`, `huerfanos`, `reglas`, `respaldo` y `datos-prueba` haz el paso 1 y sigue la receta de su referencia.

## Reporte

Las partes, en este orden:

**1. Veredicto.** Una línea: **No la corras así** / **Córrela con cambios** / **Se puede correr**, y la razón en palabras de negocio.

**2. Tabla de pendientes.**

| Migración | ¿Pierde datos? | ¿Bloquea? | ¿Se deshace? | ¿Código viejo y nuevo funcionan? | Veredicto |
|---|---|---|---|---|---|

**3. Detalle**, de la más grave a la menos grave, solo las que tienen riesgo. Formato exacto:

```markdown
### 🔴 <archivo>: <qué le pasa al negocio>
`<archivo>:<línea>` · `<sentencia>`

- **Qué pasa:** <en una o dos frases, con clientes, dinero y tiempo>
- **Lo comprobé:** <búsqueda en el código o consulta de solo lectura> → <resultado>
- **Cuánto bloquea:** <tabla, tamaño en producción, candado, estimado> (o "sin dato de tamaño: supuesto")
- **Se puede deshacer:** <sí / no / solo la estructura>
- **Mejor así:** <SQL o migración propuesta, corta>
```

Gravedad: 🔴 **Grave** (pierde datos o tumba la app) · 🟠 **Alta** (bloquea una tabla grande) · 🟡 **Media** (depende del tamaño o la versión) · ⚪ **Baja**.

**4. Plan por despliegues** (si hace falta): tabla `Despliegue | Migración | Cambio en el código | Cómo saber que salió bien`.

**5. Supuestos y sin comprobar.** Lo que dependió de datos que no tenías.

**6. Lo que hice en la base.** Cada consulta o comando, todos de solo lectura. Si no tocaste ninguna base, dilo.

**7. Siguiente paso.** Una pregunta: *"¿Escribo las migraciones corregidas? Empiezo por la #1."*

Los otros modos usan el mismo esqueleto (veredicto, hallazgos con el formato de su referencia, supuestos, lo que hice, siguiente paso).
Si el usuario pide varios modos, un solo reporte: un veredicto y una sección de hallazgos por modo. Lo grave que veas de paso fuera
del modo (por ejemplo, una migración pendiente peligrosa) va en una sección corta "Aparte".

## Errores comunes

- **Revisar solo el código nuevo.** Durante el despliegue también corre el viejo, y es el que se cae al borrar o renombrar.
- **Medir en local y llevarlo a producción.** Un índice de 0.3 segundos en local puede ser media hora en producción. Estima con el tamaño real.
- **`CONCURRENTLY` dentro de una transacción.** Falla. Rails, Django y Knex abren una por defecto: hay que apagarla en esa migración.
- **Olvidar `lock_timeout`.** Una migración "instantánea" que espera un candado detiene todas las consultas detrás de ella.
- **Un índice por cada columna del `WHERE`.** Cada índice cuesta disco y hace más lenta cada escritura. Propón pocos, con su costo.
- **Tratar "pendiente" como "inofensiva".** Una migración segura (por ejemplo, una columna opcional) también se dice: así el usuario sabe qué sí puede correr.
