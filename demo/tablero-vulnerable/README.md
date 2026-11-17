# Tablero Vulnerable

Mini app **insegura a propósito** para ver trabajar la skill [seguridad](../../plugins/seguridad/skills/seguridad/SKILL.md).
Dos empresas comparten el sistema y nunca deberían ver lo de la otra… pero sí pueden.

> [!CAUTION]
> No la publiques en ningún servidor. Solo escucha en `127.0.0.1`.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node server.js     # http://localhost:4300
node --test        # pruebas
```

Usuarios de prueba (contraseña `demo123`):

| Usuario | Empresa | Rol |
|---|---|---|
| `ana@empresa-a.test` | A | admin |
| `luis@empresa-a.test` | A | miembro |
| `beto@empresa-b.test` | B | admin |

## Reto

Antes de correr la skill, intenta encontrar los hoyos tú mismo. Hay al menos **diez**.
Después corre `/seguridad:seguridad` y compara.

<details>
<summary>Ver la lista (spoiler)</summary>

1. Un usuario lee tableros de otra empresa (`GET /api/tableros/:id`).
2. …y también los modifica (`PATCH /api/tableros/:id`), incluso el campo `accountId`.
3. Un miembro puede borrar usuarios, incluido el admin (`DELETE /api/usuarios/:id`).
4. Enlaces públicos con id consecutivo, que nunca caducan y muestran el correo del dueño (`/compartir/:id`).
5. Claves escritas en `config.js`.
6. XSS en el buscador (`/buscar?q=`).
7. Redirección abierta (`/salir?to=`).
8. Webhook de pagos sin firma: cualquiera se regala créditos.
9. El mismo webhook repetido suma dos veces.
10. Login sin límite de intentos y cookie sin `HttpOnly` ni `SameSite`.
11. Contraseñas guardadas en texto plano.

</details>
