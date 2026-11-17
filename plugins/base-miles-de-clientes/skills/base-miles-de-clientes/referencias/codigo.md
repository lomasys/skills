# Revisar el código: qué va a cada base y dónde falla el retraso

## 1. Qué va a cada base

| Va a la **principal** (siempre) | Va a la **copia** (aguanta segundos de retraso) |
|---|---|
| Guardar, editar, borrar | Reportes, exportaciones, estadísticas |
| Login, registro, recuperar contraseña, sesiones, tokens, permisos | Dashboards y tableros |
| Pagos, saldos, créditos, inventario, cupos, límites del plan | Listados y búsquedas (con la ventana de lectura tras escritura) |
| Revisar algo **antes** de escribir (¿ya existe?, ¿ya se pagó?, ¿hay saldo?) | Páginas públicas, catálogos, ayuda |
| Lo que se lee justo después de escribir (en la misma petición o la siguiente) | Trabajos nocturnos y analítica |
| Webhooks que confirman o cambian estados | Sitemaps, feeds, conteos aproximados |

Regla corta: **si un dato viejo puede costar dinero, dejar entrar a quien no debe o duplicar algo, va a la principal.**

## 2. Mapa de accesos

Haz una tabla con cada ruta, controlador, servicio o trabajo que toca la base:

| Ruta / función | Archivo:línea | Lee | Escribe | Base hoy | Base correcta | Motivo |
|---|---|---|---|---|---|---|

Cómo encontrarlos:
- **Rails:** `config/routes.rb` + controladores; busca `connected_to`, `connects_to`, `.find`, `.where`, `perform_later`.
- **Django:** `urls.py` + vistas; busca `.using(`, `DATABASE_ROUTERS`, `transaction.atomic`, `.delay(` (Celery).
- **Laravel:** `routes/*.php` + controladores; busca `onWriteConnection`, `useWritePdo`, `sticky`, `dispatch(`.
- **Node:** rutas de Express/Fastify/Nest; busca las instancias de la base (`prisma`, `knex`, `sequelize`, `pool.query`) y cuál se usa en cada lugar.

## 3. Lecturas tras escritura (read-your-writes)

Son los lugares donde **se guarda algo y enseguida se lee**, y la lectura va (o iría) a la copia, que todavía no lo tiene.

| Patrón | Cómo se ve en el código | Qué le pasa al cliente | Gravedad |
|---|---|---|---|
| **Revisar y luego actuar** | Lee "¿ya se pagó?/¿hay saldo?/¿existe el correo?" y luego escribe | Cobro doble, saldo negativo, cuentas duplicadas | 🔴 |
| **Registro y login** | Crear usuario y enseguida autenticar o leer la sesión | "Contraseña incorrecta" justo después de registrarse | 🔴 |
| **Crear y mostrar** | `create` → `find(id)` / redirect a `show` | Error 404 o 500 aunque sí se guardó; el cliente lo crea otra vez | 🟠 |
| **Editar y mostrar** | `update` → leer → responder | La pantalla muestra el valor viejo; el cliente cree que no se guardó | 🟡 |
| **Encolar trabajo tras guardar** | `save` → `perform_later(id)` / `dispatch` / `queue.add` | El trabajo no encuentra el registro: correos o facturas que no salen | 🟠 |
| **Borrar y listar** | `destroy` → redirect al listado | El registro "borrado" sigue apareciendo | 🟡 |
| **Contadores y totales** | Sumar y luego mostrar el total | Total que no cuadra unos segundos | ⚪ |
| **Caché llenado desde la copia** | Invalidar caché tras escribir y rellenarlo leyendo de la copia | El dato viejo queda guardado en el caché por minutos u horas | 🟠 |

Búsquedas útiles (ajústalas al proyecto):

```bash
# Escrituras seguidas de una lectura en pocas líneas
rg -n -A6 "\.(create|save|update|insert|destroy|delete)\b|INSERT INTO|UPDATE " --glob '!**/test/**' | rg -n "find|get|select|where|SELECT|redirect"
# Trabajos encolados justo después de guardar
rg -n "perform_later|perform_async|\.delay\(|dispatch\(|queue\.add|enqueue"
# Revisar-y-actuar
rg -n -i "pagad|paid|balance|saldo|stock|exists\?|exists\(\)|already"
```

Para cada caso anota: archivo y línea, la escritura, la lectura que le sigue, a qué base va la lectura (hoy o con el plan) y el arreglo.

## 4. Arreglos, del más simple al más completo

| Arreglo | Cuándo |
|---|---|
| **Usar lo que ya tienes en memoria** (el objeto que acabas de guardar) en lugar de leerlo otra vez | Crear/editar y mostrar en la misma petición. Es lo más simple y no depende de la base |
| **Leer esa consulta de la principal** (`connected_to(role: :writing)`, `.using("default")`, `onWriteConnection()`, `$primary()`, `useMaster: true`) | Revisar-y-actuar, login, pagos: siempre |
| **Ventana de lectura en la principal** por unos segundos tras escribir, por usuario (sesión o cookie) | "Guardar, redirigir y ver". Ventana = retraso p99 medido + margen (2 s es un buen inicio) |
| **Encolar después de confirmar y leer de la principal en el trabajo** (`after_commit`, `transaction.on_commit`, `afterCommit()`) | Trabajos en segundo plano |
| **Hacerlo atómico en la principal**: `UPDATE facturas SET pagada = true WHERE id = $1 AND pagada = false` y revisar cuántas filas cambió, o una restricción única | Revisar-y-actuar con dinero. Elimina también la carrera entre dos clics, haya copia o no |
| **Esperar a la copia** (guardar la posición del cambio y leer de la copia solo cuando la alcanzó: `pg_last_wal_replay_lsn()`, `WAIT_FOR_EXECUTED_GTID_SET`) | Sistemas grandes; rara vez hace falta al empezar |

## 5. Consultas que deberían ir a la copia

Busca lecturas pesadas que hoy corren en la principal: reportes, exportaciones, dashboards, búsquedas con `LIKE '%…%'`,
agregaciones (`SUM`, `COUNT`, `GROUP BY`) sobre tablas grandes, y trabajos nocturnos. Para cada una indica cuánto tiempo de base consume
(de [medir.md](medir.md)) y cuánto se libera en la principal al moverla.

## 6. Plan B si la copia falla

Revisa qué pasa hoy si la copia no responde: ¿cada lectura da error 500? ¿Hay un *timeout* corto? ¿Hay a dónde caer?
Si no hay plan B, es un hallazgo 🟠: *"si la copia se cae, todos los listados fallan"*. Arreglo en [frameworks.md](frameworks.md#si-la-copia-falla).

## 7. Cómo comprobar un hallazgo en local

- Simula el retraso: Docker local con la copia pausada (`docker compose pause copia`) o un retraso artificial si la app ya simula la copia.
- Haz el flujo real (crear y enseguida ver; pagar dos veces seguidas; registrarse y entrar) con `curl` o con `carga.mjs` y un escenario de dos pasos.
- Guarda la petición y lo que respondió la app. Si la app se comportó bien, descarta el hallazgo.
- Si cambiaste datos de prueba (pagos, usuarios), regrésalos o reinicia la base local.
