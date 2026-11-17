# Frontend pesado

Primero mide qué descarga la página. Después busca con las herramientas que **ya tiene** el proyecto. No instales nada sin preguntar.

## 1. Medir

```bash
node <carpeta-de-esta-skill>/scripts/medir.mjs peso http://localhost:PUERTO/ --etiqueta antes-inicio
```

Muestra cada script, hoja de estilos e imagen que trae el HTML, su peso **por la red** (comprimido, si el servidor comprime) y sin comprimir, y avisos:
scripts que bloquean, imágenes de más de 200 KB, `<img>` sin tamaño, archivos de texto sin comprimir.

Límites de la herramienta: solo ve lo que trae el HTML. En una app de una sola página (React, Vue, Angular) el HTML casi no trae nada;
en ese caso mide **el build** (paso 2) y las rutas de API que llama la primera pantalla con `medir`.

## 2. Tamaño del JavaScript, con lo que ya existe

| Herramienta del proyecto | Cómo ver el tamaño por archivo y por librería |
|---|---|
| Vite | `vite build` imprime cada archivo con su tamaño y gzip. Si ya está `rollup-plugin-visualizer`, úsalo |
| Webpack | `webpack --json > stats.json` y lee los `assets`; `webpack-bundle-analyzer` solo si ya está |
| Next.js | `next build` imprime "First Load JS" por página; `@next/bundle-analyzer` si ya está |
| Rails (importmap, jsbundling, Propshaft) | Tamaño de los archivos en `public/assets` después de `assets:precompile` |
| Laravel (Vite o Mix) | `npm run build` y el tamaño en `public/build` |
| Django | Tamaño en la carpeta de `collectstatic` |
| Sin build | `peso` sobre la página |

Mide **antes** con el build actual y **después** con el build de la copia. Compara el JavaScript de la primera pantalla, no el total.

## 3. Causas comunes y arreglos

| Lo que ves | Arreglo |
|---|---|
| Una librería grande que solo usa otra pantalla (gráficas, editor, mapas, fechas) | Carga por partes: `import()` dinámico, `React.lazy`, rutas separadas, o un `<script>` solo en esa página |
| Script en `<head>` sin `defer` | `defer` (o `type="module"`), o moverlo al final |
| Toda una librería por una función (`lodash`, `moment`) | Importar solo esa función, o la función nativa |
| Imagen de MB que se ve a 400 px | Redimensionar al tamaño en que se muestra, WebP o AVIF, `srcset` para varios tamaños |
| `<img>` sin `width` y `height` | Ponerlos: la página deja de brincar |
| Imágenes abajo de la pantalla que bajan al inicio | `loading="lazy"` (nunca en la imagen principal de arriba) |
| HTML, JS, CSS o JSON sin comprimir | gzip o brotli en el servidor o en el proxy (`compression` en Express, `gzip on` en nginx) |
| Archivos con huella en el nombre sin caché | `Cache-Control: public, max-age=31536000, immutable` |
| La pantalla pide toda una lista para mostrar 20 | Es un problema de [listas](causas.md#3-listas-sin-paginar), no de frontend |

Si optimizar imágenes requiere una herramienta que no está (sharp, squoosh, imagemagick), **pregunta** antes de instalarla.
Si no hay forma de convertirla, deja el arreglo en "Sin medir" con un estimado marcado como tal.

## 4. Lo que la red le hace al cliente

En local no hay red: una imagen de 4 MB baja en milisegundos. Para hablar del cliente, **estima** y dilo:
segundos ≈ bytes × 8 / velocidad. Por ejemplo, 4.6 MB con 10 Mbps (un celular promedio) ≈ 3.7 s.
Si el proyecto ya tiene Lighthouse o Playwright, úsalos para medir con red lenta simulada; si no, pregunta antes de instalarlos.
