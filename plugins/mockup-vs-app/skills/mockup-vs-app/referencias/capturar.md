# Cómo encontrar la pantalla, capturarla y llegar a cada estado

## 1. Qué mockup va con qué ruta

| Stack | Dónde están las rutas | Ejemplo |
|---|---|---|
| Rails | `config/routes.rb`, `bin/rails routes` | `get "registro" => "registros#new"` → `/registro` |
| Node / Express | `app.get(...)`, `router.get(...)` en `routes/` o `server.js` | `app.get('/registro', ...)` |
| Next.js | `app/<ruta>/page.tsx` o `pages/<ruta>.tsx` | `app/registro/page.tsx` → `/registro` |
| React Router / Vue Router | archivo con `createBrowserRouter`, `<Route path>` o `routes: [...]` | `{ path: '/registro', component: Registro }` |
| Django | `urls.py` (`path("registro/", ...)`) | `/registro/` |
| Laravel | `routes/web.php` | `Route::get('/registro', ...)` |

Puertos de desarrollo comunes: Rails 3000, Next/Express 3000, Vite 5173, Angular 4200, Django 8000, Laravel 8000.
Lee el `README`, `package.json`, `Procfile` o `docker-compose.yml` antes de adivinar.

## 2. Qué trae el mockup

| Tipo | Cómo leerlo |
|---|---|
| PNG / JPG | El ancho de la imagen es el ancho de la pantalla. Si dice `@2x` o mide 780 / 1536 / 2880, es escala 2: divide entre 2 |
| HTML estático | Se captura y se mide igual que la app, con `--lado mockup`. Es el caso más exacto |
| Exportación de Figma, Sketch, XD, Penpot | Pide (o busca) los marcos exportados en PNG a 1x y, si existe, la hoja de estilos o los tokens (`tokens.json`, `variables.css`) |
| PDF | Pide los marcos en PNG; un PDF no trae medidas confiables |

Si el mockup trae varios marcos (celular, escritorio, oscuro, error), haz una lista y compara cada uno con su tamaño y tema.
No uses la API de Figma ni subas archivos a ningún servicio sin permiso.

## 3. Capturar

### Con la herramienta de la skill (lo normal)

```bash
node <skill>/scripts/capturas.mjs capturar --url http://localhost:3000/registro --nombre registro --lado real --temas claro,oscuro
node <skill>/scripts/capturas.mjs capturar --url file:///C:/proyecto/design/registro.html --nombre registro --lado mockup --temas claro,oscuro
```

Deja en `mockup-vs-app/capturas/` un `.png` (página completa) y un `.json` (medidas y estilos de cada elemento) por tamaño y tema:
`registro__real__celular-390__oscuro.png`. Busca solo Chrome, Edge o Chromium instalados; si no los encuentra, pide la ruta (`--navegador`).

| Situación | Opción |
|---|---|
| El mockup mide otros anchos | `--tamanos 375,1280` |
| La app carga datos después | `--listo ".lista-de-tableros"` o `--esperar 1500` |
| Modo oscuro por clase (Tailwind `dark:`) | `--oscuro-clase dark` |
| Modo oscuro por atributo | `--oscuro-atributo data-theme=dark` |
| La pantalla pide sesión | Inicia sesión con un usuario de prueba, copia la cookie de sesión y pásala: `--cookie "_session=abcd..."` |

### Si el proyecto ya tiene Playwright

Puedes usarlo para llegar a estados difíciles (llenar un formulario, provocar un error). Toma la captura al mismo ancho:

```js
await page.setViewportSize({ width: 390, height: 844 });
await page.emulateMedia({ colorScheme: 'dark' });
await page.screenshot({ path: 'mockup-vs-app/capturas/registro__real__celular-390__oscuro__error.png', fullPage: true });
```

### Sin Node (último recurso)

```bash
chrome --headless=new --hide-scrollbars --window-size=390,844 --screenshot=captura.png http://localhost:3000/registro
```

Solo da la imagen (sin medidas ni modo oscuro). En Windows la ruta suele ser `C:\Program Files\Google\Chrome\Application\chrome.exe`
o `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.

## 4. Llegar a cada estado

| Estado | Cómo llegar sin romper nada |
|---|---|
| Vacío | Un usuario de prueba sin registros, o un filtro que no regresa nada |
| Error de formulario | Envía el formulario vacío o con un correo inválido (con Playwright, o pide al usuario que lo deje así) |
| Error del servidor | Solo si la app tiene un modo de prueba o un fixture para eso. **No apagues** la base ni servicios que no levantaste |
| Cargando | Muy breve para capturarlo. Si el componente tiene historia en Storybook, compárala ahí; si no, va a "Sin comparar" |

Nombra cada captura con el estado al final: `registro__real__celular-390__claro__error.png`.

## 5. Mockup en imagen: cómo medir

- **Colores:** `capturas.mjs colores --imagen mockup.png --puntos "195,420;30,30" --escala 2` da el color exacto en esos puntos
  (los puntos van en px de pantalla; `--escala` los convierte a px de la imagen).
- **Tamaños y espacios:** mira la imagen y estima con los bordes de cada elemento. Márcalos "(aprox.)" y redondea a múltiplos de 4,
  que es como suelen diseñarse.
- **Fuente:** si no se puede saber por la imagen, pregunta o busca la guía de estilo; no la adivines.
