# Prueba de carga

Simula muchos usuarios a la vez contra **tu app local** (o un ambiente de pruebas autorizado) y dice en qué escalón se rompe y qué se rompe primero.

## 1. La meta

"Miles de clientes" no dice cuánta carga hay. Conviértelo:

```bash
# con datos reales (lo mejor)
node scripts/carga.mjs objetivo --clientes 5000 --clientes-hoy 120 --peticiones-mes 900000 --dias 22 --horas 10 --pico 3
# sin datos: supuestos que se dicen en el reporte
node scripts/carga.mjs objetivo --clientes 5000 --usuarios-por-cliente 3 --activos 10 --acciones-por-minuto 2 --peticiones-por-accion 2
```

Da las peticiones por segundo de la meta, los usuarios simultáneos para simularlas (ley de Little: usuarios = peticiones por segundo × (pausa + tiempo de respuesta))
y los `--escalones` y `--pausa` sugeridos. De dónde salen los datos, en orden:
1. Registros del servidor o del balanceador: peticiones al mes y en la hora pico.
2. Analítica: sesiones simultáneas en la hora pico.
3. Si no hay nada: los supuestos por defecto, dichos como supuestos en el reporte.

## 2. El escenario

`carga/escenario.json` en el proyecto. La mezcla de rutas imita el uso real (si hay registros, sácala de ahí):

```json
{
  "base": "http://127.0.0.1:3000",
  "headers": { "Accept": "application/json" },
  "cuentas": [
    { "Authorization": "Bearer <token de prueba A>", "marca": "cuenta-a" },
    { "Authorization": "Bearer <token de prueba B>", "marca": "cuenta-b" }
  ],
  "pasos": [
    { "nombre": "tablero", "ruta": "/api/tablero", "peso": 50, "verifica_marca": "cuenta_id" },
    { "nombre": "lista", "ruta": "/api/pedidos?page=1", "peso": 30 },
    { "nombre": "crear", "metodo": "POST", "ruta": "/api/pedidos", "peso": 5,
      "headers": { "Idempotency-Key": "{{uuid}}" }, "cuerpo": { "monto": 1, "nota": "carga-{{n}}" } }
  ]
}
```

| Campo | Para qué |
|---|---|
| `cuentas` | Encabezados de cada cuenta de prueba. Cada usuario simulado usa una, por turnos. `marca` es lo que debería traer la respuesta |
| `verifica_marca` | Campo del JSON de respuesta que debe ser igual a la `marca` de la cuenta. Si no, cuenta como "datos de otra cuenta" |
| `peso` | Qué tan seguido se elige ese paso |
| `{{uuid}}`, `{{n}}`, `{{vu}}`, `{{marca}}` | Se reemplazan en cada petición: id único, contador, número de usuario simulado, marca de la cuenta |

Antes de poner un paso que escribe: revisa qué dispara (regla 2 de la skill) y marca los datos (`"nota": "carga-{{n}}"`) para poder borrarlos después.
No pongas tokens reales de clientes; crea cuentas de prueba.

## 3. Correr por escalones

```bash
node scripts/carga.mjs correr --escenario carga/escenario.json --escalones 10,50,200,500,1000 --duracion 30 --pausa 3000 --etiqueta linea-base
```

- Cada escalón dura `--duracion` segundos. Se detiene en el primero que "se rompe": más de 5 % de errores, p95 mayor a 2 000 ms
  (cámbialos con `--parar-si-errores` y `--parar-si-p95`), p95 en el tiempo límite, o una ruta con más de 20 % de errores aunque el total se vea bien.
- "Errores" son peticiones que no respondieron o respondieron con error. "Otra cuenta" se cuenta aparte.
- El p95 nunca pasa de `--timeout`. No subas `--parar-si-p95` por encima del tiempo límite para "llegar" a un escalón: corre ese escalón aparte.
- Si más de la mitad de las peticiones falla, el escalón se corta solo: no tiene caso seguir golpeando.
- La fuga entre cuentas se reporta aparte; no detiene la prueba pero va como P1.
- Topes de la herramienta: 10 000 usuarios simultáneos, 600 s por escalón, 30 min por corrida.
- Resultados en `carga/resultados/<fecha>_<etiqueta>.json`. Compara dos corridas con `comparar`.

**Si la herramienta avisa que el generador se saturó**, baja usuarios o sube `--pausa`, o corre el generador en otra máquina de tu red local.
La app y el generador en la misma máquina compiten por CPU: los números sirven para encontrar el cuello, no como capacidad final.

## 4. Mirar la app mientras corre

La tabla de la herramienta dice **qué** se rompe. Para saber **por qué**, mira el servidor:

| Qué mirar | Cómo (local) |
|---|---|
| CPU y memoria del proceso | `Get-Process -Id <PID>` cada 5 s en PowerShell; `ps -o %cpu,rss -p <PID>` en Linux/macOS; `docker stats` |
| Conexiones de la base en uso | Postgres: `select count(*) , state from pg_stat_activity group by state;` · MySQL: `SHOW PROCESSLIST;` |
| Fila de la cola | Sidekiq: panel web · Celery: `celery inspect active` · BullMQ: `getJobCounts()` · Laravel: `php artisan queue:monitor` |
| Registros de la app | Errores de "pool agotado", "too many connections", "timeout", "out of memory" |

Solo lectura: no cambies parámetros del servidor durante la prueba.

## 5. Qué suele tronar primero

| Síntoma en la tabla | Causa probable | Dónde se arregla |
|---|---|---|
| p95 sube mucho pero casi sin errores, CPU de la app al 100 % | Cálculo pesado dentro de la petición, JSON enorme, plantillas | Caché o cola (esta skill); perfilar (`rendimiento`) |
| p95 sube en escalera, CPU baja, errores de tiempo límite | Pool de conexiones de la base agotado; consultas lentas o N+1 | `rendimiento` para la consulta; pool y réplicas en `base-miles-de-clientes` |
| Una ruta lenta arrastra a todas | Comparten el mismo pool o proceso; sin tiempo límite | Tiempos límite y colas ([caidas.md](caidas.md), [colas.md](colas.md)) |
| Errores `conexion` (ECONNREFUSED/RESET) de golpe | El proceso se cayó: memoria, demasiados sockets | Archivos fuera de la memoria ([archivos.md](archivos.md)), límites |
| 5xx en rutas que escriben | Servicio externo lento o fallando dentro de la petición | Cola con reintentos ([colas.md](colas.md)) |
| Una ruta con 20 s de vez en cuando | Llamada externa sin tiempo límite | [caidas.md](caidas.md) |
| `otra_cuenta` mayor que 0 | Caché con llave sin el id del cliente | [cache.md](cache.md). Es P1 |

## 6. Después de la prueba

- Pide `/salud` y una ruta normal cada 5 s durante 60 s. Si sigue lenta o colgada, la app **no se recupera sola**: P1.
- Cuenta lo que se creó (por la marca `carga-`) y bórralo, o restaura la base de prueba. Dilo en el reporte.
- Detén solo tu PID.
