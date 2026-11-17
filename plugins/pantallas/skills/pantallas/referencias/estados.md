# Estados olvidados

Toda pantalla o componente que **trae datos** tiene cinco momentos. El feliz casi siempre está; los otros cuatro son los que olvidamos:

| Estado | Qué debe ver la persona | Si falta |
|---|---|---|
| **Cargando** | Un indicador o esqueleto, en su idioma. Si tarda, no parece congelada | Pantalla en blanco o datos viejos; dan clic dos veces |
| **Vacío** | Un mensaje que explica que no hay nada y, si aplica, cómo crear el primero | Una lista en blanco que parece rota |
| **Error** | Qué pasó en palabras simples y qué hacer (reintentar, contactar). Nunca el error técnico | Se queda "cargando" para siempre o se rompe la pantalla |
| **Sin permiso** | Que no tiene acceso y a quién pedírselo. Distinto de "error" | Ve un error genérico, o peor, una pantalla vacía que parece que no hay datos |
| Con datos | La lista, la tabla, el detalle | — |

## Cómo encontrarlos en el código

1. **Ubica cada fuente de datos** de la pantalla: `fetch`, `axios`, `useQuery`/`useSWR`, `$fetch`/`useFetch` (Nuxt), `load` (SvelteKit),
   `HttpClient` (Angular), consultas en el controlador (Rails, Django, Laravel), `FutureBuilder`/`StreamBuilder` (Flutter).
2. **Para cada una, responde las cuatro preguntas** con el `archivo:línea`:
   - ¿Qué se muestra antes de que llegue la respuesta?
   - ¿Qué se muestra si llega una lista vacía? (`length === 0`, `@clientes.empty?`, `{% empty %}`, `@forelse … @empty`, `v-if="!items.length"`)
   - ¿Qué pasa si falla? ¿Se revisa `res.ok` o el código de estado? ¿Hay `catch`, `onError`, `error` del hook, `ErrorBoundary`, `snapshot.hasError`?
   - ¿Qué pasa con 401/403? ¿Se distingue de un error general? En plantillas de servidor: ¿la vista revisa permisos (`can?`, `@can`, `{% if perms.%}`) o el controlador redirige con un mensaje?
3. **Patrones que fallan en silencio:**
   - `await res.json()` sin revisar `res.ok`: un 500 o 403 devuelve `{ error }` y el `.map` truena.
   - `fetch` sin `catch` en un `useEffect` o en un módulo: la promesa falla y nadie se entera.
   - `isLoading` que nunca vuelve a `false` cuando hay error.
   - Un solo `if (!data) return <Spinner/>`: si falla, el spinner gira para siempre.
   - Mostrar `error.message` tal cual (es un texto técnico; va también en el tema Textos).
   - Botón de enviar sin estado "enviando": doble clic, doble pedido.

## Cómo comprobarlos en el navegador

Provoca cada estado. Usa lo que tenga el proyecto, en este orden:

1. **Interruptores que ya existen:** datos de prueba, `?modo=`, variables de entorno, mocks (MSW, Mirage), historias de Storybook con cada estado.
2. **Datos de prueba:** una cuenta o base local sin registros para "vacío" y un usuario sin el rol para "sin permiso". Si cambias datos, regrésalos como estaban.
3. **Con Playwright (si está):** `pagina.route('**/api/clientes*', r => r.fulfill({ status: 500, body: '{}' }))` para error, `status: 403` para sin permiso,
   y un retraso (`await new Promise(s => setTimeout(s, 3000))` antes de `r.continue()`) para ver "cargando".
4. **Sin nada de lo anterior:** apaga solo el servicio de datos que tú levantaste o deja el estado como "Sin comprobar" y explica cómo se vería según el código.

Toma una captura de cada estado. Una captura de "Loading..." después de 5 segundos con la API en error es la mejor prueba.

## Cómo reportarlo

La tabla del reporte, una fila por pantalla o componente:

| Pantalla | Vacío | Cargando | Error | Sin permiso |
|---|---|---|---|---|
| Clientes (`public/app.js`) | ❌ `app.js:15` lista en blanco | ⚠️ `app.js:11` "Loading..." fijo en inglés | ❌ `app.js:13` se queda cargando | ❌ `app.js:13` igual que error |
| Pedidos (`public/pedidos.js`) | ✅ `pedidos.js:14` | ✅ `pedidos.js:10` | ❌ `pedidos.js:12` | ❌ |

Y un hallazgo con el cambio exacto por cada ❌ importante. Propón **un** ayudante o componente para todos los estados
cuando varias pantallas repiten el mismo error (por ejemplo, un `<EstadoDeDatos cargando vacio error sinPermiso>` o un `cargarConEstados(url, elementos)`),
pero sin reescribir la pantalla: el cambio mínimo que lo resuelve, en el estilo del proyecto.

Ejemplo de cambio mínimo (JavaScript sin framework):

```diff
# public/app.js:12
- const res = await fetch('/api/clientes' + location.search);
- const clientes = await res.json();
+ let res;
+ try { res = await fetch('/api/clientes' + location.search); }
+ catch { lista.textContent = t('estados.sin_conexion'); return; }
+ if (res.status === 401 || res.status === 403) { lista.textContent = t('estados.sin_permiso'); return; }
+ if (!res.ok) { lista.textContent = t('estados.error'); return; }
+ const clientes = await res.json();
+ if (clientes.length === 0) { lista.textContent = t('clientes.vacio'); return; }
```
Con las llaves nuevas en cada idioma, y `role="status"` en el contenedor para que el lector de pantalla anuncie el cambio.
