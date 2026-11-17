---
name: mockup-vs-app
description: Use when the user has a mockup or design (PNG/JPG image, static HTML, Figma/Sketch/XD/Penpot export) and wants to check that the real screen matches it, asks for a visual review or pixel-perfect check, says the page "doesn't look like the design", or wants differences in colors, fonts, spacing, texts or missing elements in mobile, tablet, desktop or dark mode (comparar mockup, diseño contra pantalla, quedó igual al diseño, revisar maquetación, diferencias con Figma, pixel perfect, QA visual).
---

# Mockup vs app

Compara el mockup con la pantalla real **corriendo en la máquina del usuario**, en celular, tablet y escritorio, en modo claro y oscuro.
Entrega cada diferencia con su medida exacta, dónde está en el código y el arreglo concreto, de la que más se nota a la que menos.

**Principio:** una diferencia sin medida es una opinión. Mide lo que puedas ("el botón mide 40 px, el mockup 48 px") y marca lo que solo viste a ojo.

## Modos

Lee el argumento que escribió el usuario (`/mockup-vs-app:mockup-vs-app <modo>`):

| Argumento | Qué hace |
|---|---|
| *(nada)* | Una pantalla: la que nombró el usuario o la que tenga el mockup más reciente. Tamaños y temas que traiga el mockup |
| `todas` | Todas las pantallas que tengan mockup. Una sección del reporte por pantalla, con un resumen al inicio |
| `celular` | Solo el tamaño celular (390 px), en los temas del mockup |
| `oscuro` | Solo modo oscuro, en todos los tamaños |

## Reglas (no negociables)

1. **Solo la app local.** Abre `localhost`, `127.0.0.1` o archivos `file://`. Nunca staging ni producción sin permiso escrito del usuario;
   la herramienta se niega por defecto.
2. **No cambias estilos ni código sin permiso.** Propones el arreglo; lo aplicas solo cuando el usuario lo pide, uno por uno.
   Lo único que creas sin preguntar es la carpeta `mockup-vs-app/` (capturas y, si hace falta, el log de la app que levantaste).
3. **Solo apagas lo que tú prendiste.** Si levantas la app, guarda su PID y detén ese PID al final. Nunca `taskkill /IM`, `killall` ni `pkill` por nombre.
   La herramienta abre su propio navegador con un perfil temporal y lo cierra sola.
4. **Las capturas no salen de la máquina.** No las subas a ningún servicio (comparadores en línea, almacenamiento, chats, issues).
5. **No instalas nada sin preguntar.** Si el proyecto ya tiene Playwright, puedes usarlo; si no, usa Chrome o Edge, que casi siempre están.
6. **Sin datos reales de personas.** Usa datos de prueba. Si una captura muestra correos, nombres o claves reales, dilo y no la pegues en el reporte.
7. **Usa la herramienta de la skill** (`scripts/capturas.mjs`). No escribas otro script de capturas: así cualquier corrida se puede repetir y comparar.

| Pensamiento | Realidad |
|---|---|
| "Lo arreglo de una vez, es solo CSS" | El usuario pidió una revisión. Propón el arreglo y espera. |
| "Escribo un script rápido con Puppeteer" | Hay que instalarlo, y cada corrida queda distinta. Usa la herramienta. |
| "Tablet es 820 px, da igual" | El mockup dice 768 px. Otro ancho produce diferencias falsas. |
| "El 4% de los píxeles es distinto" | Eso no dice qué arreglar. Da la medida, el selector y el cambio. |
| "Son 5 colores distintos" | Casi siempre es una sola variable (`--primario`). Repórtala una vez. |

## Proceso

1. **Encuentra el mockup y su pantalla.** Busca en `design/`, `diseno/`, `mockups/`, `docs/`, `assets/`, `public/` y en lo que diga el usuario:
   `*.png`, `*.jpg`, `*.html`, exportaciones de Figma o Sketch. Anota por cada mockup:
   - la pantalla y la **ruta de la app** que le corresponde (rutas por framework en [referencias/capturar.md](referencias/capturar.md));
   - los **tamaños** que trae (nombres como `-mobile`, `-desktop`, el ancho de la imagen; `@2x` significa escala 2);
   - si trae **modo oscuro** y **estados** (vacío, error, cargando).
   Si hay duda de qué mockup va con qué ruta, pregunta antes de capturar.
2. **Ten la app corriendo.** Si ya está corriendo, úsala. Si no, levántala con los comandos del proyecto (regla 3).
   Si la pantalla pide sesión, usa un usuario de prueba y `--cookie`. Si no levanta en dos intentos, para y explica qué faltó.
3. **Captura la pantalla real** con la herramienta. Córrela **desde la raíz del proyecto** (ahí crea `mockup-vs-app/capturas/`);
   `capturas.mjs --help` lista todas las opciones. La ruta de la herramienta es relativa a esta skill:
   ```bash
   node <carpeta-de-esta-skill>/scripts/capturas.mjs capturar --url http://localhost:3000/registro --nombre registro --lado real --temas claro,oscuro
   ```
   Usa `--tamanos` con los anchos del mockup si no son 390, 768 y 1440. Si la app cambia de tema con una clase, agrega `--oscuro-clase dark`.
