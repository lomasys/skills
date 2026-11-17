# "Ver como" seguro (suplantación de usuarios)

Soporte entra a la cuenta de un cliente "como si fuera él" para ver lo que ve. Es útil y es el atajo más poderoso del sistema:
si no deja rastro, un empleado puede hacer cualquier cosa a nombre de un cliente y nadie lo sabrá.

**Búscalo como:** `impersonate`, `become`, `login_as`, `sudo`, `switch_user`, `masquerade`, `ver-como`,
gemas y paquetes como `pretender`, `devise_masquerade`, `django-hijack`, `django-impersonate`, `lab404/laravel-impersonate`.

## Lo que debe cumplir

| # | Requisito | Cómo comprobarlo | Prueba a dejar |
|---|---|---|---|
| 1 | **Solo quien debe** puede iniciarlo (rol de soporte o admin), y solo dentro de lo permitido (¿su cuenta? ¿cualquier cuenta? ¿a otro admin?) | Inténtalo con cada rol y con un admin de otra cuenta | Roles sin permiso reciben 403 |
| 2 | **Deja registro** al entrar y al salir: quién, como quién, cuándo, motivo si se pide | Entra y revisa la bitácora (endpoint, tabla o log) | Después de entrar, la bitácora tiene una entrada nueva que nombra a los dos usuarios |
| 3 | **Lo hecho adentro queda a nombre del suplantador también** | Haz un cambio adentro y revisa la bitácora | La entrada del cambio menciona al usuario real |
| 4 | **Se nota en pantalla** | La respuesta de "quién soy" (`/me`, `current_user`, sesión) dice que es una suplantación y quién la hace, para que el front muestre un aviso fijo | "Quién soy" indica la suplantación |
| 5 | **Caduca** (por ejemplo, 30-60 minutos) y se puede salir | Busca la expiración en el código; prueba la ruta de salida | La salida regresa al usuario original; pasado el tiempo, la sesión vuelve al original o se cierra |
| 6 | **No permite acciones peligrosas**: cambiar contraseña o correo, activar/quitar doble factor, métodos de pago y cobros, borrar la cuenta, crear llaves de API, cambiar roles | Intenta cada una mientras suplantas | Cada una responde 403 durante la suplantación |
| 7 | **No se encadena**: suplantar desde una suplantación no pierde al usuario original | Suplanta a un admin y desde ahí a otro | Se niega, o el registro conserva al original |

La caducidad no se prueba esperando: usa el reloj falso del framework (`mock.timers` de Node, `travel_to` en Rails,
`freezegun` en Python, `Carbon::setTestNow` en Laravel), o revisa el código y repórtalo como "sin caducidad en el código".

## Cómo escribir las pruebas sin inventar nombres

La bitácora o el aviso pueden no existir todavía. Prueba **lo que se observa** con lo que ya existe:
- si hay endpoint o tabla de bitácora, que aparezca una entrada nueva con los ids de los dos usuarios (búscalos en cualquier campo);
- si "quién soy" no dice nada de la suplantación, la prueba espera que la respuesta sea distinta de la de un login normal.

Para el requisito 3 usa cualquier acción que hoy sí se registre. Si la única exige un caso "Por decidir"
(por ejemplo, suplantar a otro admin), úsala y dilo en el hallazgo.

Si no hay ningún lugar donde observarlo, no escribas la prueba con un campo inventado: repórtalo como hallazgo y propone
el diseño (nombre de campo incluido) para que el usuario lo apruebe.

## Arreglo típico

Guardar en la sesión `suplantadorId` y `suplantaHasta`; un middleware que, si hay `suplantadorId`, bloquea la lista de
acciones peligrosas, expira la suplantación y agrega `suplantadorId` a cada entrada de la bitácora; "quién soy" devuelve
`{ suplantadoPor: { id, nombre }, hasta }` y el front muestra una franja fija con un botón "Salir".
