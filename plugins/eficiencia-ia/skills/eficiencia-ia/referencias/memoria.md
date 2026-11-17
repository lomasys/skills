# Memoria del proyecto: el archivo de instrucciones

Es lo primero que lee el agente en **cada** conversación. Lo que pongas ahí se paga en tokens cada vez,
y lo que falte se paga en minutos: el agente lo redescubre leyendo archivos y probando comandos que fallan.

## Qué archivo lee cada herramienta

Las herramientas cambian seguido. Revisa la documentación de la versión del usuario si algo no cuadra.

| Herramienta | Lee | Nota |
|---|---|---|
| Codex | `AGENTS.md` (raíz y subcarpetas: manda el más cercano) | |
| Cursor | `.cursor/rules/*.mdc` y `AGENTS.md` | Las reglas `.mdc` pueden aplicarse solo a ciertos archivos (`globs`) |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` (`applyTo`) y `AGENTS.md` | |
| Claude Code | `CLAUDE.md` (raíz, subcarpetas y `~/.claude/CLAUDE.md`) | Importa otros archivos con `@ruta` |
| Gemini CLI | `GEMINI.md` | Se puede configurar para leer `AGENTS.md` |

**Recomendación por defecto:** una sola fuente de verdad en `AGENTS.md`. Para Claude Code, un `CLAUDE.md` de una línea: `@AGENTS.md`.
Para Gemini, un `GEMINI.md` que diga "Lee AGENTS.md" o la opción de configuración (mostrarla, no aplicarla sin permiso).
Si ya existen varios archivos con reglas distintas, **no los juntes sin preguntar**: muestra las contradicciones y pregunta cuál manda.

## Qué va y qué no

| Va (el agente no lo puede adivinar) | No va (ya está en el código o el agente lo ve solo) |
|---|---|
| Comandos exactos para instalar, correr, probar una sola prueba, revisar estilo y tipos | Lista de carpetas y archivos |
| Qué **no** correr (`npm install` si no hay dependencias, migraciones contra la base compartida) | Lo que dice el README, copiado (apunta: "usuarios de prueba: ver README") |
| Trampas conocidas: "las pruebas necesitan Postgres en 5433", "no edites `generated/`" | Explicar el lenguaje o el framework |
| Decisiones que no se ven en el código y su porqué, en una línea | Historia del proyecto, nombres del equipo |
| Cómo se verifica que algo está terminado | Reglas que ya impone el linter o el formateador |
| Puertos, variables de entorno **requeridas** (nombres, nunca valores) | Secretos, URLs de producción con credenciales |

Meta: **menos de 60 líneas**. Si pasa de 100, mueve lo específico a un archivo por carpeta (`api/AGENTS.md`) o a una regla con `globs`.

## Cómo armarlo

1. **Lee lo que ya hay:** archivos de instrucciones, README, scripts (`package.json`, `Makefile`, `Rakefile`, `composer.json`, `pyproject.toml`), CI (`.github/workflows/`). El CI dice qué comandos de verdad corren.
2. **Corre cada comando** candidato. Anota resultado y tiempo. Si un servidor tiene que levantar, levántalo como proceso hijo, confirma que responde y **detén solo ese PID**.
   - Si falla, ¿falla siempre o por el ambiente? Si es trampa del proyecto, va en "Trampas". Si es tu máquina, no va.
   - Si no lo puedes correr (necesita Docker, una base o una clave que no hay), va marcado `(sin probar)` **dentro del archivo** o se queda fuera. Lo mismo para la variante de otra terminal que no probaste.
   - Una trampa entra solo si la viste pasar o si el proyecto la documenta (cita dónde: CI, README, comentario). Una sospecha tuya no es una trampa.
3. **Revisa la terminal.** Si el equipo usa Windows y Mac/Linux, evita `VAR=x comando`; usa el script del proyecto o da las dos formas.
4. **Muestra el borrador completo** y la tabla `Comando | Lo corrí | Resultado`. Pregunta antes de escribir. Si el archivo ya existe, muestra el **diff**.
5. **Después de escribirlo**, pide al usuario que en su siguiente sesión con el agente vea si dejó de "descubrir" cómo correr el proyecto.

## Plantilla

```markdown
# <Proyecto>: instrucciones para agentes

<Una línea: qué es y en qué está hecho.>

## Comandos (probados el <fecha>)
- Instalar: `<comando>`  (o: "no hay dependencias, no instales nada")
- Probar todo: `<comando>` (~<N> s)
- Una prueba: `<comando con ruta>`
- Estilo y tipos: `<comando>`
- Levantar: `<comando>` → <url> (detén solo tu proceso)

## Reglas
- <regla que no se ve en el código, con su porqué en pocas palabras>

## Trampas conocidas
- <síntoma> → <causa y qué hacer>

## Terminado significa
- <pruebas en verde, estilo sin errores, prueba nueva para lo que cambió…>
```

## Comandos típicos por stack (verifica en el proyecto: aquí solo son el punto de partida)

| Stack | Instalar | Probar | Una prueba | Levantar |
|---|---|---|---|---|
| Node | `npm ci` / `pnpm i --frozen-lockfile` | `npm test` | `node --test ruta` · `npx vitest run ruta` · `npx jest ruta` | `npm run dev` |
| Rails | `bundle install` | `bin/rails test` o `bundle exec rspec` | `bin/rails test test/models/x_test.rb:12` | `bin/dev` o `bin/rails s` |
| Django | `pip install -r requirements.txt` o `uv sync` | `python manage.py test` o `pytest` | `pytest ruta::test_x` | `python manage.py runserver` |
| Laravel | `composer install` | `php artisan test` | `php artisan test --filter=NombreTest` | `php artisan serve` |
| Postgres/MySQL | — | — | — | `docker compose up -d db` |

Trampas frecuentes que vale la pena anotar:
- **Base de datos:** las pruebas usan otra base (`RAILS_ENV=test`, `DATABASE_URL` de pruebas, `.env.testing` en Laravel) o necesitan migrar primero (`bin/rails db:test:prepare`, `php artisan migrate --env=testing`).
- **Postgres/MySQL en Docker:** el puerto real (5433 en lugar de 5432) y el comando para levantarla.
- **Archivos generados** que no se editan a mano (`schema.rb`, migraciones ya aplicadas, `dist/`, clientes generados).
- **Pruebas lentas o con red:** cómo correr solo las rápidas.
