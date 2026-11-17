# Caché

Una caché guarda el resultado de algo caro para no calcularlo en cada petición. Bien hecha, quita carga a la base.
Mal hecha, enseña datos de otro cliente o datos viejos.

## Qué buscar en el código

- Rutas que se piden mucho y cambian poco: tableros, resúmenes, catálogos, configuración de la cuenta, permisos.
- Consultas caras que se repiten igual en cada petición. Si la ruta es lenta por una consulta N+1, primero arréglala (skill `rendimiento`); la caché esconde el problema.
- Cachés que ya existen: `Map` u objetos globales en el proceso, `Rails.cache`, `cache.get/set` de Django, `Cache::remember` de Laravel, Redis directo.
  Para cada una revisa: **la llave**, **el tiempo de vida** y **quién la borra**.

## Qué guardar y por cuánto tiempo

| Dato | Tiempo de vida | Cómo se borra |
|---|---|---|
| Catálogo, planes, textos, configuración general | 10 a 60 min | Al editarlo en el panel de administración |
| Configuración y permisos de una cuenta | 5 a 15 min | Al cambiar la cuenta o un rol |
| Tablero o resumen de una cuenta | 30 s a 5 min | Al crear o cambiar lo que suma (pedido, pago) |
| Reportes pesados | 5 a 60 min, o calculado por adelantado en una cola | Al cerrar el periodo o con un botón "actualizar" |
| Respuestas de APIs externas (tipo de cambio, envíos) | Lo que diga el proveedor; guarda también el último valor bueno como respaldo | Al caducar |
| **No guardar** | Saldos para cobrar, inventario al vender, permisos al momento de autorizar algo sensible, tokens | — |

Regla práctica: si mostrar un dato viejo cuesta dinero o confianza, no va en caché o se borra al escribir.

## La llave correcta

La llave lleva todo lo que cambia la respuesta: **el id del cliente (tenant) primero**, luego el usuario si la respuesta depende de su rol, y los filtros.

```
<app>:<tenant>:<recurso>:<id o filtros>:v<versión>
tablero:cuenta-42:resumen:mes-2026-11:v3
```

- Si la ruta usa `current_user` o el token, la llave **tiene** que llevar su cuenta. Una llave fija (`'resumen'`) hace que todos vean los datos del primero que entró.
- Ponle versión (`v3`): al cambiar el formato de lo guardado, subes la versión y lo viejo se ignora.
- Una caché en la memoria del proceso (`Map`, variable global) no sirve con dos servidores: cada uno ve cosas distintas. Con más de un servidor, usa una caché compartida (Redis, Memcached).
- Ponle límite de tamaño o tiempo de vida a todo. Una caché sin límite es una fuga de memoria.

## Cómo borrarla sin mostrar datos viejos

1. **Borrar al escribir.** Después de guardar en la base (y solo si se guardó), borra la llave afectada. Es lo más simple y lo más común.
2. **Llave por versión.** Guarda `tenant:42:version` en Redis; súbela al escribir. La llave del tablero incluye esa versión, así que lo viejo deja de leerse sin buscarlo.
3. **Tiempo de vida corto como red de seguridad.** Aunque borres al escribir, deja un tiempo de vida: si un borrado falla, el error dura minutos y no para siempre.
4. **Evita la estampida.** Cuando una llave muy usada caduca, cientos de peticiones calculan lo mismo a la vez. Usa un candado (solo uno calcula) o recalcula un poco antes de que caduque.

## Ejemplos por stack

**Node (ioredis)**
```js
const llave = `tablero:${req.user.cuentaId}:resumen:v1`;
let resumen = JSON.parse(await redis.get(llave) || 'null');
if (!resumen) {
  resumen = await calcularResumen(req.user.cuentaId);
  await redis.set(llave, JSON.stringify(resumen), 'EX', 60);
}
// al crear un pedido, después del commit:
await redis.del(`tablero:${pedido.cuentaId}:resumen:v1`);
```

**Rails**
```ruby
Rails.cache.fetch(["tablero", current_account.id, "resumen", "v1"], expires_in: 1.minute) { Resumen.para(current_account) }
# en Pedido: after_commit { Rails.cache.delete(["tablero", account_id, "resumen", "v1"]) }
```

**Django**
```python
llave = f"tablero:{request.user.cuenta_id}:resumen:v1"
resumen = cache.get_or_set(llave, lambda: calcular_resumen(request.user.cuenta_id), timeout=60)
# en la señal post_save de Pedido, con transaction.on_commit: cache.delete(llave)
```

**Laravel**
```php
$resumen = Cache::remember("tablero:{$user->cuenta_id}:resumen:v1", 60, fn () => Resumen::para($user->cuenta_id));
// en el observer de Pedido (afterCommit): Cache::forget("tablero:{$pedido->cuenta_id}:resumen:v1");
```

## Cómo comprobarlo

- En el escenario de carga usa dos cuentas con `marca` y `verifica_marca`: la herramienta cuenta cada respuesta con datos de otra cuenta.
- Crea un dato y vuelve a pedir el tablero: debe aparecer de inmediato (borrado al escribir) o en menos del tiempo de vida acordado.
