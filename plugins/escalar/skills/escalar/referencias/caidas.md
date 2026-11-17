# Plan de caídas

Con miles de clientes, algo siempre está fallando: la base se reinicia, Redis se llena, un proveedor tarda, un servidor muere.
La pregunta no es si pasa, sino **qué ve el cliente y si la app se recupera sola**.

## Las cinco defensas

| Defensa | Qué evita | Valor de inicio |
|---|---|---|
| **Tiempo límite** en toda llamada de red (base, Redis, APIs, correo) y para pedir conexión del pool | Que una dependencia lenta deje colgados todos los procesos | Base: 2-5 s por consulta y 1-2 s para pedir conexión · Redis: 100-500 ms · APIs: 1-3 s |
| **Reintento con espera creciente y azar**, con máximo | Fallas pasajeras, sin crear una avalancha | 2-3 intentos, 100 ms → 400 ms → 1,6 s, más azar. Solo en operaciones idempotentes |
| **Circuit breaker** (interruptor) | Seguir llamando a algo que está caído | Abre tras ~50 % de fallas en 20 llamadas; prueba otra vez a los 30 s |
| **Plan B** | Que una dependencia no esencial tumbe la pantalla | Último valor bueno guardado, valor por defecto, ocultar ese bloque, encolar para después |
| **Health checks** separados | Que el balanceador mande tráfico a un servidor muerto, o reinicie todo por una falla externa | `/vivo`: el proceso responde (sin revisar dependencias) · `/listo`: la base y Redis contestan en < 1 s; si no, 503 |

## Qué pasa con cada caída

| Se cae | Qué debería pasar |
|---|---|
| **Base de datos** | Las peticiones fallan rápido (en segundos, no minutos) con un mensaje claro. `/listo` responde 503 y el balanceador deja de mandar tráfico. Cuando vuelve, el pool se reconecta solo, sin reiniciar la app |
| **Redis (caché)** | La app sigue funcionando más lenta, leyendo de la base. Nunca un error 500 por no poder leer caché |
| **Redis (colas o sesiones)** | Las rutas que encolan guardan en la tabla outbox o responden "lo procesamos en unos minutos". Las sesiones: lo ideal es que no dependan de un solo Redis sin réplica |
| **Servicio externo** (pagos, correo, tipo de cambio) | Tiempo límite corto, interruptor y plan B. Lo que no es urgente va a la cola |
| **Un servidor de la app** | El balanceador lo saca por health check; los demás atienden. Funciona solo si no hay estado en la memoria del servidor (sesiones, archivos, caché local) |
| **Un worker** | Los trabajos esperan en la cola y se procesan cuando vuelve; ninguno se pierde (confirmar al terminar, no al tomar) |

## Cómo probarlo en local

Solo con lo que tú levantaste:

- **Base o Redis en Docker que tú levantaste:** `docker stop <contenedor>` → prueba rutas → `docker start <contenedor>` → ¿la app se recupera **sin reiniciarla**?
- **Servicio externo:** apunta su URL (variable de entorno de pruebas) a un puerto local que no responde, o a un servidor local que tarda 30 s.
- **Mide:** cuánto tarda en fallar cada ruta, qué código y mensaje recibe el cliente, qué dice el health check y cuánto tarda en recuperarse.
- Si no puedes simular algo (base administrada, solo hay producción), va a "Sin comprobar" con lo que dice el código.

## Ejemplos por stack

**Node**
```js
const r = await fetch(url, { signal: AbortSignal.timeout(2000) });            // tiempo límite
const pool = new Pool({ connectionTimeoutMillis: 2000, statement_timeout: 5000 }); // pg
```
Interruptor: la librería `opossum`, o un contador simple de fallas con fecha de "volver a probar". Pregunta antes de instalar.

**Rails**
```yaml
# database.yml
checkout_timeout: 2
variables: { statement_timeout: 5000 }
```
HTTP: `Net::HTTP` con `open_timeout`/`read_timeout`, o Faraday con `request.timeout`. Interruptor: gema `circuitbox` o `stoplight`.

**Django**
```python
DATABASES["default"]["OPTIONS"] = {"connect_timeout": 2, "options": "-c statement_timeout=5000"}
requests.get(url, timeout=(1, 3))
```

**Laravel**
```php
Http::timeout(3)->retry(3, 200, throw: false)->get($url);
// config/database.php → 'options' => [PDO::ATTR_TIMEOUT => 2]
```

## Errores comunes

- Reintentar en cada capa (cliente, API, worker): 3 × 3 × 3 = 27 llamadas por cada una que falla.
- Health check que revisa un servicio externo: si el proveedor de correo falla, el balanceador apaga todos tus servidores.
- Tiempo límite más largo que el del balanceador: el cliente ya se fue y el servidor sigue trabajando.
