# Cómo armarlo: servidores, copias, fallas y costo

## La forma básica

```
            escrituras + lecturas que no aguantan retraso
   app  ───────────────────────────────────────────►  PRINCIPAL
    │                                                     │  copia los cambios (replicación)
    │   lecturas que aguantan unos segundos de retraso    ▼
    └──────────────────────────────────────────────►  COPIA 1 … COPIA N
```

- **Principal:** la única que recibe escrituras. Todo lo que mueve dinero o acceso lee de aquí.
- **Copias (réplicas de lectura):** reciben los cambios de la principal unos milisegundos o segundos después. Solo leen.
- **Respaldo para fallas (standby):** una copia extra lista para tomar el lugar de la principal. Puede ser la misma copia de lectura
  o una aparte (en RDS *Multi-AZ* clásico el standby **no** se puede leer).

## Tamaños para empezar

| Etapa | Principal | Copias | Nota |
|---|---|---|---|
| Primer paso | El tamaño actual | 1 copia **del mismo tamaño** | Una copia más chica se atrasa cuando hay muchas escrituras |
| Reportes pesados | Igual | 1 copia solo para reportes | Que un reporte lento no frene a los clientes |
| Mucho tráfico de lectura | Igual o un tamaño más | 2 o más copias detrás de un balanceador | Aguanta que una se caiga |

La copia necesita la **misma memoria** que la principal: los datos que se leen deben caber en memoria en las dos.

## Cómo se copian los datos

### Postgres: replicación en streaming

- La principal manda su registro de cambios (WAL) a cada copia por una conexión abierta. Es **asíncrona** por defecto:
  la principal no espera a la copia, así que la copia puede ir atrasada.
- En la principal: `wal_level = replica`, `max_wal_senders`, un usuario con permiso `REPLICATION` y una línea `replication` en `pg_hba.conf`.
- La copia se crea con `pg_basebackup -R` (copia completa + configuración para seguir a la principal).
- Usa **ranuras de replicación** (*replication slots*) para que la principal no borre cambios que la copia aún no recibe,
  pero vigila el disco: una copia caída con ranura hace crecer el WAL sin límite (`max_slot_wal_keep_size` lo acota).
- **Conflictos:** una consulta larga en la copia puede ser cancelada (*canceling statement due to conflict with recovery*).
  Opciones: `hot_standby_feedback = on` (evita cancelaciones, pero puede inflar tablas en la principal) o subir `max_standby_streaming_delay`
  en la copia de reportes (acepta más retraso).
- Medir retraso: en la principal `SELECT client_addr, state, replay_lag FROM pg_stat_replication;` · en la copia
  `SELECT now() - pg_last_xact_replay_timestamp();` (si no hay escrituras, este número crece aunque la copia esté al día).
- Herramientas para conmutar solo: **Patroni** (con etcd o Consul), repmgr, pg_auto_failover. En Kubernetes: CloudNativePG.

### MySQL / MariaDB: réplicas

- La principal escribe su *binary log*; cada réplica lo lee y lo aplica. Asíncrona por defecto; semisíncrona opcional.
- Usa **GTID** (`gtid_mode=ON`, `enforce_gtid_consistency=ON`) para que cambiar de principal sea simple.
- La réplica con `read_only=ON` y `super_read_only=ON` para que nadie escriba en ella por error.
- Configurarla: `CHANGE REPLICATION SOURCE TO SOURCE_HOST=..., SOURCE_AUTO_POSITION=1; START REPLICA;` (antes de 8.0.23: `CHANGE MASTER TO`).
- Medir retraso: `SHOW REPLICA STATUS\G` → `Seconds_Behind_Source` (antes `Seconds_Behind_Master`).
- Ruteo y conmutación: ProxySQL, MySQL Router (InnoDB Cluster), Orchestrator.

### Servicios administrados (lo más simple)

| Servicio | Copias de lectura | Conmutación por falla | Lo que hay que saber |
|---|---|---|---|
| AWS RDS (Postgres/MySQL) | "Create read replica", hasta 15 | *Multi-AZ*: standby síncrono, cambia solo en ~1–2 min | El standby de Multi-AZ clásico no se lee. Una read replica se puede promover a mano |
| AWS Aurora | Hasta 15, comparten el disco | ~30 s a una réplica | Un **reader endpoint** reparte las lecturas. Retraso típico < 100 ms |
| Google Cloud SQL | Read replicas | *HA regional*: standby síncrono | Las copias se leen con su propia IP; el HA cambia solo |
| Supabase | Read replicas (planes pagados) | Revisa su documentación vigente | Cada copia tiene su URL y se cobra como un cómputo más |
| Azure Database for PostgreSQL | Read replicas | HA con zona redundante | Promover una copia la desconecta de la principal |
| DigitalOcean / otros | Nodos de solo lectura | Nodos standby | Cada nodo se cobra como uno más |

## Si una copia falla

Las lecturas deben pasar **a otra copia o a la principal** sin que el cliente lo note:

