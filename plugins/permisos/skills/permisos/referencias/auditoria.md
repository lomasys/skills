# Bitácora de auditoría

Cuando un cliente pregunta "¿quién borró esto?" o un auditor pide evidencia de accesos, la bitácora es la única respuesta.
No es el log de la aplicación: es un registro de negocio que no se borra con la rotación de logs.

## Qué debe quedar registrado

Siempre, como mínimo:

| Acción | Por qué |
|---|---|
| Cambiar roles o permisos, invitar o quitar usuarios | Así se toma el control de una cuenta |
| Iniciar y terminar un "ver como", y lo hecho durante él | Ver [ver-como.md](ver-como.md) |
| Exportaciones y descargas masivas | Es la forma más fácil de sacar todos los datos |
| Borrados (registros, usuarios, la cuenta completa) | Reclamos de "se perdió mi información" |
| Cambios de contraseña, correo, doble factor, llaves de API | Señal de cuenta tomada |
| Facturación: plan, método de pago, reembolsos | Dinero |
| Cambios de configuración de seguridad de la cuenta (SSO, dominios permitidos) | Afectan a todos los usuarios |

Lectura de datos sensibles (salud, nómina, datos de tarjetas) solo si el negocio o la ley lo pide: genera mucho volumen.

## Cada entrada

`cuándo` (UTC) · `cuenta` · `quién` (usuario real y, si aplica, suplantador) · `acción` (nombre estable, ej. `usuarios.cambiar_rol`) ·
`objeto` (tipo e id) · `antes` y `después` de los campos que cambiaron · `origen` (IP, agente de usuario o "tarea en segundo plano").

**Nunca** guardes contraseñas, tokens ni el contenido completo de documentos en `antes`/`después`.

## Cómo revisarla

1. Lista las acciones de la tabla de arriba que existen en el sistema (salen del mapa).
2. Para cada una, busca si escribe en la bitácora (`audit`, `paper_trail`, `audited`, `django-simple-history`, `django-auditlog`,
   `owen-it/laravel-auditing`, `spatie/laravel-activitylog`, tablas `*_audit`, `activity_log`, `events`).
3. Comprueba con una prueba: haz la acción y revisa que apareció una entrada nueva que nombra al usuario y al objeto.
   Las que no aparecen son hallazgos 🟡 (🟠 si es cambio de rol, ver-como o exportación).
4. Revisa que un usuario **no** pueda borrar ni editar la bitácora, y que un cliente solo vea la de su cuenta.

## Propuesta de implementación

Presenta una sola propuesta, adaptada al stack, para que el usuario la apruebe:

| Stack | Opción sencilla |
|---|---|
| Rails | `audited` o `paper_trail` en los modelos clave + un `AuditLog.create!` explícito para acciones que no son cambios de modelo (exportar, ver-como) |
| Django | `django-auditlog` o `django-simple-history` + función `registrar()` para acciones |
| Laravel | `spatie/laravel-activitylog` (`activity()->performedOn($x)->causedBy($u)->log('...')`) |
| Node | tabla `audit_log` + una función `registrar(req, accion, objeto, cambios)` llamada desde el mismo middleware o servicio que revisa permisos |
| Postgres | triggers que copian `OLD`/`NEW` a una tabla de auditoría, si el cambio puede venir de fuera de la app |

Tabla sugerida: `audit_log(id, created_at, account_id, actor_id, impersonator_id, action, target_type, target_id, changes jsonb, ip)`,
con índice por `(account_id, created_at)`, solo inserciones (sin `UPDATE`/`DELETE` desde la app) y una política de retención escrita.

Instalar una librería es instalar algo: pregúntalo antes (regla 7).
