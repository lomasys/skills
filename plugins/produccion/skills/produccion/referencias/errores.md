# Errores en producción

## De dónde sale el log

Solo de dos lugares:

1. **Un archivo o texto que el usuario te da**: log de texto, JSON por línea (pino, winston, structlog, Lograge),
   un export de Sentry, Rollbar, Bugsnag o Honeybadger (CSV o JSON).
2. **Un comando de solo lectura que el usuario aprueba.** Propónlo con el número de líneas acotado y espera el sí:

| Dónde vive | Comando de solo lectura |
|---|---|
| Heroku | `heroku logs -n 1500 -a <app>` |
| Fly.io | `fly logs -a <app> --no-tail` |
| Render | `render logs -r <servicio> --limit 1000` (o export desde el panel) |
| Kubernetes | `kubectl logs deploy/<nombre> --since=24h --tail=2000` |
| Docker | `docker logs --since 24h <contenedor>` |
| Servidor con systemd | `journalctl -u <servicio> --since "24 hours ago" --no-pager` |
| AWS CloudWatch | `aws logs tail <grupo> --since 24h` |

Guarda la salida en un archivo dentro del proyecto o la carpeta temporal y pásalo a la herramienta.
Nunca corras algo que reinicie, escale, borre o "limpie" logs.

## Agrupar

```bash
node <carpeta-de-esta-skill>/scripts/errores.mjs errores.log            # tabla
node <carpeta-de-esta-skill>/scripts/errores.mjs errores.log --json     # para trabajar los datos
```

La herramienta:
- junta los errores con el mismo mensaje (quitando números, ids, IPs) y el mismo lugar del código;
- da veces, usuarios distintos, primera y última vez, rutas y los dos primeros `archivo:línea` del código propio (dónde tronó ← quién lo llamó);
- cuenta aparte los avisos (WARN/INFO);
- tapa claves y correos, y avisa si el log los trae.

Si un grupo sale con `?` en el lugar, busca el mensaje en el código (`grep -rn "texto del error"`).
Las rutas del servidor (`/app/`, `/var/www/`) se quitan; confirma que el archivo exista en el repositorio.

**Si el `archivo:línea` del log no coincide con el código** (la línea hace otra cosa, el archivo o la ruta no existen),
producción corre otra versión. Compara con la versión publicada (`git show <tag>:<archivo>`), dilo en el reporte
como "el log no coincide con el repositorio" y propone confirmar qué versión está arriba antes de arreglar.

Cuando un grupo no trae usuario, la columna "Usuarios" cuenta ids de evento, pedido o petición (`evento=`, `request_id=`):
dilo así en el reporte ("5 eventos"), no como usuarios.

## Ordenar por impacto

No por cantidad. Usa este orden:

1. **El log mismo filtra secretos o datos personales.** Va primero: hay que rotar la clave y dejar de registrarla. Nunca la copies completa.
2. **Dinero:** cobros que fallan o se quedan colgados, cobros dobles, pedidos que no se pueden pagar.
3. **Clientes que no pueden hacer lo principal** (comprar, entrar, guardar). Más usuarios distintos = más arriba.
4. **Datos que quedan mal** (avisos procesados dos veces, estados que no cambian).
5. **Señales de infraestructura** aunque sean pocas: disco lleno, base sin conexiones, memoria. Hoy es 1, mañana es una caída.
6. **Ruido:** avisos de desuso, errores de bots, 404 de rutas que no existen. Se listan al final y se excluyen de las alertas.

Para cada grupo responde: **desde cuándo** (¿empezó con un despliegue? compara con `git log --since`),
**a cuántos** (usuarios distintos, no líneas) y **sigue pasando** (última vez).

## Formato por grupo

```markdown
### 1. <qué le pasa al cliente, en una frase>
120 veces · 64 usuarios · desde 3-mar 18:00 (justo después del despliegue 2.4.0) · sigue pasando
`app/services/checkout.rb:41` ← `app/controllers/orders_controller.rb:18`

- **Causa:** <qué hace el código y por qué truena, confirmado leyéndolo>
- **Arreglo:** <el cambio concreto en una o dos líneas>
- **Prueba que falta:** <el caso que lo habría detectado>
```

## Arreglos típicos

| Síntoma | Causa común | Arreglo |
|---|---|---|
| `Cannot read properties of undefined`, `NoneType has no attribute`, `undefined method for nil` | Un dato opcional que el código trata como obligatorio | Manejar el caso vacío y agregar prueba con ese caso |
| `ETIMEDOUT`, `ReadTimeout`, `Net::ReadTimeout` | Llamada externa sin tiempo límite | Tiempo límite corto, mensaje claro; reintentar solo con clave de idempotencia (si no, cobros dobles) |
| `duplicate key`, `UniqueViolation`, `RecordNotUnique` en webhooks | El proveedor reenvía el mismo aviso | Si el id del evento ya existe, responder 200 y no hacer nada |
| `ENOSPC`, `No space left on device` | Archivos temporales que nadie borra | Generar en memoria o en streaming, o limpiar al terminar; alerta de disco |
| `too many connections`, `connection pool exhausted` | Pool chico o conexiones que no se cierran | Ajustar el pool y cerrar conexiones; alerta de conexiones |
| `Out of memory`, `JavaScript heap out of memory` | Cargar todo en memoria | Paginar o procesar por partes |