4. **Captura el mockup** si es HTML: el mismo comando con `--url file:///ruta/mockup.html --lado mockup` y los mismos tamaños y temas.
   Si es imagen, no hay nada que capturar: la imagen es el mockup.
5. **Compara.**
   - **Mockup HTML:** `capturas.mjs comparar <mockup.json> <real.json>` por cada tamaño y tema. Te da las diferencias medidas, ya ordenadas,
     y las variables CSS distintas. Su nivel ("se nota mucho", "se nota", "detalle") es una sugerencia: el nivel final lo decides tú con la
     definición del reporte, y juntas en una sola las diferencias que vienen de la misma variable o clase.
   - **Mockup imagen:** mira las dos imágenes lado a lado. Saca los colores exactos del mockup con
     `capturas.mjs colores --imagen mockup.png --puntos "x,y;x,y" --escala 2` y las medidas reales del `.json` de la captura.
     Lo que midas a ojo en la imagen márcalo "(aprox.)".
   - **En los dos casos, mira las imágenes.** La comparación automática no ve íconos, imágenes, alineación, cortes de texto ni cosas encimadas.
6. **Revisa también** textos distintos (y faltas de ortografía), elementos que faltan o sobran, y los estados que traiga el mockup.
   Llega a cada estado como lo haría un usuario o con los datos de prueba del proyecto. Si no puedes, va a "Sin comparar".
   Recetas en [referencias/capturar.md](referencias/capturar.md).
7. **Encuentra la causa en el código.** Busca el selector, la clase o la variable en los estilos y componentes
   (`grep -rn "boton" src/ app/ resources/`). Prefiere arreglar el **token o la clase** de origen, no poner valores sueltos.
   Traducción a Tailwind, Bootstrap y variables en [referencias/arreglos.md](referencias/arreglos.md).
8. **Recorta** las diferencias más notorias, del mockup y de la real:
   `capturas.mjs recortar --url <url> --selector ".boton" --tamano celular --lado real`.
   Si el elemento falta (está oculto), recorta su contenedor para que se vea el hueco.
9. **Apaga lo que prendiste**, entrega el reporte y pregunta qué arreglas. Después de cada arreglo aprobado, captura y compara otra vez
   ese tamaño y tema, y confirma que la diferencia desapareció.

## Reporte

El reporte tiene estas partes, en este orden:

**1. Resumen.** Dos o tres oraciones: pantalla y ruta, tamaños y temas revisados, cuántas diferencias por nivel y si se puede entregar así.

**2. Diferencias**, de la que más se nota a la que menos. Una por causa (si cinco elementos fallan por una variable, es una sola). Formato exacto:

```markdown
### 1. 🔴 Se nota mucho: <qué ve el usuario, en palabras simples>
`<selector o componente>` · `<archivo>:<línea>` · <tamaños y temas donde pasa>

- **Mockup:** <valor exacto> · **Real:** <valor exacto>
- **Arreglo:** <el cambio concreto: propiedad, clase o variable, con el valor>
- **Captura:** `mockup-vs-app/capturas/recortes/<archivo>.png` (y la del mockup)
```

Niveles: 🔴 **Se nota mucho** (falta algo, texto distinto, color o tamaño que cualquiera ve) · 🟠 **Se nota** (espacios, grosor, color cercano) · ⚪ **Detalle** (1-2 px, alto de línea, esquinas).

**3. Textos.** Tabla `| Dónde | Mockup | Real |` solo si hay textos distintos.

**4. Sin comparar.** Lo que no pudiste revisar y por qué (estado al que no se llega, tamaño que el mockup no trae, medida solo a ojo).

**5. Cómo repetirlo.** Los comandos exactos de `capturar` y `comparar` que usaste y dónde quedaron las capturas.

**6. Siguiente paso.** Una pregunta: *"¿Cuáles arreglo? Puedo empezar por el #1 y volver a comparar."*

Escribe para alguien que programa pero no es diseñador: frases cortas, medidas exactas, sin adjetivos ("se ve raro").

## Errores comunes

- **Comparar en otro tamaño.** Tablet 820 contra un mockup de 768, o una imagen `@2x` contra una captura normal. Usa los anchos del mockup.
- **Reportar consecuencias.** Si la tarjeta tiene menos relleno, todo lo de adentro mide más ancho. Reporta el relleno, no diez anchos.
- **Olvidar el modo oscuro o el celular.** Los errores más comunes viven ahí: un color que no cambió, un `display: none` en una media query.
- **Arreglar con números sueltos.** Si el proyecto usa variables o Tailwind, el arreglo es la variable o la clase (`h-12`), no `height: 48px`.
- **Confiar solo en la comparación automática.** Si el mockup y la app tienen HTML distinto (exportación de Figma contra React), salen pares
  "falta / sobra" que en realidad son el mismo elemento. Confírmalo mirando las imágenes.
- **Dejar basura en el proyecto.** Nada de perfiles del navegador ni scripts sueltos; solo `mockup-vs-app/`.
