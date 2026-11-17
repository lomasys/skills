# Revisión antes de subir

Siete revisiones, en este orden. Cada una termina en ✅ bien, ⚠️ riesgo o ❌ bloqueante, con su evidencia
(el comando que corriste y lo que salió, o el `archivo:línea`).

Primero define **qué se va a subir**:

```bash
git describe --tags --abbrev=0            # última versión publicada, si usan tags
git log --oneline <ultima>..HEAD          # commits que van
git diff --stat <ultima>..HEAD            # archivos que cambian
git status --short                        # cambios sin commit: ¿van o no?
```

Si no hay tags ni rama de producción, pregunta qué commit está en producción. No lo adivines.

---

## 1. Pruebas y build

Corre los comandos del proyecto **en local** (README, `package.json`, `Makefile`, CI en `.github/workflows/`).

| Stack | Pruebas | Build / chequeo |
|---|---|---|
| Node | `npm test` (o `pnpm test`, `yarn test`) | `npm run build`, `npx tsc --noEmit` si hay TypeScript |
| Rails | `bin/rails test` o `bundle exec rspec` | `bin/rails assets:precompile` si aplica, `bin/rails zeitwerk:check` |
| Django / Python | `python manage.py test` o `pytest` | `python manage.py check --deploy` |
| Laravel | `php artisan test` o `vendor/bin/phpunit` | `composer validate`, `php artisan config:cache` en una copia |
| Go | `go test ./...` | `go build ./...` |

- Una prueba que falla es **❌**. No digas "es menor".
- Si la prueba necesita un servicio que no tienes (base, Redis), dilo como ⚠️ "no se pudo correr" y qué faltó.
- Revisa también que lo que va a correr el servidor funcione: por ejemplo `npm ci` necesita `package-lock.json`.

## 2. Migraciones

Busca migraciones nuevas en el rango: `db/migrate/` (Rails), `*/migrations/` (Django), `database/migrations/` (Laravel),
`migrations/`, `prisma/migrations/`, `drizzle/`, `knex`, `sequelize`, `alembic/versions/`, `flyway`, archivos `.sql`.

Mira en el manifiesto **cuándo corren**: `preDeployCommand`, `release:` en `Procfile`, `release_command` en `fly.toml`, un paso de CI.
Si corren solas al subir, cualquier riesgo de aquí pasa directo a producción.

| Lo que hace la migración | Estado | Por qué |
|---|---|---|
| Crear tabla, agregar columna que acepta vacío, agregar índice en tabla chica | ✅ | Se puede subir y regresar |
| Agregar columna obligatoria sin valor por defecto | ❌ | Truena con los datos que ya existen |
| Índice en tabla grande sin `CONCURRENTLY` (Postgres) o sin `ALGORITHM=INPLACE` (MySQL) | ⚠️ | Bloquea escrituras mientras se crea |
| Borrar columna o tabla (`DROP`, `remove_column`, `RemoveField`, `dropColumn`) | ❌ | Se pierden datos y el rollback del código no los regresa |
| Renombrar columna o tabla, cambiar tipo | ❌ | El código viejo truena durante el despliegue |
| Actualizar o borrar muchas filas | ⚠️/❌ | Tarda, bloquea y no se puede regresar sin respaldo |

Para cada ⚠️ o ❌ revisa además:
- **¿El código todavía usa lo que se borra?** Busca el nombre de la columna en el código (`grep -rn telefono src/`).
  Si sí, se rompe en cuanto corra la migración.
- **¿Hay respaldo antes y se probó restaurarlo?**
- **El orden seguro** es en varios despliegues: primero el código deja de usar la columna, después se borra.

Si hay cualquier ❌ o ⚠️ aquí, termina el punto con: *"Para planear esta migración paso a paso usa la skill `migraciones`."*

## 3. Variables de entorno

Usa la herramienta de la skill. Compara lo que lee el código con `.env.example` y con los manifiestos de despliegue:

```bash
node <carpeta-de-esta-skill>/scripts/variables.mjs . --desde <ultima-en-produccion>
```

- `FALTA (nueva)` → ❌: el código nuevo la usa y no está en ningún manifiesto. En producción va a valer vacío.
- `sin manifiesto` (y no es nueva) → ⚠️: puede estar puesta a mano en el panel de la plataforma. Pregunta.
- `falta en ejemplo` → ⚠️ menor: el siguiente que levante el proyecto no sabrá que existe.
- Si las variables se ponen a mano en un panel (Heroku, Vercel, Railway), la herramienta no lo puede ver: pide al usuario que confirme cada nueva.

