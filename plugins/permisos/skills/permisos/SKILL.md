---
name: permisos
description: Use when the user wants to document or lock down who can do what in an app with roles or many customer accounts (multi-tenant) - a roles and permissions matrix, permission tests per role, admin-only actions, a "view as" / impersonation feature for support, an audit log of who changed what, or fully deleting a customer's account and data (GDPR erasure, offboarding). Spanish cues: permisos, roles, quién puede hacer qué, matriz de permisos, ver como, suplantar usuario, bitácora, auditoría, borrar cuenta, borrar cliente, datos huérfanos.
---

# Permisos

Saca del código **quién puede hacer qué**, lo compara con lo que el negocio quiere y deja pruebas por rol que lo vigilan.
Revisa también el "ver como", la bitácora de auditoría y el borrado completo de un cliente.

**Principio:** la regla correcta sale del negocio, no del código. Si el código dice que el editor exporta y el negocio dice
que solo el admin, el código está mal, aunque `permisos.js` lo diga con toda claridad.

## Modos

Lee el argumento que escribió el usuario (`/permisos:permisos <modo>` o `/permisos <modo>`):

| Argumento | Qué hace |
|---|---|
| *(nada)* | Mapa de permisos + pruebas por rol |
| `mapa` | Solo el mapa: `permisos/mapa.md` |
| `pruebas` | Solo las pruebas, a partir del mapa que ya existe (si no existe, primero lo arma) |
| `ver-como` | Revisa la suplantación de usuarios ([referencias/ver-como.md](referencias/ver-como.md)) |
| `auditoria` | Qué acciones deben dejar registro, cuáles lo dejan hoy y cómo implementarlo ([referencias/auditoria.md](referencias/auditoria.md)) |
| `borrado` | Que borrar un cliente borre todo lo suyo y nada ajeno ([referencias/borrado.md](referencias/borrado.md)) |

Si el usuario lo pide con sus palabras, junta los modos que mencione (ej.: "documenta los permisos y revisa el ver como" = *(nada)* + `ver-como`).

Buscar y atacar hoyos de acceso es trabajo de la skill `seguridad`. Si ves XSS, contraseñas en texto plano u otros hoyos
fuera de este tema, anótalos en una línea en "Fuera de alcance" y sugiere `/seguridad`.

## Reglas (no negociables)

1. **Solo local o pruebas.** Las pruebas y las peticiones van a `localhost`, un contenedor local o la base de pruebas. Nunca a producción ni staging sin permiso explícito.
2. **No cambias reglas de permisos ni código sin permiso.** Solo creas archivos nuevos: `permisos/mapa.md` y las pruebas.
   No edites el README, la configuración ni las políticas. Los arreglos los propones y los aplicas uno por uno cuando el usuario lo pida.
3. **El borrado se verifica solo con datos creados para eso**, en una base local o de pruebas: crea una cuenta desechable con todo
   (usuarios, registros, archivos, búsquedas) y bórrala. Nunca borres una cuenta del seed que otros usan, ni datos del usuario.
4. **Datos de prueba siempre.** Las pruebas usan fixtures, factories o datos que ellas mismas crean, nunca copias de clientes reales.
5. **Solo apagas lo que tú prendiste.** Si levantas la app, guarda su PID y detén ese PID. Nunca `taskkill /IM`, `killall` ni `pkill` por nombre.
6. **Nada destructivo fuera de tus datos.** Sin `DELETE`/`TRUNCATE` masivos, sin `rm -rf`. Si una prueba cambió algo que no creó, regrésalo.
7. **No instalas nada sin preguntar.** Usa el framework de pruebas que ya tiene el proyecto.
8. **No copies secretos ni datos personales** al mapa ni al reporte (máximo 4 caracteres de una clave).

| Pensamiento | Realidad |
|---|---|
| "`permisos.js` dice que el editor exporta, así que es correcto" | Esa es la regla a revisar, no la verdad. Pregunta o busca la regla del negocio. |
| "Marco las pruebas que fallan como `todo` para que la suite quede verde" | Escondes los hallazgos. Se quedan fallando; solo se marcan si el usuario lo pide. |
| "Agrego el enlace al mapa en el README" | Es un archivo del usuario. Propónlo. |
| "Que la prueba de auditoría espere el campo `adminOriginalId`" | Es un nombre que inventaste. Prueba lo que se ve: que la acción aparece en la bitácora con quién y cuándo. |
| "Al borrar la cuenta borro también su bitácora" | La bitácora suele tener que conservarse por ley o contrato. Anonimízala y pregunta la política. |

