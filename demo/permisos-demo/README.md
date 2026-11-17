# Permisos Demo

Mini app con **fallas de permisos a propósito** para ver trabajar la skill [permisos](../../plugins/permisos/skills/permisos/SKILL.md).
Dos empresas comparten el sistema y cada una tiene tres roles: admin, editor y lector.

> [!CAUTION]
> No la publiques en ningún servidor. Solo escucha en `127.0.0.1`.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node server.js     # http://localhost:4400  (los archivos adjuntos quedan en ./almacen)
node --test        # pruebas (usan una carpeta temporal, no tocan ./almacen)
```

Usuarios de prueba (contraseña `demo123`):

| Usuario | Empresa | Rol |
|---|---|---|
| `ana@empresa-a.test` | A | admin |
| `eli@empresa-a.test` | A | editor |
| `leo@empresa-a.test` | A | lector |
| `beto@empresa-b.test` | B | admin |
| `bea@empresa-b.test` | B | editor |

Lo que el negocio quiere: **exportar, cambiar roles, ver la bitácora, "ver como" y borrar la cuenta son solo para admin.**

## Reto

Antes de correr la skill, intenta encontrar las fallas tú mismo. Hay al menos **ocho**.
Después corre `/permisos:permisos` y compara.

<details>
<summary>Ver la lista (spoiler)</summary>

1. **Acción de admin escondida solo en el front:** cualquier rol puede cambiar roles (`PATCH /api/usuarios/:id/rol`). Un lector se hace admin.
2. **El editor puede exportar:** la regla de `permisos.js` lo permite aunque el front solo le muestra el botón al admin.
3. **La exportación saca todo:** documentos y correos de **todas** las empresas, no solo la tuya.
4. **"Ver como" sin registro:** no queda en la bitácora quién entró como quién.
5. **"Ver como" sin aviso ni caducidad:** `/api/yo` no dice que es una suplantación y la sesión nunca vence.
6. **"Ver como" permite acciones peligrosas:** el admin puede cambiar la contraseña del usuario suplantado.
7. **Borrado de cuenta incompleto:** quedan los archivos en `almacen/cuenta-<id>/`, las entradas del buscador, la caché y las sesiones abiertas.
8. **Bitácora casi vacía:** solo se registra el borrado de documentos; cambios de rol, exportaciones y borrado de cuenta no dejan rastro.

</details>