Nunca muestres el valor de una variable. Solo su nombre.

## 4. Dependencias

```bash
git diff <ultima>..HEAD -- package.json package-lock.json pnpm-lock.yaml yarn.lock Gemfile Gemfile.lock requirements*.txt poetry.lock Pipfile.lock composer.json composer.lock go.mod go.sum Cargo.toml Cargo.lock
```

- Sin cambios → ✅ "sin cambios de dependencias".
- Paquete nuevo o cambio de versión mayor (1.x → 2.x) → ⚠️: lista cuál y qué usa del paquete.
- Cambió el manifiesto pero no el archivo de versiones fijas (lockfile), o no hay lockfile → ⚠️/❌: en el servidor se instalará otra cosa.
- Si existe, corre la auditoría local (`npm audit --omit=dev`, `bundle exec bundler-audit`, `pip-audit`, `composer audit`). No instales herramientas.

## 5. Banderas de funciones

Busca banderas en el diff: `flags`, `feature`, `FEATURE_`, `FLAG_`, `Flipper`, `LaunchDarkly`, `Unleash`, `GrowthBook`, `waffle`, `Pennant`.

- Función nueva y riesgosa (cobros, precios, permisos) **sin** bandera → ⚠️: si falla, solo se apaga subiendo otra versión.
- Bandera escrita como `true` en el código → ⚠️: no se puede apagar sin desplegar. Debe leer una variable o el servicio de banderas.
- Bandera nueva que nace encendida para todos → ⚠️: propone prenderla primero para pocos.
- Bandera vieja que ya está al 100 % desde hace meses → nota menor: se puede limpiar.

## 6. Plan para regresar

Busca un plan **escrito** (README, `docs/`, `RUNBOOK`, `DEPLOY.md`) y cómo funciona la plataforma:

| Plataforma | Cómo se regresa (lo hace el usuario, nunca tú) |
|---|---|
| Render | Panel → Deploys → "Rollback" a un despliegue anterior |
| Heroku | `heroku releases` y `heroku rollback vNN` |
| Fly.io | `fly releases` y `fly deploy --image <imagen-anterior>` |
| Vercel / Netlify | Promover un despliegue anterior desde el panel |
| Kubernetes | `kubectl rollout undo deployment/<nombre>` |
| Servidor propio | Volver al tag anterior y repetir el despliegue |

El plan cuenta solo si dice: **a qué versión** se regresa, **con qué paso exacto**, **quién** lo hace y **qué no se regresa**
(migraciones que borraron, correos y cobros ya hechos, datos escritos con el formato nuevo).

- No hay plan escrito → ⚠️ y escribe tú el borrador en el reporte con los datos de la tabla.
- Hay una migración que no se puede regresar → el rollback del código **no** salva los datos: ❌ si no hay respaldo.

## 7. Otros riesgos del cambio

Lee el diff completo con estas preguntas:
- ¿Cambia cobros, precios, permisos, correos masivos o algo que no se puede deshacer? ¿Tiene prueba?
- ¿El código nuevo llama a un servicio externo sin tiempo límite?
- ¿El título del commit coincide con lo que de verdad cambió?
- ¿Algo se va a subir que el changelog dice "sin publicar" o al revés?
- ¿Hay un parche que se hizo directo en el servidor o en otra rama (un arreglo de emergencia) y no está en lo que se sube?
  Búscalo con `git branch -a --no-merged`, `git log --all --since=<fecha>` y pregúntalo. Si existe, subir lo borra: ❌.

**Problemas que ya estaban** antes de este cambio (y siguen igual): van en Riesgos con la marca *(ya estaba)*.
Solo son ❌ si impiden que el despliegue termine (por ejemplo, el comando de build falla) o si este cambio los empeora.
Para comprobar comandos que instalan (`npm ci`, `bundle install`) usa su modo de prueba (`npm ci --dry-run`) o léelos; no instales.

---

## Semáforo

| Resultado | Cuándo |
|---|---|
| 🔴 **No subir** | Al menos un ❌: pruebas o build fallan, migración que borra sin respaldo o con código que aún la usa, variable nueva que falta en producción, cambio de dinero sin prueba |
| 🟠 **Con riesgos** | Sin ❌ pero con ⚠️: no hay plan escrito para regresar, función riesgosa sin bandera, dependencia mayor, variable que no se pudo confirmar |
| 🟢 **Listo** | Todo ✅ y existe un plan concreto para regresar |

Sin plan para regresar nunca es 🟢.
