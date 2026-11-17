# Accesibilidad: qué revisar y cómo comprobarlo

Cuatro preguntas por pantalla: **¿se lee?** (contraste), **¿se usa sin ratón?** (teclado),
**¿un lector de pantalla sabe qué es cada cosa?** (nombres y etiquetas) y **¿se puede tocar con el dedo?** (tamaños).

## Criterios WCAG 2.2 que puedes citar

Cita solo estos números. Si un problema no cabe en ninguno, descríbelo sin número.

| Criterio | Nivel | Qué pide |
|---|---|---|
| 1.1.1 Contenido no textual | A | Imágenes con texto alternativo (`alt`); las decorativas con `alt=""` |
| 1.3.1 Información y relaciones | A | La estructura se entiende en el código: etiquetas ligadas, encabezados, tablas con `<th>` |
| 1.4.3 Contraste (mínimo) | AA | Texto 4.5:1; texto grande 3:1 |
| 1.4.6 Contraste (mejorado) | AAA | Texto 7:1; texto grande 4.5:1 |
| 1.4.11 Contraste de lo que no es texto | AA | Íconos, bordes de campos y estados de foco 3:1 contra lo que tienen al lado |
| 2.1.1 Teclado | A | Todo lo que se hace con ratón se hace con teclado |
| 2.1.2 Sin trampas de teclado | A | Si el foco entra a algo, puede salir con el teclado |
| 2.4.3 Orden del foco | A | El foco avanza en un orden que tiene sentido |
| 2.4.7 Foco visible | AA | Siempre se ve dónde está el foco |
| 2.4.11 Foco no tapado (mínimo) | AA | Una barra fija o un aviso no tapan por completo el elemento con foco |
| 2.5.8 Tamaño del objetivo (mínimo) | AA | Lo que se toca mide al menos 24×24 px (o tiene espacio libre alrededor) |
| 3.1.1 Idioma de la página | A | `<html lang="es">` |
| 3.3.1 Identificación de errores | A | El error de un campo se dice en texto, no solo en rojo |
| 3.3.2 Etiquetas o instrucciones | A | Cada campo tiene etiqueta |
| 4.1.2 Nombre, función, valor | A | Cada control tiene nombre y rol que el lector de pantalla puede anunciar |
| 4.1.3 Mensajes de estado | AA | "Guardado", "3 resultados" o "Error" se anuncian sin mover el foco (`role="status"`, `aria-live`) |

**Texto grande** = 24 px o más, o 18.66 px (14 pt) o más en negrita. La meta de 44×44 px en celular es una recomendación (2.5.5, AAA), no el mínimo.

## 1. Contraste

**Con la herramienta:**
```bash
node <skill>/scripts/pantallas.mjs css src/           # todos los pares color/fondo que encuentra en el CSS
node <skill>/scripts/pantallas.mjs contraste "#4fc3f7" "#ffffff" --grande
```
- Calcula la razón con la fórmula de WCAG (luminancia relativa sRGB) y **nunca redondea hacia arriba**.
- Si no cumple, sugiere el color más parecido (mismo tono) que sí cumple, cambiando el texto o el fondo.
- Colores con transparencia: los mezcla sobre su fondo. Si el fondo también es transparente, lo mezcla sobre blanco y te avisa.
- "fondo supuesto": la regla no declara fondo y se usó el de `body`. Confírmalo con la captura o el inspector.
- **Una clase sobre varios fondos** (un `.icono` en la barra gris y en la lista blanca): mide cada fondo con `contraste` y propón un color que cumpla contra **el peor**. Ponlo en la misma fila del reporte.

**Lo que la herramienta no ve, y tú debes buscar:**
- **Tailwind y librerías de clases** (`text-gray-400`, `bg-sky-300`): saca el valor real de `tailwind.config.*` o de la paleta de la librería y mídelo con `contraste`.
- **Temas y modo oscuro:** mide los dos. Un gris que pasa en claro puede fallar en oscuro.
- **Texto sobre imagen o degradado:** mide contra el color más claro de la zona donde cae el texto.
- **Estados:** `:hover`, `:disabled`, el placeholder (`::placeholder`) y el texto de error. El texto deshabilitado está exento, pero el placeholder no.
- **Flutter:** colores en `ThemeData`/`ColorScheme` (`Color(0xFF4FC3F7)` → `#4fc3f7`).

