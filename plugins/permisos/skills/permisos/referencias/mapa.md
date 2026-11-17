# Cómo armar el mapa de permisos

El mapa es una tabla **acción × rol** con tres miradas por celda: lo que quiere el negocio, lo que permite hoy el servidor
y lo que muestra el front. Las diferencias entre ellas son los hallazgos.

## 1. Lista todas las acciones del servidor

Empieza por las rutas, no por las políticas: una ruta sin política es justo lo que buscas.

| Stack | Dónde están las rutas | Dónde se deciden los permisos |
|---|---|---|
| Rails | `bin/rails routes`, `config/routes.rb` | Pundit (`app/policies/*_policy.rb`, `authorize`, `policy_scope`), CanCanCan (`app/models/ability.rb`, `load_and_authorize_resource`), `before_action` |
| Node (Express, Fastify, Nest) | `app.get/post…`, `router.*`, decoradores `@Get/@Post` | middlewares (`requireRole`, `isAdmin`), guards de Nest (`@UseGuards`, `@Roles`), CASL (`defineAbility`, `ability.can`) |
| Django | `urls.py`, routers de DRF | `permission_classes`, `has_permission`/`has_object_permission`, `@permission_required`, `user.has_perm`, `get_queryset` |
| Laravel | `php artisan route:list`, `routes/*.php` | Policies (`app/Policies`), Gates (`Gate::define`), `$this->authorize`, middleware `can:` |
| Next.js / Remix | `app/api/**/route.ts`, `pages/api`, server actions | revisiones dentro de cada handler; middleware de `middleware.ts` |
| Laravel/Rails/Django admin | paneles autogenerados | suelen tener reglas propias: revísalos aparte |

Incluye también: exportaciones y descargas, invitaciones, cambio de rol, facturación, webhooks internos, tareas en segundo plano
que se disparan desde la app, GraphQL (cada mutation es una acción) y endpoints "temporales" o de depuración.

## 2. Para cada acción, anota qué la protege

- **Archivo y línea** de la revisión (o "ninguna").
- **Revisa rol**: ¿qué roles deja pasar? Lee la regla, no el nombre de la función.
- **Revisa cuenta**: ¿busca el registro dentro de la cuenta del usuario (`current_account.docs.find`, `where(account_id:)`, `get_queryset` filtrado)?
- **Revisa dueño**, si aplica (solo el autor edita su comentario).

Si una política existe pero la ruta no la llama, la acción está **sin protección**.

## 3. Lee el front

Busca condicionales por rol en las plantillas y componentes: `v-if="isAdmin"`, `{user.role === 'admin' && …}`, `@can` en Blade,
`<% if policy(@x).destroy? %>`, `data-roles`, rutas protegidas del router del front. Anota qué rol ve cada botón.

## 4. Busca la regla del negocio

En este orden: lo que diga el usuario, documentación o README, textos de la pantalla ("Solo los administradores pueden…"),
tickets o historias. Si no la encuentras, la celda queda **Por decidir**.

## Plantilla de `permisos/mapa.md`

```markdown
# Mapa de permisos

Generado el <fecha>. Cuentas separadas por: `<campo, ej. account_id>`. Roles: admin, editor, lector.
Pruebas: `<ruta del archivo de pruebas>` (correr con `<comando>`).

Leyenda: ✅ permitido · ⛔ denegado · ❓ por decidir. En **Hoy**, ⚠️ marca una diferencia con el negocio.

| Acción | Ruta | Protección en el servidor | admin | editor | lector | Otra cuenta | Front muestra a |
|---|---|---|---|---|---|---|---|
| Ver documentos | `GET /api/documentos` | `puede('documentos.ver')` + filtro de cuenta · `server.js:78` | ✅ | ✅ | ✅ | ⛔ | todos |
| Exportar | `GET /api/documentos/exportar` | `puede('documentos.exportar')` · `server.js:121` | ✅ | ⛔ (Hoy ✅ ⚠️) | ⛔ | ⛔ (Hoy ve todo ⚠️) | admin |
| Cambiar rol | `PATCH /api/usuarios/:id/rol` | **ninguna** · `server.js:140` | ✅ | ⛔ (Hoy ✅ ⚠️) | ⛔ (Hoy ✅ ⚠️) | ⛔ | admin |

## Diferencias

1. <acción>: <qué pasa hoy> y <qué quiere el negocio>. Hallazgo #<n>.

## Por decidir

- <pregunta de negocio>
```

Una celda tiene el valor del **negocio**; si hoy es distinto, se agrega `(Hoy … ⚠️)`. Así el mapa sirve de especificación
después de arreglar, y las pruebas se generan de la misma tabla.
