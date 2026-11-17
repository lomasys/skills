# Configuración por framework

Cada receta tiene: **configurar** las dos bases, **elegir** a qué base va una consulta, **leer de la principal tras escribir**
(read-your-writes) y **qué pasa si la copia falla**. Son propuestas: se aplican solo con permiso del usuario, una por una,
y siempre con un interruptor para mandar todo a la principal (ver al final).

## Rails (6.1 o más nuevo)

```yaml
# config/database.yml
production:
  primary:
    url: <%= ENV["DATABASE_URL"] %>
  primary_replica:
    url: <%= ENV["DATABASE_REPLICA_URL"] %>
    replica: true                 # Rails no corre migraciones ni escribe aquí
```

```ruby
# app/models/application_record.rb
class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class
  connects_to database: { writing: :primary, reading: :primary_replica }
end
```

- **Elegir base a mano:** `ActiveRecord::Base.connected_to(role: :reading) { Reporte.generar }`. Dentro, una escritura lanza error: así descubres escrituras escondidas.
- **Cambio automático de rol** (genera la configuración con `bin/rails g active_record:multi_db`):
  ```ruby
  # config/initializers/multi_db.rb
  Rails.application.configure do
    config.active_record.database_selector = { delay: 2.seconds }
    config.active_record.database_resolver = ActiveRecord::Middleware::DatabaseSelector::Resolver
    config.active_record.database_resolver_context = ActiveRecord::Middleware::DatabaseSelector::Resolver::Session
  end
  ```
  `GET` y `HEAD` van a la copia; `POST`, `PATCH`, `PUT`, `DELETE` a la principal; y **durante 2 segundos después de una escritura de esa sesión**,
  todo va a la principal. Eso resuelve "guardar y ver" en el navegador. Ajusta `delay` al retraso real medido (p99) más un margen.
- **Lo que el cambio automático NO cubre:**
  - Trabajos en segundo plano (Sidekiq, Active Job): corren fuera de la petición. Si se encolan justo después de guardar y leen de la copia,
    no encuentran el registro. Que lean de la principal (`connected_to(role: :writing)`) o que el trabajo espere/reintente.
  - Un `GET` que escribe (contadores de visitas, "última vez visto") falla con `ActiveRecord::ReadOnlyError`. Muévelo a la principal.
  - APIs sin sesión (tokens): el contexto `Session` no recuerda la escritura. Usa un contexto propio (por ejemplo, por cliente en caché).
- **Si la copia falla:** Rails no cambia solo a la principal. Envuelve las lecturas: `rescue ActiveRecord::ConnectionNotEstablished` →
  repetir con `connected_to(role: :writing)`, o pon un balanceador delante (reader endpoint, PgBouncer/PgCat).

## Django

```python
# settings.py
DATABASES = {
    "default": env.db("DATABASE_URL"),        # principal
    "replica": env.db("DATABASE_REPLICA_URL"),
}
DATABASE_ROUTERS = ["app.db_router.PrincipalCopiaRouter"]
```

```python
# app/db_router.py
import time, threading
_local = threading.local()          # con ASGI usa contextvars en lugar de threading.local
VENTANA = 2.0                       # segundos leyendo de la principal tras escribir

def marcar_escritura():
    _local.ultima_escritura = time.monotonic()

class PrincipalCopiaRouter:
    def db_for_read(self, model, **hints):
        if time.monotonic() - getattr(_local, "ultima_escritura", 0) < VENTANA:
            return "default"
        return "replica"
    def db_for_write(self, model, **hints):
        marcar_escritura()
        return "default"
    def allow_relation(self, obj1, obj2, **hints):
        return True
    def allow_migrate(self, db, app_label, **hints):
        return db == "default"
```

- `threading.local` solo cubre la **misma petición**. Para que "guardar y redirigir" funcione, guarda la hora de la última escritura en la
  sesión o en una cookie con un middleware, y léela en el router (así lo hace el paquete `django-multidb-router` con su "pinning").
- **Trampa:** dentro de `transaction.atomic()` el router **sigue mandando las lecturas a la copia**. Lee con `.using("default")`
  dentro de transacciones y en todo lo de dinero o login.
- Forzar base: `Factura.objects.using("default").get(pk=id)`. Celery: igual que los trabajos de Rails.
- **Si la copia falla:** el router no lo detecta. Opción simple: en `db_for_read` consulta una bandera de salud (actualizada por un chequeo cada pocos segundos) y regresa `"default"` si la copia está mal.

## Laravel

```php
// config/database.php
'pgsql' => [
    'driver' => 'pgsql',
    'read' => [
        'host' => [env('DB_READ_HOST_1'), env('DB_READ_HOST_2')],
    ],
    'write' => [
        'host' => [env('DB_HOST')],
    ],
    'sticky' => true,
    'database' => env('DB_DATABASE'),
    'username' => env('DB_USERNAME'),
    'password' => env('DB_PASSWORD'),
    // ...
],
```

