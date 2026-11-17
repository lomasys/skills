---
name: produccion
description: Use when the user is about to deploy or release and asks if it is ready (¿está listo para subir?, antes de desplegar, revisar el deploy, release checklist), shares production logs, an error export or Sentry data and asks what is failing or what to fix first (errores en producción, qué está pasando), asks which alerts or monitoring to set up (monitoreo, alertas, uptime, enterarme antes que mis clientes), needs a post mortem or incident write-up after an outage (post mortem, falla, caída, incidente), or wants release notes or a changelog written for customers (notas para clientes, novedades, qué hay de nuevo).
---

# Producción

Revisa cada despliegue antes de subirlo y da un semáforo con la lista de pendientes. También ordena los errores de producción
por causa e impacto, arma las alertas mínimas, escribe el post mortem y convierte lo terminado en novedades para clientes.

**Principio:** lo que no tiene evidencia en el repositorio no cuenta como listo. Si no ves el plan para regresar, no hay plan.

## Modos

Lee el argumento que escribió el usuario (`/produccion:produccion <modo>` o `/produccion <modo>`):

| Argumento | Qué hace |
|---|---|
| *(nada)* o `antes` | Revisión antes de subir: semáforo **listo / con riesgos / no subir** y la lista de pendientes |
| `errores <archivo>` | Agrupa un log o export de errores por causa, los ordena por impacto y propone arreglos con `archivo:línea` |
| `monitoreo` | Las alertas que hay que tener sí o sí, con opciones baratas y la configuración para lo que ya usa el usuario |
| `postmortem` | Documento sin culpables después de una falla, con acciones, responsable y fecha |
| `notas <rango>` | Novedades para clientes en palabras simples a partir de commits, PRs y changelog (rango: `v1.2.0..HEAD`, fechas o PRs) |

## Reglas (no negociables)

1. **Nunca despliega, ni regresa versiones (rollback), ni reinicia servicios.** Ni en producción ni en pruebas. Tú revisas y propones; el usuario sube.
   Nada de `git push`, `deploy`, `kubectl apply/rollout`, `heroku`/`fly`/`render`/`vercel` que cambien algo, ni `migrate` contra otra base que no sea local.
2. **Nada que escriba en producción.** Ni migraciones, ni consultas que cambien datos, ni cambiar variables de entorno o banderas.
3. **Logs solo de dos fuentes:** el archivo o texto que el usuario te da, o un comando **de solo lectura** que tú propones y el usuario aprueba
   antes de correrlo (por ejemplo `heroku logs --tail -n 500`, `kubectl logs`, `fly logs`). Nunca te conectas por tu cuenta.
4. **No cambias código ni configuración sin permiso.** Puedes correr pruebas y build en local. Propones los arreglos y aplicas solo los que el usuario apruebe, uno por uno.
5. **Solo apagas lo que tú prendiste.** Si levantas algo local, guarda su PID y detén solo ese. Nunca `taskkill /IM`, `killall` ni `pkill`.
6. **Nada destructivo y nada instalado sin preguntar.** Sin `rm -rf`, sin `git push --force`, sin borrar datos, sin paquetes nuevos.
7. **Secretos y datos personales tapados.** En cualquier reporte, máximo los primeros 4 caracteres de una clave; correos como `m***@dominio`.
   Si un log trae una clave, dilo primero: hay que rotarla.
8. **Las notas para clientes nunca llevan** nombres de clientes, números de ticket, nombres internos de sistemas, personas del equipo
   ni arreglos de seguridad (decir que se cerró un hoyo avisa que existió). Ante la duda, fuera.

| Pensamiento | Realidad |
|---|---|
| "Solo es un `git push`, el usuario ya dijo que quería subir" | Subir es decisión del usuario. Tú das el semáforo. |
| "La migración es simple" | Un `DROP` no se regresa con un rollback del código. Sin respaldo, los datos se pierden. |
| "Las pruebas fallan pero es una tontería" | Una prueba fallando es 🔴 hasta que el usuario decida otra cosa. |
| "Pongo 'reforzamos la seguridad de los reportes'" | Eso le dice a todos que antes se podía ver lo ajeno. No va. |

## Proceso

**Antes de todo:** entiende cómo se despliega (manifiesto: `render.yaml`, `fly.toml`, `Procfile`, `app.json`, `docker-compose.yml`,
`vercel.json`, `.github/workflows/`, Helm o Terraform; README), qué corre al subir (migraciones automáticas, build) y cuál es la
**última versión en producción** (tag, rama de release o lo que diga el usuario). Si no lo sabes, pregúntalo una vez y sigue.

### `antes`
1. Define qué se va a subir: `git diff <ultima-en-produccion>..HEAD` más lo que no tiene commit. Si hay cambios sin commit, pregunta si van;
   si no puedes preguntar, revisa todo y marca cada pendiente con *(sin commit)* para que se vea qué semáforo queda con y sin ellos.
   Pregunta también si hay parches hechos directo en producción o en otra rama: si no están en lo que se sube, el despliegue los borra.
