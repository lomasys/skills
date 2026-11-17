# Facturas con Copia

SaaS de facturación de práctica **con errores de base de datos a propósito** para ver trabajar la skill
[base-miles-de-clientes](../../plugins/base-miles-de-clientes/skills/base-miles-de-clientes/SKILL.md).
Tiene una base **principal** (donde se escribe) y una **copia** (réplica, solo para leer) que recibe los cambios medio segundo después.
Las dos viven en memoria: no hace falta Postgres ni MySQL.

> [!CAUTION]
> Las direcciones de producción de `config.js` son de ejemplo y no existen. Solo escucha en `127.0.0.1`.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node server.js                  # http://localhost:4500
RETRASO_MS=2000 node server.js  # copia más atrasada, los errores se notan más
node --test                     # prueba básica
```

| Ruta | Qué hace |
|---|---|
| `POST /registro`, `POST /login` | Crear cuenta e iniciar sesión (`ana@demo.test` / `demo123`) |
| `GET /api/facturas?cuenta=1` | Facturas de una cuenta |
| `POST /api/facturas`, `GET`/`PATCH /api/facturas/:id` | Crear, ver y editar |
| `POST /api/pagos` | Pagar una factura (`{"facturaId": 5}`) |
| `GET /api/reportes/ventas`, `GET /api/dashboard` | Reporte y tablero |
| `GET /debug/estadisticas` | Lecturas, escrituras, ocupación y consultas más pesadas de cada base |
| `POST /debug/copia` | `{"caida": true}` simula que la copia se cae |

## Reto

Antes de correr la skill, intenta encontrar los errores tú. Hay al menos **siete**.
Después corre `/base-miles-de-clientes:base-miles-de-clientes` y compara.

<details>
<summary>Ver la lista (spoiler)</summary>

1. Te registras e inicias sesión enseguida: "contraseña incorrecta" (el login lee de la copia).
2. Crear una factura responde error 500 aunque sí se guardó (lee de la copia justo después de escribir).
3. Editar una factura responde con el total viejo.
4. Dos clics en "Pagar" cobran dos veces (revisa en la copia si ya estaba pagada).
5. El reporte de ventas y el tablero corren en la principal y la saturan; deberían ir a la copia.
6. Si la copia se cae, todos los listados fallan: no hay plan B (leer de la principal).
7. El listado de facturas por cuenta no tiene índice: es la consulta que más tiempo consume, y se arregla sin copias.
8. Producción abre una conexión por petición (`pool.max: 200`) sin agrupador de conexiones.

</details>
