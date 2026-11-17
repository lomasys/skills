# Impacto: qué rompo si cambio esto

Objetivo: una lista **completa** de todo lo que depende de la cosa que se va a cambiar, con `archivo:línea`,
cómo la usa, qué le pasaría con el cambio y qué prueba la cubre. Un grep del nombre encuentra la mitad.

## Antes de buscar: define el cambio

Escribe en una línea qué cambia exactamente. El riesgo depende de eso:

| Tipo de cambio | Qué se rompe |
|---|---|
| Renombrar o mover | Todo lo que la nombra, incluido lo que la nombra **como texto** |
| Cambiar parámetros | Cada llamada. Se cae al momento (fácil de ver) |
| Cambiar lo que regresa (tipo, forma, unidades, redondeo) | Cada lector del resultado. Suele fallar **en silencio**: `[object Object]`, `NaN`, `None`, sumas como texto |
| Cambiar el comportamiento (otra regla, otro valor) | Cada lugar que muestra, guarda o cobra el resultado, más los datos ya guardados con la regla vieja |
| Borrar | Todo lo anterior |

## Las 9 búsquedas (no te saltes ninguna)

Usa `git grep -n` (respeta `.gitignore`) o `rg -n`. Busca también en archivos que no son código: `.json`, `.yml`, `.env.example`, plantillas, `.sql`, `docs/`.

1. **Llamadas directas.** El nombre exacto, con palabra completa: `git grep -nw calcularTotal`.
2. **Importaciones y alias.** Quién la importa y con qué nombre. Sigue cada **reexportación** (`index.js`, `__init__.py`, `module.exports = { total: precios.calcularTotal }`)
   y busca **el alias** en todo el repo. Repite hasta que no salgan nombres nuevos.
3. **Llamadas por texto (dinámicas).** Busca el nombre entre comillas y los mecanismos de llamada por nombre del stack:

   | Stack | Patrones |
   |---|---|
   | JavaScript/TypeScript | `obj[variable](`, `require('./' + x)`, `import(\`...${x}\`)`, mapas de nombre → función, inyección de dependencias por cadena |
   | Ruby/Rails | `send(`, `public_send(`, `constantize`, `method(:x)`, callbacks `before_action :x`, `delegate`, `to_proc` |
   | Python/Django | `getattr(`, `importlib.import_module`, cadenas en `settings.py` (`'app.modulo.funcion'`), señales, `urls.py` con cadenas |
   | PHP/Laravel | `call_user_func`, `$obj->$metodo()`, `'Controlador@accion'`, `[Clase::class, 'metodo']`, nombres en `config/*.php` |

4. **Configuración.** El nombre (o el nombre del archivo) dentro de `config/`, `.json`, `.yml`, `.toml`, variables de entorno de ejemplo,
   `cron`, `Procfile`, `docker-compose.yml`, `package.json` (scripts), CI.
5. **Rutas y endpoints.** Qué rutas terminan llamándola, aunque sea a través de otras funciones. Sube por la cadena de llamadas hasta llegar
   a una ruta, un comando o un trabajo. Cada ruta pública es un contrato con alguien de fuera.
6. **Plantillas y vistas.** Ayudantes llamados desde HTML, ERB, Blade, Jinja, Handlebars, correos, PDFs y recibos (`{{ nombre ... }}`, `<%= nombre %>`, `@nombre`).
7. **Trabajos en segundo plano.** Colas y tareas programadas: Sidekiq/ActiveJob, Celery/RQ, colas de Laravel, cron, `node-cron`, BullMQ, archivos de trabajos.
   Suelen cargarse **por nombre desde configuración**, así que salen en la búsqueda 3 o 4, no en la 1.
8. **Fuera del repositorio.** Busca quién consume desde fuera: `docs/`, OpenAPI/Swagger, README, colecciones de Postman, clientes generados, webhooks,
   reportes que lee otra área, apps móviles, otros servicios. No los puedes ver: márcalos **❔ Sin comprobar** y di qué hay que preguntar y a quién.
9. **Pruebas.** Qué pruebas la ejercitan (directo o a través de otro código) y **qué caso** cubren. Para cada dependiente de la tabla, pon la prueba que fallaría
   si se rompe, o "ninguna". Si hay cobertura en el proyecto (`coverage/`, `.nyc_output`, `coverage.xml`), úsala; si no, no la instales sin preguntar.

## Cuando la cosa no es una función

| Cosa | Qué buscar además |
|---|---|
| **Columna de base de datos** | Migraciones; modelos y ORM (`Pedido.where(total:)`, `.filter(total=)`, `->where('total')`); SQL a mano (`.sql`, cadenas con `SELECT`); vistas, triggers, índices; serializadores y respuestas de API; reportes, exportaciones CSV, tableros de BI; seeds y fixtures; nombres en el front (`pedido.total`). Pregunta si hay réplicas o procesos de datos (ETL) que la lean |
| **Endpoint** | El front (`fetch('/api/...')`, `axios`, clientes generados), apps móviles, webhooks que otros llaman, documentación pública, pruebas de contrato, monitoreo que lo vigila |
| **Componente de interfaz** | Dónde se usa (`<Boton`, `import Boton`), sus props, estilos que dependen de sus clases, Storybook, pruebas de pantalla, textos traducidos que usa |
| **Archivo** | Quién lo importa por ruta, quién lo carga por nombre (`require('./' + x)`), globs de compilación (`src/**/*.js`), `include`/`exclude` de configuración |

## Demostrar en vez de suponer

Para las dependencias indirectas, lee la línea que la usa. Si puedes, **demuéstralo** sin tocar el repo:

- Simulación en memoria: un `node -e` / `python -c` / `rails runner` que reemplaza la función por la versión nueva y llama a cada dependiente.
- O una copia del proyecto en tu carpeta de trabajo, con el cambio aplicado, y la suite corriendo ahí.

Anota el resultado: "se cae con TypeError", "regresa `[object Object]` sin error", "la prueba X falla", "nada se da cuenta".
Lo que **nadie detecta** (ninguna prueba falla) es lo más riesgoso: dilo.

## Cómo calificar el riesgo

- 🔴 **Alto** si pasa cualquiera de estas: algo fuera del repositorio depende de él; toca dinero, facturas o datos de clientes;
  algún dependiente fallaría **en silencio**; hay dependientes sin ninguna prueba; hay datos guardados con la regla vieja.
- 🟠 **Medio**: todos los dependientes están en el repositorio y fallarían con un error visible, pero algunos no tienen prueba.
- 🟡 **Bajo**: pocos dependientes, todos en el repositorio, todos cubiertos por pruebas que fallarían.

## Cómo cambiarlo con menos riesgo (para la propuesta)

- **Envoltura compatible:** crea la versión nueva con otro nombre y deja la vieja llamándola. Migra un dependiente a la vez.
- **API pública:** no cambies la forma de la respuesta; agrega un campo o una versión (`/api/v2/...`) y avisa a los consumidores.
- **Columna:** agrega la nueva, escribe en ambas, migra lectores, y solo al final quita la vieja (tres despliegues, no uno).
- **Primero las pruebas:** agrega las que faltan para los dependientes "sin prueba" **antes** del cambio, para que te avisen.
