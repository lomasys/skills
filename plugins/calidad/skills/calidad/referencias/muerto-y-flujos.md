# Código muerto · flujos de punta a punta

## Modo `muerto`: lo que nadie usa

El objetivo es que el usuario borre **sin miedo**. Por eso cada candidato lleva evidencia, y lo que parece muerto pero se carga por nombre se reporta aparte.

### 1. Candidatos

- Archivos que nadie importa: lista los archivos de código y, para cada uno, busca su nombre (sin extensión) en todo el repo, incluida la configuración.
- Funciones, clases y métodos exportados que nadie llama fuera de su archivo.
- Rutas que ninguna pantalla, cliente ni documento usa.
- Plantillas, estilos, imágenes y traducciones sin referencias.
- Banderas de función (feature flags) que siempre valen lo mismo.
- Ramas imposibles (`if (false)`, condiciones que ya no pueden pasar).

Herramientas, **solo si el proyecto ya las tiene** (no instales sin preguntar):

| Stack | Herramienta |
|---|---|
| JavaScript/TypeScript | `knip`, `ts-prune`, `depcheck`, `tsc --noUnusedLocals`, ESLint `no-unused-vars` |
| Ruby/Rails | `debride`, `traceroute` (rutas sin acción y acciones sin ruta), `bin/rails routes` |
| Python/Django | `vulture`, `python manage.py show_urls` (si existe) |
| PHP/Laravel | `php artisan route:list`, PHPStan con reglas de código sin uso |

### 2. Descartar falsos muertos (obligatorio)

Para cada candidato, busca su nombre **como texto** en todo el repositorio (`git grep -n "<nombre>"`, sin `-w` y también sin extensión). Se usa aunque nadie lo importe si:

- se carga por nombre desde configuración (`require('./' + t.modulo)`, `constantize`, `import_module`, `'App\\Jobs\\X'`);
- es un punto de entrada: `main`, scripts de `package.json`, `bin/`, comandos de consola, migraciones, seeds, `Procfile`, cron, CI;
- lo llama el framework por convención: controladores y acciones, callbacks, señales, observers, `__init__.py`, comandos de Artisan, `rake` tasks;
- es API pública de una librería o lo usa otro repositorio (revisa `docs/`, OpenAPI, README, `exports` de `package.json`);
- lo usan solo las pruebas: dilo así ("solo lo usa `test/x`"), no es lo mismo que muerto.

### 3. Evidencia por candidato

| Nivel | Qué significa |
|---|---|
| ✅ **Comprobado** | Cero referencias como texto **y** en una copia lo quitaste y la suite completa pasa (y la app levanta, si aplica) |
| 🔎 **Sin referencias, sin correr** | Cero referencias como texto, pero no lo quitaste en una copia o hay poca cobertura |
| 🧪 **Solo lo usan pruebas** | El código de la app no lo usa; solo una prueba. Se borran juntos |
| ❔ **Confirmar con el usuario** | Sin referencias en el repo, pero podría usarlo algo de fuera (API pública, otro servicio, un reporte) |
| ⛔ **Parece muerto, NO lo es** | Se carga por nombre o por convención. Di quién lo carga, con archivo:línea |

Agrega el contexto que ayuda a decidir: último commit que lo tocó (`git log -1 --format="%ad %s" -- <archivo>`) y si el nombre dice "viejo", "legacy", "old", "v1".

### 4. Propuesta

Una lista ordenada de lo más seguro a lo menos seguro, con lo que hay que borrar en cada caso (archivo, la línea del `export`, la prueba que solo lo cubría a él).
**No borres nada.** Pregunta: *"¿Borro los ✅? Lo hago en un commit aparte para que sea fácil regresarlo."*

## Modo `flujos`: recorrer como usuario real

1. **Elige los flujos clave**, máximo 5: los que, si se rompen, cuestan clientes o dinero (registrarse, entrar, comprar o pagar, el trabajo principal del producto, el reporte que se manda a otra área).
   Si no es obvio, pregunta cuáles son.
2. **Usa lo que el proyecto ya tiene**, en este orden: pruebas de punta a punta existentes (Playwright, Cypress, Capybara, Selenium, Dusk);
   un navegador que tu entorno ya pueda controlar; peticiones HTTP a la app local (`curl`, `fetch`) siguiendo los mismos pasos que haría la pantalla; el comando de consola si es una CLI.
   No instales un navegador ni un framework sin preguntar.
3. **Levanta la app local** con su comando, en un puerto libre, y guarda el PID. Usa datos de prueba (seeds, fixtures); si creas datos, bórralos al terminar.
4. **Recorre cada flujo paso a paso** como un usuario: entradas reales (acentos, montos con decimales, carrito con varios artículos, vacío).
   En cada paso revisa el **valor**, no solo que respondió 200: el total cobrado, el correo que se mandaría, el registro que quedó.
5. **Detén tu PID** y reporta por flujo: ✅ funciona · ❌ se rompe en el paso N (lo que mandaste → lo que respondió) · ❔ no se pudo probar (por qué).
6. Para cada flujo sin prueba automática, propone una (del framework que ya hay) que repita el recorrido.
