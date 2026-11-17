# Docker local: una principal y una copia para probar

Sirve para ver con tus propios ojos el retraso, la caída de una copia y el cambio de principal **en tu máquina**, sin tocar producción.

Antes de empezar:
- Revisa si la imagen ya está descargada (`docker images postgres`). **Descargar una imagen cuenta como instalar: pregunta antes.**
  Si ya hay otra versión (por ejemplo `postgres:17-alpine`), úsala con `IMAGEN_PG=postgres:17-alpine`.
- Usa **siempre** el nombre de proyecto `-p base-miles-prueba`. Así solo apagas y borras lo tuyo.
- Los puertos son `55432` (principal) y `55433` (copia), solo en `127.0.0.1`. Si están ocupados, cámbialos.

## 1. El archivo

Guárdalo como `copias-local/docker-compose.yml` en el proyecto (archivo nuevo; no toques el `docker-compose.yml` del usuario).
Requiere Docker Compose 2.23 o más nuevo (por el bloque `configs.content`).

```yaml
# Principal + copia de Postgres para probar en local. Solo para tu máquina: las contraseñas son de ejemplo.
# Levantar:  docker compose -p base-miles-prueba up -d --wait
# Apagar:    docker compose -p base-miles-prueba down -v   (borra solo los volúmenes de ESTE proyecto)
services:
  principal:
    image: ${IMAGEN_PG:-postgres:17}
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app_local
      POSTGRES_DB: app
    command: >
      postgres -c wal_level=replica -c max_wal_senders=10 -c max_replication_slots=10
               -c wal_keep_size=256MB -c hot_standby=on
    ports: ["127.0.0.1:55432:5432"]
    volumes:
      - datos_principal:/var/lib/postgresql/data
    configs:
      - source: crear_replicador
        target: /docker-entrypoint-initdb.d/10-replicador.sh
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U app -d app"]   # por TCP: no pasa mientras la base se inicializa
      interval: 2s
      start_period: 120s
      retries: 30

  copia:
    image: ${IMAGEN_PG:-postgres:17}
    depends_on:
      principal: { condition: service_healthy }
    user: postgres
    environment:
      PGPASSWORD: replicador_local
    command:
      - bash
      - -c
      - |
        if [ ! -s /var/lib/postgresql/data/PG_VERSION ]; then
          until pg_basebackup -h principal -U replicador -D /var/lib/postgresql/data -R -X stream; do
            echo "esperando a la principal…"; sleep 2
          done
          chmod 0700 /var/lib/postgresql/data
        fi
        exec postgres -c hot_standby=on
    ports: ["127.0.0.1:55433:5432"]
    volumes:
      - datos_copia:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U app -d app"]   # por TCP: no pasa mientras la base se inicializa
      interval: 2s
      start_period: 120s
      retries: 30

configs:
  crear_replicador:
    content: |
      #!/bin/bash
      set -e
      psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "CREATE ROLE replicador WITH REPLICATION LOGIN PASSWORD 'replicador_local';"
      echo "host replication replicador all scram-sha-256" >> "$$PGDATA/pg_hba.conf"

volumes:
  datos_principal:
  datos_copia:
```

Con `postgres:18` o más nuevo la carpeta de datos cambió: monta los volúmenes en `/var/lib/postgresql` y ajusta la ruta de `pg_basebackup`
(`/var/lib/postgresql/18/docker`), o usa la 17.

La app se conecta así (solo local):

```
DATABASE_URL=postgres://app:app_local@127.0.0.1:55432/app
DATABASE_REPLICA_URL=postgres://app:app_local@127.0.0.1:55433/app
```

Carga el esquema con las migraciones del proyecto **contra la principal local** (la copia lo recibe sola) y los datos de prueba del proyecto (seeds).

## 2. Comprobaciones

```bash
P="docker compose -p base-miles-prueba"
# ¿La copia sigue a la principal? (en la principal)
$P exec -T principal psql -U app -d app -c "SELECT client_addr, state, replay_lag FROM pg_stat_replication;"
# ¿Es copia y cuánto va atrasada? (en la copia)
$P exec -T copia psql -U app -d app -c "SELECT pg_is_in_recovery(), now() - pg_last_xact_replay_timestamp() AS retraso;"
# La copia no acepta escrituras (debe dar: cannot execute INSERT in a read-only transaction)
$P exec -T copia psql -U app -d app -c "CREATE TABLE x(id int);"
```

**Simular retraso** (para comprobar lecturas tras escritura): `$P pause copia`, haz el flujo en la app (guardar y enseguida ver),
y `$P unpause copia`. Mientras está en pausa la copia no recibe nada, y cualquier lectura que vaya a ella se queda colgada:
eso también sirve para ver si la app tiene *timeout* corto.

**Simular que la copia se cae:** `$P stop copia`, usa la app (¿los listados pasan a la principal o dan error?), y `$P start copia`.

## 3. Probar que una copia tome el lugar de la principal

```bash
$P stop principal                                                   # "se cae" la principal
$P exec -T copia psql -U app -d app -c "SELECT pg_promote();"       # la copia se vuelve principal
$P exec -T copia psql -U app -d app -c "SELECT pg_is_in_recovery();"  # debe decir f
```

Ahora apunta `DATABASE_URL` de la app al puerto `55433` y revisa qué pasa: ¿la app se reconecta sola? ¿Cuántas peticiones fallaron?
Para ver **qué se pierde**: antes de detener la principal, pausa la copia (`$P pause copia`), escribe algo en la principal,
detén la principal, reanuda la copia (`$P unpause copia`) y promuévela. Lo que escribiste durante la pausa no está:
es lo mismo que pasa en producción con copias asíncronas (se pierde lo que el retraso no alcanzó a copiar).
Para volver a empezar: `$P down -v` y `$P up -d --wait`.

## 4. MySQL (variante)

Mismo esquema con `mysql:8.4`: la principal con `--server-id=1 --log-bin --gtid-mode=ON --enforce-gtid-consistency=ON`;
la réplica con `--server-id=2 --gtid-mode=ON --enforce-gtid-consistency=ON --read-only=ON --super-read-only=ON`.
En la principal crea el usuario: `CREATE USER 'replicador'@'%' IDENTIFIED BY 'replicador_local'; GRANT REPLICATION SLAVE ON *.* TO 'replicador'@'%';`.
En la réplica:

```sql
CHANGE REPLICATION SOURCE TO SOURCE_HOST='principal', SOURCE_USER='replicador', SOURCE_PASSWORD='replicador_local',
  SOURCE_AUTO_POSITION=1, GET_SOURCE_PUBLIC_KEY=1;
START REPLICA;
SHOW REPLICA STATUS\G   -- Replica_IO_Running y Replica_SQL_Running en Yes; Seconds_Behind_Source = retraso
```

Simular retraso: `STOP REPLICA SQL_THREAD;` … `START REPLICA SQL_THREAD;`. Promover: `STOP REPLICA; RESET REPLICA ALL; SET GLOBAL super_read_only=OFF; SET GLOBAL read_only=OFF;`.

## 5. Apagar

```bash
docker compose -p base-miles-prueba down -v
```

Solo ese comando. **Nunca** `docker stop $(docker ps -q)`, `docker system prune`, `docker volume prune` ni nada que toque contenedores o volúmenes que no creaste.