- `sticky => true`: si **en la misma petición** ya se escribió, las lecturas siguientes van a la principal. **No** cubre "guardar, redirigir y leer"
  en la siguiente petición: para eso guarda en la sesión la hora de la última escritura y, durante unos segundos, usa
  `Model::onWriteConnection()` o `DB::connection()->useWritePdo()` en las lecturas de esas pantallas, o con un middleware.
- Forzar principal: `Factura::onWriteConnection()->find($id)`, `DB::table('x')->useWritePdo()->get()`.
- Varias copias: Laravel elige una al azar y, si no conecta, **prueba la siguiente** de la lista; no cae a la principal sola.
  Para eso, agrega la principal al final de `read.host` (acepta la carga extra) o usa un balanceador.
- Colas (`jobs`): igual que en Rails; despacha con `->afterCommit()` y lee de la principal en el trabajo.

## Node

### Prisma (extensión de copias de lectura)

```js
import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';   // pedir permiso antes de instalarla

const prisma = new PrismaClient().$extends(
  readReplicas({ url: [process.env.DATABASE_REPLICA_URL] })  // en versiones nuevas: { replicas: [clienteDeCopia] }; revisa el README de tu versión
);
```

- Lecturas (`findMany`, `findUnique`, `count`…) → copia. Escrituras y `$transaction` → principal.
- Forzar principal: `prisma.$primary().factura.findUnique({ where: { id } })`.
- No tiene ventana de lectura tras escritura ni plan B si la copia falla: hazlo en tu capa de datos (ver abajo).

### Knex

Knex no reparte solo: crea **dos instancias** y elige en tu capa de datos.

```js
const escritura = knex({ client: 'pg', connection: process.env.DATABASE_URL, pool: { min: 0, max: 10 } });
const lectura  = knex({ client: 'pg', connection: process.env.DATABASE_REPLICA_URL, pool: { min: 0, max: 10 } });
```

### Sequelize

```js
const sequelize = new Sequelize(process.env.DB_NAME, null, null, {
  dialect: 'postgres',
  replication: {
    write: { host: process.env.DB_HOST, username: process.env.DB_USER, password: process.env.DB_PASS },
    read: [{ host: process.env.DB_READ_HOST_1, username: process.env.DB_USER, password: process.env.DB_PASS }],
  },
  pool: { max: 10 },
});
```

- Lecturas fuera de transacción → copias (las reparte en turnos). Dentro de una transacción → principal.
- Forzar principal: `Factura.findByPk(id, { useMaster: true })`.

### TypeORM

`replication: { master: {...}, slaves: [{...}] }` en el `DataSource`. Las consultas con `QueryRunner` en modo `"master"` van a la principal.

## Patrón para cualquier stack: una capa que decide

```js
// db.js — la única puerta a la base
const VENTANA_MS = 2000;                       // retraso p99 medido + margen
function baseParaLeer(ctx) {
  if (process.env.LEER_SOLO_DE_PRINCIPAL === '1') return principal;     // interruptor de emergencia
  if (ctx?.ultimaEscritura && Date.now() - ctx.ultimaEscritura < VENTANA_MS) return principal;
  if (!copiaSana()) return principal;          // plan B si la copia falla o va muy atrasada
  return copia;
}
async function escribir(ctx, fn) { const r = await fn(principal); ctx.ultimaEscritura = Date.now(); return r; }
```

- `ctx` sale de la sesión o cookie del usuario (para que dure entre peticiones), no de una variable global.
- `copiaSana()` se actualiza cada pocos segundos: conecta y el retraso (`now() - pg_last_xact_replay_timestamp()` o `Seconds_Behind_Source`) es menor al límite.

## Si la copia falla

| Stack | ¿Cambia solo a otra copia? | ¿Cae a la principal? | Qué agregar |
|---|---|---|---|
| Rails | No | No | `rescue` + `connected_to(role: :writing)`, o balanceador |
| Django | No | No | Bandera de salud en el router |
| Laravel | Sí, entre los `read.host` | No | Poner la principal al final de `read.host` o balanceador |
| Prisma (extensión) | Reparte entre copias, no detecta caídas | No | Capa propia o balanceador |
| Sequelize | Reparte en turnos, no detecta caídas | No | Capa propia o balanceador |
| Balanceador (Aurora reader endpoint, ProxySQL, PgCat) | Sí | Configurable | Revisar su chequeo de salud |

## Interruptor de emergencia

Toda propuesta lleva una forma de **mandar todas las lecturas a la principal sin desplegar código**
(variable de entorno, bandera de configuración o apuntar `DATABASE_REPLICA_URL` a la principal). Si algo sale mal en producción, se apaga en segundos.