2. Corre las 7 revisiones de [referencias/antes.md](referencias/antes.md) en orden: pruebas y build · migraciones · variables de entorno · dependencias · banderas · plan para regresar · otros riesgos del cambio.
3. Para variables de entorno usa la herramienta (ruta relativa a esta skill), no lo hagas a ojo:
   `node <carpeta-de-esta-skill>/scripts/variables.mjs . --desde <ultima-en-produccion>`
4. Si una migración borra, renombra, cambia tipos o bloquea una tabla grande, márcala y **recomienda la skill `migraciones`** para planearla.
5. Decide el semáforo con la tabla de [referencias/antes.md](referencias/antes.md) y entrega el reporte.

### `errores <archivo>`
1. Corre `node <carpeta-de-esta-skill>/scripts/errores.mjs <archivo>`. Tapa secretos, agrupa por causa y ordena por usuarios afectados.
2. Para cada grupo importante abre el `archivo:línea` que reporta, confirma la causa en el código y escribe el arreglo concreto.
3. Ordena por impacto con [referencias/errores.md](referencias/errores.md): dinero y clientes afectados primero, ruido al final.

### `monitoreo`
Revisa qué usa ya el usuario (plataforma, base, colas, dominio, servicio de errores) y sigue [referencias/monitoreo.md](referencias/monitoreo.md).
Las seis alertas mínimas siempre: caída, lentitud, tasa de errores, cola atorada, disco o base llena, certificado por vencer.

### `postmortem`
Pide lo que falte (qué se vio, horas, qué se hizo). Junta evidencia: logs que te den, commits y despliegues de esas horas.
Escribe con la plantilla de [referencias/postmortem.md](referencias/postmortem.md) en `postmortems/AAAA-MM-DD-<tema>.md` (archivo nuevo; permitido).

### `notas <rango>`
Lee commits, PRs y changelog del rango, quita todo lo interno y escribe con [referencias/notas.md](referencias/notas.md).
Solo incluye lo que **ya está publicado**; si algo del rango no ha subido, sepáralo y avísalo.

## Reporte

Siempre empieza con una línea de resumen en palabras de negocio. Formato por modo:

**`antes`**, en este orden: semáforo · bloqueantes · riesgos · revisado y bien · plan para regresar · siguiente paso.

```markdown
## 🔴 No subir · 🟠 Con riesgos · 🟢 Listo   ← solo uno
<una oración: por qué, en términos de clientes y dinero>

### Bloqueantes (arreglar antes de subir)
1. **<qué pasa si se sube así>** · `<archivo>:<línea>` · <qué hacer>

### Riesgos (se puede subir si el usuario los acepta)
1. **<riesgo>** · <cómo bajarlo>

### Revisado
| Revisión | Estado | Evidencia |
|---|---|---|
| Pruebas y build | ✅/❌ | `npm test`: 41 pasan, 1 falla |
| Migraciones | ✅/⚠️/❌ | … |
| Variables de entorno | … | … |
| Dependencias | … | … |
| Banderas | … | … |
| Plan para regresar | … | … |

### Plan para regresar
<pasos concretos: a qué versión, con qué comando o botón, cuánto tarda y qué NO se regresa (datos, migraciones, correos enviados)>

### Siguiente paso
"¿Arreglo el #1? Después vuelvo a correr la revisión."
```

**`errores`**: avisos de secretos o datos personales en el log (si hay) · tabla de grupos (veces, usuarios, desde, `archivo:línea`) ·
por cada grupo importante: qué le pasa al cliente, causa, arreglo con `archivo:línea` · ruido que se puede ignorar · siguiente paso.

**`monitoreo`**: tabla de las 6 alertas (qué mide, umbral, herramienta, costo, si ya existe) · configuración concreta · qué no alertar.

**`postmortem`**: el archivo creado y un resumen de 3 líneas. **`notas`**: el texto listo para pegar y, aparte, lo que dejaste fuera y por qué.

## Errores comunes

- **Confiar en el mensaje del commit.** "refactor de db.js" puede no tocar `db.js`. Revisa el diff, no el título.
- **Olvidar lo que corre solo al subir.** Si el manifiesto corre migraciones antes de arrancar, una migración mala sale aunque nadie la "corra".
- **"El rollback es regresar el commit".** Eso no regresa datos borrados, columnas, correos enviados ni cobros hechos. Dilo en el plan.
- **Ordenar errores por cantidad.** 120 avisos de desuso pesan menos que 9 cobros colgados. Ordena por clientes y dinero.
- **Alertas para todo.** Si suenan por ruido, se ignoran. Cada alerta debe tener una acción clara.
- **Culpar personas en el post mortem.** "Juan subió sin probar" no previene nada. "Nada impedía subir con pruebas fallando" sí.