## Proceso

1. **Entiende el sistema.** Identifica: qué separa a un cliente de otro (cuenta, empresa, organización, workspace),
   los roles, dónde se deciden los permisos y cómo se escriben las pruebas (framework, carpeta, ayudas de login).
2. **Encuentra la regla del negocio** para cada rol: README, documentación, textos de la pantalla, tickets, o el usuario.
   Si no hay regla clara para una acción, márcala **"Por decidir"** y pregunta. No escribas una prueba que adivine.
3. **Arma el mapa** siguiendo [referencias/mapa.md](referencias/mapa.md): cada ruta o acción del servidor, qué lo protege
   (archivo y línea), qué permite hoy por rol, qué muestra el front y qué quiere el negocio. Guárdalo en `permisos/mapa.md`.
4. **Escribe las pruebas** con [referencias/pruebas.md](referencias/pruebas.md): cada acción × cada rol, más un usuario de otra cuenta
   y uno sin sesión. El valor esperado sale de la columna **Negocio**, no de **Hoy**. Van en un archivo propio (por ejemplo `test/permisos/`).
5. **Córrelas.** Las que fallan son hallazgos: confírmalos leyendo la respuesta real. Si la falla es culpa de la prueba, corrige la prueba.
   No las escondas con `skip`, `todo` ni `xfail`.
6. **Según el modo**, revisa ver-como, auditoría o borrado con su referencia.
7. **Entrega el reporte** y pregunta qué arreglar. Al arreglar uno, corre su prueba y confirma que ya pasa.

## Reporte

Las partes, en este orden:

**1. Resumen.** Dos o tres oraciones: cuántas acciones revisaste, cuántas fallan, la peor en palabras de negocio, y cómo correr las pruebas.

**2. Mapa.** Enlace a `permisos/mapa.md` y solo las filas donde **Hoy ≠ Negocio** o **Front ≠ Servidor**.

**3. Hallazgos**, del más grave al menos grave, con este formato exacto:

```markdown
### 🔴 Grave: <qué puede pasar, en palabras de negocio>
`<método y ruta o acción>` · `<archivo>:<línea>`

- **Debería:** <regla del negocio> (fuente: <README, pantalla, el usuario>)
- **Hoy:** <rol y cuenta> hizo <petición> → <respuesta>
- **Prueba:** `<archivo>` › "<nombre de la prueba>": falla hoy  (o "Sin prueba: <razón>", ej. caducidad leída en el código)
- **Arreglo propuesto:** <el cambio concreto, en una o dos líneas>
```

Gravedad: 🔴 **Grave** (datos de otro cliente, tomar control de la cuenta, acciones peligrosas durante un "ver como", borrado incompleto de datos personales) ·
🟠 **Alta** (un rol hace algo de otro rol) · 🟡 **Media** (falta registro o aviso) · ⚪ **Baja**.

**4. Por decidir.** Preguntas de negocio que el código no puede contestar (ej.: "¿un admin puede ver como otro admin?").

**5. Bien hecho.** Hasta cinco protecciones que sí funcionan y que las pruebas confirman. Así el usuario sabe qué no tocar.

**6. Fuera de alcance.** Una línea por cada hoyo de otro tema, con la sugerencia de `/seguridad`.

**7. Siguiente paso.** Una pregunta: *"¿Cuáles arreglo? Empiezo por el #1 y te muestro su prueba pasando."*

Escribe para alguien que programa pero no es experto en seguridad: frases cortas, el riesgo en clientes, dinero y tiempo.

## Errores comunes

- **Copiar la regla del código a la prueba.** La prueba pasa y el error queda protegido para siempre.
- **Revisar solo el front.** Un botón escondido no protege nada. Cada acción se prueba llamando directo al servidor.
- **Olvidar al usuario de otra cuenta.** Un admin de la empresa B no es admin de la empresa A.
- **Revisar solo ver y editar.** Exportar, cambiar roles, invitar, facturación, descargas y trabajos en segundo plano también son acciones.
- **Borrado que solo mira la base de datos.** Los archivos, el buscador, la caché, las sesiones y los servicios externos también guardan datos del cliente.
- **Ver-como que solo se revisa al entrar.** También hay que probar qué se puede hacer adentro y cómo se sale.