## 2. Teclado

**Busca en el código:**
- `outline: none` u `outline: 0` sin un estilo `:focus-visible` que lo reemplace (la herramienta lo marca).
- Elementos con clic que no son botones ni enlaces: `<div onClick>`, `<span @click>`, `<li (click)>`, `GestureDetector` sin `Semantics`. Arreglo: `<button type="button">`.
- `tabindex` mayor que 0 (rompe el orden) y `tabindex="-1"` en algo que sí se debe alcanzar.
- **Modales, menús y cajones:** al abrir, ¿mueven el foco adentro? ¿se cierran con Esc? ¿el foco regresa al botón que los abrió?
  ¿el fondo queda inerte (`inert`, `aria-modal="true"`)? Un modal sin forma de cerrarse con teclado es una trampa (2.1.2).
  En React, revisa si usan una librería que ya lo resuelve (Radix, Headless UI, MUI `Dialog`); en ese caso suele estar bien.

**Compruébalo en el navegador** (ver [Abrir la app](#abrir-la-app)): recorre con Tab y anota a dónde va el foco, si se ve y si algo se salta.

## 3. Nombres para lectores de pantalla

| Caso | Cómo se ve en el código | Cambio |
|---|---|---|
| Botón o enlace con solo ícono | `<button><svg …/></button>`, `<IconButton>`, `<mat-icon>` dentro de `<button>` | `aria-label="Borrar cliente"` (y `aria-hidden="true"` en el svg). Flutter: `tooltip:` |
| Imagen sin alt | `<img src>`, `<Image>` de Next sin `alt`, `Image.asset` sin `semanticLabel` | Texto que diga lo que aporta; decorativa: `alt=""` |
| Campo sin etiqueta | `<input placeholder="Correo">` sin `<label for>` | `<label for="correo">Correo</label>`, o `aria-label` si no hay espacio visible |
| `<label>` suelto | `<label>Nombre</label><input id="nombre">` | `<label for="nombre">` (en React `htmlFor`) |
| Error de campo sin anunciar | Texto rojo junto al campo | `aria-describedby` hacia el mensaje y `aria-invalid="true"` |
| Página sin idioma | `<html>` | `<html lang="es">` |

Si el texto del `aria-label` es visible para el usuario, también va al sistema de traducciones.

## 4. Tamaños táctiles

- Busca en el CSS botones e íconos con `width`/`height` menores a 24 px y sin `padding` (la herramienta los marca).
- En la captura de celular (390×844), revisa íconos de cerrar, borrar, editar y enlaces muy pegados.
- Arreglo típico: deja el ícono igual y agranda la zona de toque (`min-width: 24px; min-height: 24px;` o `padding`); 44×44 en pantallas para celular.

## Abrir la app

Primero el código; el navegador **confirma**. Todo lo que generes (capturas, DOM, perfiles) va a una carpeta temporal fuera del proyecto.

**1. Levantar y guardar el PID (solo del proceso que escucha en tu puerto):**

```powershell
# Windows (PowerShell)
$puerto = 4510   # uno libre: comprueba antes que Get-NetTCPConnection -LocalPort $puerto no devuelve nada
$env:PORT = "$puerto"; Start-Process npm -ArgumentList "run","dev" -WindowStyle Hidden
$miPid = $null; for ($i = 0; $i -lt 60 -and -not $miPid; $i++) { Start-Sleep -Milliseconds 500; $miPid = (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue).OwningProcess }
# … al terminar:
Stop-Process -Id $miPid
```
```bash
# macOS / Linux
PORT=4510 npm run dev > /tmp/pantallas-app.log 2>&1 &
for i in $(seq 60); do PID=$(lsof -ti tcp:4510 -sTCP:LISTEN) && [ -n "$PID" ] && break; sleep 0.5; done
kill "$PID"
```
Espera a que el puerto escuche: lanzar el navegador antes da una captura de "no se puede conectar".
Si el comando del proyecto deja un proceso padre (npm, el observador de Vite), detén también ese padre por su PID, nunca por nombre.

**2. Capturas con Chrome o Edge sin ventana (sin instalar nada):**

```powershell
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"   # o "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$tmp = Join-Path $env:TEMP "pantallas-revision"; New-Item -ItemType Directory -Force $tmp | Out-Null
$base = "--headless=new","--disable-gpu","--no-first-run","--user-data-dir=`"$tmp\perfil`"","--virtual-time-budget=5000"
Start-Process $chrome -Wait -ArgumentList ($base + "--window-size=1280,800","--screenshot=`"$tmp\clientes.png`"","http://localhost:4510/clientes")
Start-Process $chrome -Wait -ArgumentList ($base + "--window-size=390,844","--screenshot=`"$tmp\clientes-cel.png`"","http://localhost:4510/clientes")
Start-Process $chrome -Wait -RedirectStandardOutput "$tmp\clientes.dom.html" -ArgumentList ($base + "--dump-dom","http://localhost:4510/clientes")
```
En macOS: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`; en Linux: `google-chrome` o `chromium`. Usa `-Wait` (o espera al proceso): sin eso el archivo no existe todavía.

- **Cuesta tiempo:** cada llamada tarda de 5 a 30 segundos. Elige pocas: escritorio de cada pantalla y un `--dump-dom` por estado (vacío, error, sin permiso).
  Con más de 6 llamadas, córrelas en segundo plano y espera a que existan los archivos.
- **Celular:** Chrome sin ventana no baja de cierto ancho de ventana y recorta la página. Una captura de 390 px hecha así **no sirve** para decir que algo se corta o se encima.
  Úsala solo para ver colores y textos; para el diseño en celular usa Playwright (`newPage({ viewport: { width: 390, height: 844 } })`) o márcalo "Sin comprobar".

- `--dump-dom` guarda la página **ya pintada** por JavaScript. Córrele `pantallas.mjs accesibilidad <archivo.dom.html>`: encuentra lo que solo existe después de cargar (filas de una lista, botones generados).
- Mira las capturas con tu herramienta de imágenes: llaves crudas, textos cortados, botones encimados, colores.
- Si la pantalla pide sesión, usa la cuenta de prueba del proyecto. Chrome sin ventana no comparte la sesión de tu navegador.

**3. Recorrido con teclado (solo si el proyecto ya tiene Playwright):**

Guarda esto en tu carpeta temporal (no en el proyecto) y córrelo **desde la carpeta del proyecto**, para que use su Playwright:

```js
// recorrido-teclado.cjs  →  node <tmp>/recorrido-teclado.cjs http://localhost:4510/clientes
const { createRequire } = require('node:module');
const { chromium } = createRequire(process.cwd() + '/')('playwright'); // o '@playwright/test'
(async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  await pagina.goto(process.argv[2], { waitUntil: 'networkidle' });
  for (let i = 1; i <= 40; i++) {
    await pagina.keyboard.press('Tab');
    const info = await pagina.evaluate(() => {
      const e = document.activeElement, s = getComputedStyle(e), r = e.getBoundingClientRect();
      const nombre = e.getAttribute('aria-label') || e.innerText?.trim().slice(0, 40) || e.getAttribute('alt') || e.getAttribute('placeholder') || '';
      const visible = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none';
      return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''} "${nombre}" ${Math.round(r.width)}×${Math.round(r.height)} foco-visible:${visible}`;
    });
    console.log(i, info);
  }
  await navegador.close();
})();
```
Si el foco se repite en el mismo elemento o nunca sale de un modal, es una trampa. Si un control que se usa con ratón nunca aparece, no se alcanza con teclado.
`foco-visible:false` es un candidato: confírmalo con una captura (`pagina.screenshot`) porque algunos sitios marcan el foco con borde o fondo.

Sin Playwright, el teclado se revisa leyendo el código y queda en "Sin comprobar en navegador".
