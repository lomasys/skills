# Migraciones sin caída: expandir y contraer

Un cambio grande se parte en pasos donde **cada despliegue funciona con el código anterior y con el siguiente**.
Si algo sale mal en cualquier paso, se regresa el código sin tocar la base.

## Los pasos

Agregar → copiar en lotes → leer de lo nuevo → dejar de escribir lo viejo → borrar. Para no perder lo que llega mientras tanto,
el código escribe en los dos lugares desde antes de copiar.

| # | Paso | Migración | Código | Se puede regresar |
|---|---|---|---|---|
| 1 | **Agregar** | Columna o tabla nueva, opcional, sin default volátil | Nada todavía | Sí |
| 2 | **Escribir en las dos** | — | Cada escritura llena lo viejo **y** lo nuevo | Sí |
| 3 | **Copiar en lotes** | Trabajo aparte (no migración): llena lo nuevo para las filas viejas | — | Sí |
| 4 | **Leer de lo nuevo** | Ahora sí: `NOT NULL`, índices, llaves (en su versión segura) | Lee de lo nuevo; sigue escribiendo en las dos | Sí |
| 5 | **Dejar de escribir lo viejo** | — | Solo lo nuevo. En Rails: `ignored_columns` con la vieja | Sí, con pérdida de lo escrito desde el paso 5 |
| 6 | **Borrar** | `DROP` de lo viejo, días después, con respaldo probado | — | Solo con el respaldo |

Entre cada despliegue, confirma que funcionó (columna "Cómo saber que salió bien" del reporte).

## Plantilla del plan (modo `plan`)

```markdown
**Cambio:** <qué quiere el usuario, en una línea>
**Tablas:** <tabla> (<filas>, <tamaño> en producción) · **Motor:** <versión> · **Despliegue:** <cómo conviven las versiones>

| Despliegue | Migración | Cambio en el código | Cómo saber que salió bien |
|---|---|---|---|
| 1 | `ADD COLUMN total_centavos bigint` | — | La columna existe; nada más cambia |
| 2 | — | `cobrar()` escribe `total` y `total_centavos` | Pedidos nuevos traen las dos llenas |
| 3 | (trabajo) copiar en lotes | — | `SELECT count(*) WHERE total_centavos IS NULL` = 0 |
| 4 | `CHECK ... NOT VALID` → `VALIDATE` → `SET NOT NULL` | Lecturas usan `total_centavos` | Pantallas muestran lo mismo que antes |
| 5 | — | Ya no escribe `total`; `ignored_columns` | Errores en cero una semana |
| 6 | `DROP COLUMN total` | — | Respaldo restaurado y revisado antes |

**Riesgo de cada paso** y **qué hacer si falla**, en una línea por paso.
```

## Copiar en lotes

Postgres (por rangos de id; cada lote es su propia transacción corta):

```sql
UPDATE pedidos SET total_centavos = round(total * 100)
WHERE id >= :desde AND id < :desde + 5000 AND total_centavos IS NULL;
-- repetir moviendo :desde, con una pausa de 0.1–1 s entre lotes
```

MySQL igual, por rangos de llave primaria. En Rails: `in_batches(of: 5_000) { |r| r.update_all(...) ; sleep 0.1 }`.
En Django: un comando de administración que recorre por `pk__gte`/`pk__lt`. En Laravel: `chunkById(5000, ...)`. En Knex: un script con rangos.

Nunca un solo `UPDATE` de toda la tabla dentro de la migración.

## Recetas

**Renombrar una columna** (`nombre` → `nombre_completo`): pasos 1 a 6 tal cual.

**Cambiar el tipo** (`total numeric` → `total_centavos bigint`): pasos 1 a 6. Comprueba la conversión con un `SELECT` antes del paso 3.

**Borrar una columna:** solo pasos 5 y 6 (código primero, `DROP` después).

**Hacer obligatoria una columna:** llenar los nulos en lotes → `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE` → `SET NOT NULL` → quitar el CHECK.
El código debe mandar siempre el valor **antes** del `VALIDATE`.

**Partir una tabla** (por ejemplo, sacar `direcciones` de `clientes`): tabla nueva (1), escribir en las dos (2), copiar (3),
leer de la nueva (4), dejar de escribir columnas viejas (5), borrarlas (6).

**Cambiar una llave primaria a `bigint`:** columna nueva `id_nuevo bigint`, trigger o escritura doble, copiar en lotes,
índice único `CONCURRENTLY`, y el cambio final en una ventana corta acordada. Es el único caso que suele necesitar ventana: dilo.

## Lo que el plan debe decir siempre

- Qué código va en cada despliegue y en qué orden (migración antes o después de reiniciar).
- Cuánto tiempo esperar entre pasos (al menos un ciclo completo de despliegue; para el `DROP`, días).
- Qué se pierde si hay que regresar en cada paso.
- Que `CONCURRENTLY` va en una migración sin transacción ([frameworks.md](frameworks.md)).
