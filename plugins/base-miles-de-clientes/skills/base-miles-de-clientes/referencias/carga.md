# Prueba de carga local con `scripts/carga.mjs`

La herramienta manda peticiones a la app **local** con varios usuarios a la vez, mide cuánto tarda cada escenario (p50, p95, p99),
cuenta fallas y detecta **lecturas tras escritura** que fallan. Se niega a correr contra algo que no sea `localhost`, `127.x.x.x` o `::1`.
Guarda el resultado en `carga/resultados/<etiqueta>.json` para comparar antes y después de cada cambio.

## Antes de correrla

- La app corre **en local** contra una base **local y desechable** (Docker local o la base de desarrollo con datos de prueba).
  La carga crea registros: nunca la apuntes a una base con datos que importen.
- Si la app pide sesión, inicia sesión con un usuario de prueba y pasa la cookie con `--header "Cookie: sesion=..."`.
- Empieza suave: `--concurrencia 10 --segundos 20`. Máximos de la herramienta: 50 usuarios y 300 segundos.

## El plan: `carga/plan.json`

```json
{
  "version": 1,
  "escenarios": [
    { "nombre": "listar-facturas", "peso": 6, "pasos": [ { "metodo": "GET", "ruta": "/api/facturas?cuenta={azar:1-500}" } ] },
    { "nombre": "reporte", "peso": 1, "pasos": [ { "metodo": "GET", "ruta": "/api/reportes/ventas" } ] },
    { "nombre": "crear-y-ver", "peso": 2, "pasos": [
      { "metodo": "POST", "ruta": "/api/facturas", "cuerpo": { "cuentaId": "{azar:1-500}", "total": 120 }, "estado": 201, "guardar": { "id": "id" } },
      { "metodo": "GET", "ruta": "/api/facturas/{id}", "igual": { "total": 120 } }
    ] },
    { "nombre": "editar-y-ver", "peso": 1, "pasos": [
      { "metodo": "PATCH", "ruta": "/api/facturas/{azar:1-1000}", "cuerpo": { "total": "{n}" }, "igual": { "total": "{n}" } }
    ] }
  ]
}
```

| Campo del paso | Para qué |
|---|---|
| `metodo`, `ruta`, `cuerpo`, `headers` | La petición |
| `estado` | Código esperado (por defecto cualquier 2xx) |
| `igual` | Campos que la respuesta JSON debe traer con ese valor: así se detecta un dato viejo |
| `guardar` | Guarda un campo de la respuesta (`"id": "data.id"`) para usarlo en los pasos siguientes como `{id}` |
| `espera_ms` | Pausa antes del paso (por ejemplo, el tiempo que tarda un usuario en ver la pantalla siguiente) |

En `ruta` y `cuerpo`: `{azar:a-b}` número al azar, `{n}` número de iteración (único), `{variable}` lo guardado.

**Reglas para un buen plan:**
1. Los **pesos** imitan el tráfico real (de los logs o del APM): si 80 % son lecturas, que el plan también.
2. Cada flujo de **guardar y enseguida ver** que encontraste en el código es un escenario de dos pasos con `igual`.
3. Incluye los reportes y dashboards: son los que más pesan.
4. No cambies el plan entre "antes" y "después"; si lo cambias, sube `version`.

## Correr y comparar

```bash
node <carpeta-de-esta-skill>/scripts/carga.mjs correr --plan carga/plan.json --url http://localhost:PUERTO --segundos 20 --concurrencia 10 --etiqueta antes
# … aplicar UN cambio aprobado …
node <carpeta-de-esta-skill>/scripts/carga.mjs correr --plan carga/plan.json --url http://localhost:PUERTO --segundos 20 --concurrencia 10 --etiqueta despues-indice
node <carpeta-de-esta-skill>/scripts/carga.mjs comparar carga/resultados/antes.json carga/resultados/despues-indice.json
```

`comparar` termina con código 1 si algún escenario empeoró (p95 más de 20 % peor o más fallas).

## Cómo leer el resultado

- **p95** es lo que siente 1 de cada 20 clientes. Es el número que importa, no el promedio.
- **"Lectura tras escritura"** en la salida = se guardó bien y la lectura siguiente falló o trajo un dato viejo. Es un hallazgo comprobado.
- Si la app tiene estadísticas de la base (`pg_stat_statements` local, un endpoint de depuración), tómalas **antes y después** de la carga:
  así sabes qué consultas consumieron el tiempo y cuánto trabajo recibió cada base.
- Los números locales **no son los de producción**: sirven para comparar antes y después, no para prometer tiempos.
