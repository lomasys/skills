# API sin escalar

API de práctica **con problemas para crecer puestos a propósito**, para ver trabajar la skill [escalar](../../plugins/escalar/skills/escalar/SKILL.md).
Funciona bien con 5 clientes… y se cae con unos cientos. Dos empresas (A y B) comparten el sistema.

> [!CAUTION]
> No la publiques en ningún servidor. Solo escucha en `127.0.0.1`.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node server.js     # http://127.0.0.1:4500   (otro puerto: PUERTO=4600 node server.js)
```

| Token | Usuario | Empresa |
|---|---|---|
| `Bearer token-a` | ana | A |
| `Bearer token-b` | beto | B |

Rutas: `GET /api/resumen`, `GET /api/reporte`, `POST /api/pedidos`, `GET /api/precio-usd`, `POST /api/archivos`, `GET /api/archivos/:id`, `GET /salud`.

Para practicar caídas: `POST /_demo/romper?que=db` (también `correo` o `externo`) y `POST /_demo/arreglar`.
La base, el correo y el servicio externo son de mentira: nada sale de tu máquina.

Para el modo `costo`, lo que "se paga hoy" está en [`infra.md`](infra.md) (datos inventados).

## Reto

Antes de correr la skill, intenta encontrar los problemas tú. Hay al menos **ocho**.
Después corre `/escalar:escalar` y compara.

<details>
<summary>Ver la lista (spoiler)</summary>

1. La caché del resumen usa una llave fija: la empresa B ve los números de la A.
2. Esa caché nunca se borra ni caduca: un pedido nuevo no aparece en el resumen.
3. El reporte hace una consulta por producto y un cálculo pesado que bloquea el proceso. Sin caché.
4. El correo de confirmación se manda dentro de la petición: tarda 1,5 s y falla 1 de cada 5 veces.
5. Si el correo falla, responde error aunque el pedido ya se guardó; el cliente reintenta y se duplica (sin idempotencia).
6. La base tiene 5 conexiones y ningún tiempo límite: con carga, todo hace fila; si la base se cae, la app queda colgada aun después de que vuelve.
7. El servicio de tipo de cambio no tiene tiempo límite ni plan B: a veces tarda 20 s.
8. `/salud` siempre dice "ok", aunque la base esté caída.
9. Los archivos viven en la memoria del servidor, pasan completos por la app y se sirven sin `Cache-Control`: no se puede poner un segundo servidor.

</details>