1. **Detectarlo:** error de conexión o *timeout* corto (1–2 s) en la copia, o retraso mayor al permitido (por ejemplo > 30 s).
2. **Mover las lecturas:** a otra copia sana; si no hay, a la principal. Lo hace el balanceador (reader endpoint, ProxySQL, PgBouncer/PgCat)
   o el propio código (ver [frameworks.md](frameworks.md#si-la-copia-falla)).
3. **Cuidar a la principal:** si recibe de golpe todas las lecturas puede saturarse. Por eso, a partir de cierto tráfico, conviene **dos copias**.
4. **Avisar:** una alerta cuando el retraso pase de N segundos o una copia deje de responder.

## Si se cae la principal (failover)

1. Una copia (o el standby) se **promueve**: deja de seguir a la principal y empieza a aceptar escrituras.
   Postgres: `SELECT pg_promote();` · MySQL: `STOP REPLICA; RESET REPLICA ALL;` y quitar `read_only` · Administrados: botón "Promote" o automático.
2. La app debe apuntar a la nueva principal: usa **un nombre** (DNS o endpoint del proveedor), nunca una IP fija.
3. La vieja principal **no debe volver a recibir escrituras** (dos principales = datos divididos). Las herramientas como Patroni la aíslan solas.
4. Las demás copias se reapuntan a la nueva principal.

**Qué se puede perder:**

| Tipo de copia | Se pierde al caer la principal | Tiempo sin escrituras (aprox.) |
|---|---|---|
| Asíncrona (lo normal en copias de lectura) | Lo escrito en los últimos segundos que la copia no alcanzó a recibir (= el retraso de ese momento) | Minutos si es a mano; 30–120 s si es automático |
| Síncrona (Multi-AZ, HA regional, `synchronous_commit` con `synchronous_standby_names`) | Nada confirmado | 30–120 s |

Los pagos y escrituras importantes deben poder reintentarse sin duplicarse (clave de idempotencia), porque durante el cambio fallan.
**Practica el cambio en Docker local o en staging** antes de necesitarlo ([docker.md](docker.md#3-probar-que-una-copia-tome-el-lugar-de-la-principal)).

## Costo aproximado de cada servidor

> **Estimados.** Precios de lista por hora × 730 horas, sin impuestos ni descuentos, consultados el **2026-11-16** en las páginas oficiales:
> [RDS for PostgreSQL](https://aws.amazon.com/rds/postgresql/pricing/) (us-east-1, On-Demand) ·
> [Cloud SQL](https://cloud.google.com/sql/pricing) (Enterprise, general purpose) ·
> [Supabase](https://supabase.com/docs/guides/platform/compute-and-disk).
> Cambian por región y con el tiempo: en el reporte di siempre la fecha y la fuente, y si puedes, vuelve a consultar la página.

| Servidor | Núcleos / memoria | Una base | Con standby (HA) |
|---|---|---|---|
| RDS `db.t4g.medium` | 2 / 4 GB (ráfagas) | ~$47 al mes ($0.065/h) | ~$94 ($0.129/h Multi-AZ) |
| RDS `db.m7g.large` | 2 / 8 GB | ~$123 ($0.168/h) | ~$246 ($0.337/h) |
| RDS `db.m7g.xlarge` | 4 / 16 GB | ~$246 ($0.337/h) | ~$492 ($0.674/h) |
| RDS `db.r7g.large` | 2 / 16 GB | ~$174 ($0.239/h) | — |
| Cloud SQL 2 vCPU · 8 GB | 2 / 8 GB | ~$101 ($0.0413/h por vCPU + $0.007/h por GB) | ~$202 (precio HA) |
| Cloud SQL 4 vCPU · 16 GB | 4 / 16 GB | ~$202 | ~$404 |
| Supabase Large | 2 dedicados / 8 GB | ~$110 | — |
| Supabase XL | 4 dedicados / 16 GB | ~$210 | — |

Además del servidor: **disco** (≈ $0.115–0.125 por GB al mes en RDS gp3 y Supabase), respaldos fuera de lo incluido y
**transferencia** entre zonas o regiones. Una copia de lectura **cuesta lo mismo que su tamaño de servidor más su disco**.

Ejemplo para el reporte: *"Principal `db.m7g.large` (~$123) + 1 copia igual (~$123) + 200 GB de disco en cada una (~$46) ≈ **$292 al mes**.
Alternativa sin copias: subir la principal a `db.m7g.xlarge` (~$246 + $23 de disco ≈ $269). Estimado con precios de lista de RDS us-east-1 del 2026-11-16."*

## Cuándo repartir clientes en varias bases

Las copias solo reparten **lecturas**. Cuando las **escrituras** ya no caben en la principal más grande razonable,
o una base pasa de unos cuantos TB, o hay clientes que exigen sus datos en otro país, el siguiente paso es
**repartir clientes en varias bases (sharding por cliente)**: cada cliente vive completo en una base, y una tabla pequeña dice dónde está cada uno.
Herramientas: Rails `connects_to shards:` + `connected_to(shard:)`, Citus (Postgres), Vitess / PlanetScale (MySQL), o un "mapa cliente → base" propio.
Es un proyecto grande (migrar datos, reportes que cruzan clientes): menciónalo solo como el paso siguiente, con la señal que lo justificaría.
