# Por framework: ver lo pendiente, ver el SQL y escribirlo seguro

Todos los comandos de "ver" son de solo lectura. **Nunca** corras `migrate`, `db:migrate`, `migrate deploy` ni equivalentes
sin permiso (y nunca contra producción).

| Framework | Pendientes (solo lectura) | SQL que va a correr, sin correrlo |
|---|---|---|
| Rails | `bin/rails db:migrate:status` | Leer la migración; `strong_migrations` (si ya está en el Gemfile) avisa al correr en local |
| Django | `python manage.py showmigrations` · `migrate --plan` | `python manage.py sqlmigrate <app> <número>` |
| Laravel | `php artisan migrate:status` | `php artisan migrate --pretend` |
| Prisma | `npx prisma migrate status` | El archivo `prisma/migrations/<fecha>_<nombre>/migration.sql` |
| Knex | `npx knex migrate:list` | Leer el archivo; `toString()` del builder si hace falta |
| SQL suelto (Flyway, dbmate, golang-migrate, scripts) | Carpeta contra la tabla de versiones: `SELECT * FROM schema_migrations` (o `flyway_schema_history`) | El archivo `.sql` |

Ojo: `migrate:status` y `showmigrations` se conectan a la base que tenga configurada el entorno. Revisa antes `DATABASE_URL` / `.env`
para confirmar que **no** apunta a producción.

## Posponer una migración

Si una pendiente no debe correr en este despliegue, propón sacarla de la rama (o moverla fuera de la carpeta de migraciones) antes de desplegar.
La versión corregida va con un **número o fecha nuevos**: si reusa el de la original, las bases donde la original ya corrió (la laptop
de alguien, staging) la darán por aplicada. Rails, Django, Laravel, Prisma y Knex identifican por nombre completo; scripts propios
pueden identificar solo por el prefijo: léelo.

## Rails (con strong_migrations como referencia)

```ruby
# Índice sin bloquear
class AgregarIndicePedidosCliente < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!
  def change
    add_index :pedidos, [:cliente_id, :creado_en], algorithm: :concurrently
  end
end

# Llave foránea sin bloquear: dos migraciones
add_foreign_key :pedidos, :clientes, validate: false      # 1
validate_foreign_key :pedidos, :clientes                  # 2 (otra migración)

# Borrar columna: primero el modelo, después la migración
class Cliente < ApplicationRecord
  self.ignored_columns += ["telefono"]                    # despliegue 1
end
safety_assured { remove_column :clientes, :telefono, :string }   # despliegue 2

# No nulo sin bloquear (Postgres 12+)
add_check_constraint :clientes, "email IS NOT NULL", name: "clientes_email_nn", validate: false
validate_check_constraint :clientes, name: "clientes_email_nn"   # otra migración
change_column_null :clientes, :email, false
remove_check_constraint :clientes, name: "clientes_email_nn"
```

`strong_migrations` detecta estas reglas al correr migraciones en local. Si el proyecto no lo tiene, **no lo instales**: menciónalo como sugerencia.

## Django

```python
from django.contrib.postgres.operations import AddIndexConcurrently, AddConstraintNotValid, ValidateConstraint

class Migration(migrations.Migration):
    atomic = False   # obligatorio para CONCURRENTLY
    operations = [
        AddIndexConcurrently("pedido", models.Index(fields=["cliente", "-creado_en"], name="pedido_cliente_fecha")),
    ]

# Check sin bloquear (Django 4.0+): AddConstraintNotValid y, en otra migración, ValidateConstraint.
# Llave foránea sin bloquear: RunSQL con "... NOT VALID" y después "VALIDATE CONSTRAINT".

# Borrar un campo: despliegue 1 lo quita del modelo pero no de la base
migrations.SeparateDatabaseAndState(state_operations=[migrations.RemoveField("cliente", "telefono")])
# despliegue 2: RunSQL("ALTER TABLE tienda_cliente DROP COLUMN telefono", reverse_sql=migrations.RunSQL.noop)
```

`RunPython` siempre con `reverse_code` (aunque sea `migrations.RunPython.noop`) y los cambios grandes de datos en lotes, fuera de la migración.

## Laravel

```php
return new class extends Migration {
    public $withinTransaction = false;   // obligatorio para CONCURRENTLY
    public function up(): void {
        DB::statement('CREATE INDEX CONCURRENTLY pedidos_cliente_fecha ON pedidos (cliente_id, creado_en DESC)');
    }
    public function down(): void {
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS pedidos_cliente_fecha');
    }
};
// Llave foránea: DB::statement('ALTER TABLE pedidos ADD CONSTRAINT ... FOREIGN KEY ... NOT VALID') y luego VALIDATE.
// MySQL: DB::statement('ALTER TABLE pedidos ADD INDEX ..., ALGORITHM=INPLACE, LOCK=NONE').
```

`->change()` y `renameColumn` son cambios de tipo y de nombre: aplica [sin-caida.md](sin-caida.md).

## Prisma

Prisma genera el SQL; revísalo **antes** de `prisma migrate deploy`. Para un índice sin bloqueo:
`npx prisma migrate dev --create-only`, edita `migration.sql` para usar `CREATE INDEX CONCURRENTLY` y déjalo solo en ese archivo
(Prisma no envuelve cada migración en una transacción en Postgres, pero un `BEGIN` dentro del archivo sí lo hace).
Cambiar el tipo o renombrar en `schema.prisma` produce `DROP` + `ADD` (pierde datos) o `ALTER TYPE`: revisa el SQL siempre.

## Knex

```js
exports.config = { transaction: false };   // obligatorio para CONCURRENTLY
exports.up = knex => knex.raw('CREATE INDEX CONCURRENTLY pedidos_cliente_fecha ON pedidos (cliente_id, creado_en DESC)');
exports.down = knex => knex.raw('DROP INDEX CONCURRENTLY IF EXISTS pedidos_cliente_fecha');
```

## SQL directo

```sql
-- Postgres: un archivo por índice concurrente, sin BEGIN/COMMIT
SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY IF NOT EXISTS pedidos_cliente_fecha ON pedidos (cliente_id, creado_en DESC);

-- MySQL
SET SESSION lock_wait_timeout = 5;
ALTER TABLE pedidos ADD INDEX pedidos_cliente_fecha (cliente_id, creado_en), ALGORITHM=INPLACE, LOCK=NONE;
```

Si el proyecto tiene su propio script de migraciones (por ejemplo `node migrar.mjs`), léelo: ¿corre cada archivo en una transacción?
¿registra la versión en el mismo paso? ¿a qué base se conecta? Eso decide si `CONCURRENTLY` funciona y qué pasa si falla a la mitad.
