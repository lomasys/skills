---
name: pantallas
description: Use when the user wants to review the quality of a screen, page, component or UI folder (revisar pantallas, revisar la interfaz, calidad de UI, UI review), check accessibility (accesibilidad, a11y, WCAG, contraste, lectores de pantalla, teclado, foco, tamaño táctil), find untranslated or hardcoded text, missing translation keys or raw keys like "dashboard.title" showing on screen (traducciones, i18n, textos fijos), check that lists and data screens handle empty, loading, error and no-permission states (estados vacíos, pantalla en blanco, se queda cargando), or find near-duplicate components to merge (componentes repetidos, botones casi iguales). Works on React, Vue, Svelte, Angular, Rails/Django/Laravel templates and Flutter. Not for comparing a design mockup against the app.
---

# Pantallas

Revisa la calidad de las pantallas de tu app: que todos las puedan usar, que los textos estén traducidos,
que nada se quede en blanco cuando falla y que no haya cinco versiones del mismo botón.
Cada propuesta viene con el archivo, la línea y el cambio exacto.

**Principio:** un problema de pantalla se demuestra con un número, una captura o la línea de código. "Se ve bajo" no es un hallazgo; "2.61:1, el mínimo es 4.5:1" sí.

## Modos

Lee el argumento (`/pantallas:pantallas <modo> [ruta]`). La ruta es opcional: una pantalla, un componente o una carpeta.

| Argumento | Qué revisa |
|---|---|
| *(nada)* | Los cuatro temas sobre la ruta indicada, o sobre las pantallas principales si no hay ruta |
| `accesibilidad` | Contraste, teclado (foco visible, orden, trampas), nombres para lectores de pantalla, tamaños táctiles ([referencias/accesibilidad.md](referencias/accesibilidad.md)) |
| `textos` | Textos fijos en el código, llaves que faltan, llaves crudas en pantalla, frases técnicas o en otro idioma ([referencias/textos.md](referencias/textos.md)) |
| `estados` | Vacío, cargando, error y sin permiso en cada pantalla o componente con datos ([referencias/estados.md](referencias/estados.md)) |
| `componentes` | Componentes casi iguales y la API del componente único que los reemplaza ([referencias/componentes.md](referencias/componentes.md)) |

## Reglas (no negociables)

1. **Solo local.** Abre la app en `localhost` o en un ambiente de pruebas. Nunca abras producción ni inicies sesión con cuentas reales sin permiso.
2. **No cambias componentes, estilos ni traducciones sin permiso.** Propones con `archivo:línea` y el cambio exacto (`antes → después`).
   Aplicas solo lo que el usuario apruebe, uno por uno. Las capturas y salidas van a una carpeta temporal, fuera del proyecto.
3. **Solo apagas lo que tú prendiste.** Antes de levantar la app, elige un puerto libre. Después, guarda el PID del proceso que escucha en ese puerto
   y al terminar detén **ese PID**. Nunca `taskkill /IM`, `killall`, `pkill node` ni nada por nombre.
4. **Nada destructivo.** No borras registros, no cambias datos de otros. Si para ver un estado "vacío" necesitas datos distintos, usa una cuenta o base de prueba y regrésala como estaba.
5. **No instalas nada.** Usa lo que ya exista: Playwright o Cypress si el proyecto los tiene, si no Chrome o Edge en modo sin ventana (headless), si no solo el código.
6. **No copias secretos ni datos personales** al reporte ni a las capturas que compartas (máximo los primeros 4 caracteres de una clave).
7. **Usa la herramienta de la skill** (`scripts/pantallas.mjs`) para contraste y textos. No calcules contrastes "a ojo" ni con otro script: así el resultado es el mismo cada vez.

| Pensamiento | Realidad |
|---|---|
| "Corrijo el color de una vez, es una línea" | El color es del diseño del usuario. Propón el valor que cumple y deja que decida. |
| "Sugiero un azul más oscuro, algo como #0277bd" | Cada color que propongas, mídelo con `contraste` antes. Si no lo mediste, no lo propongas. |
| "Se ve bien en la captura, no hace falta probar el error" | El estado de error casi nunca sale en una captura normal. Provócalo. |
| "El lector de pantalla seguro lee el ícono" | Un `<svg>` sin nombre se anuncia como "botón". Busca el nombre en el código. |
| "Ya que estoy, reviso también el rendimiento y la seguridad" | Quédate en los cuatro temas. Lo demás va en una línea al final, si es grave. |

## Proceso

1. **Ubica la pantalla.** Framework, dónde viven las pantallas y los componentes, el sistema de traducciones (archivos, función `t()`, idiomas)
   y cómo se levanta la app (scripts del proyecto, README, `docker-compose.yml`). Si el usuario no dio ruta, elige las 3 a 5 pantallas con más uso (inicio, listados, formularios).
2. **Corre la herramienta** sobre la carpeta (la ruta del script es relativa a esta skill):
   ```bash
   node <skill>/scripts/pantallas.mjs css <carpeta>            # contraste de cada par color/fondo del CSS
   node <skill>/scripts/pantallas.mjs accesibilidad <carpeta>  # alt, nombres, etiquetas, foco, teclado, tamaños
   node <skill>/scripts/pantallas.mjs textos <carpeta>         # llaves que faltan, llaves crudas, textos fijos
   node <skill>/scripts/pantallas.mjs contraste "#a0a0a0" "#ffffff"   # un par suelto, con el color que sí cumple
   ```
   La herramienta da **candidatos**. Abre cada archivo:línea y confírmalo antes de reportarlo.
3. **Lee el código** de lo que la herramienta no ve: estados (cada `fetch`, consulta o `useQuery` y qué se muestra en cada caso),
   modales y menús (foco y tecla Esc), componentes parecidos. Sigue la referencia de cada tema.
4. **Abre la app** si se puede (regla 3 y 5), con las recetas de [referencias/accesibilidad.md](referencias/accesibilidad.md#abrir-la-app):
   captura de escritorio y de celular por pantalla, el DOM ya pintado para correr `accesibilidad` sobre él, y cada estado provocado
   (lista vacía, API con error, usuario sin permiso, red lenta). Si hay Playwright, recorre la pantalla con Tab.
   Si no levanta en dos intentos, sigue solo con el código y márcalo como "Sin comprobar en navegador".
5. **Mide cada color que vayas a proponer** con `contraste`. Usa el que la herramienta sugiere o uno de la paleta del proyecto que cumpla.
6. **Escribe el cambio exacto** de cada hallazgo: archivo, línea, antes y después. Para traducciones, la llave y su texto en **cada** idioma.
7. **Detén la app** (solo tu PID), borra tu carpeta temporal si el usuario no quiere las capturas y entrega el reporte.
8. **Pregunta** qué cambios aplicar. Al aplicar uno, vuelve a correr la herramienta y confirma que el aviso desapareció.

## Reporte

El reporte tiene estas partes, en este orden:

**1. Resumen.** Dos o tres oraciones: cuántos hallazgos por gravedad, el peor dicho como lo vive el usuario final, y si abriste la app o solo leíste el código.

**2. Hallazgos**, del más grave al menos grave, agrupados por tema (Accesibilidad, Textos, Estados). Cada uno con este formato exacto:

````markdown
### 🔴 <qué le pasa a la persona que usa la pantalla>
`<archivo>:<línea>` · <pantalla o componente> · WCAG <número> (solo si aplica y estás seguro)

- **Lo vi:** <herramienta, navegador o lectura del código> → <el dato: razón de contraste, llave que se ve cruda, lo que se pinta con error>
- **A quién afecta:** <personas con baja visión, quien usa teclado, clientes en inglés, todos cuando falla la red>
- **Cambio propuesto:**
  ```diff
  - <línea actual>
  + <línea propuesta>
  ```
````

Gravedad: 🔴 **Bloquea** (alguien no puede usar la pantalla: sin teclado, sin nombre para el lector, llave cruda en un título, pantalla congelada al fallar) ·
🟠 **Alta** (cuesta mucho usarla: contraste muy bajo, sin estado de error visible) · 🟡 **Media** · ⚪ **Baja**.
Si el mismo problema se repite en muchos lugares, repórtalo una vez con la lista de `archivo:línea`.
Muchos textos fijos van en **un** hallazgo: un bloque `diff` con todos los cambios y una tabla `Llave | es | en | …` con las llaves nuevas.

**3. Estados por pantalla.** Una tabla: pantalla o componente × Vacío · Cargando · Error · Sin permiso, con ✅, ❌ o ⚠️ (existe pero está mal), y el `archivo:línea` de cada ❌.

**4. Componentes para unir.** Por cada grupo: qué componentes son, en qué se diferencian, la API del componente único y la lista de lugares que cambian (formato en [referencias/componentes.md](referencias/componentes.md)).

**5. Sin comprobar.** Lo que solo viste en el código y no en el navegador (por ejemplo, el recorrido con Tab sin Playwright, un modal que no se abre sin clics), o lo que depende de datos que no tienes, con la razón.

**6. Bien hecho.** Hasta cinco cosas que ya están bien, para que nadie las rompa.

**7. Siguiente paso.** Una pregunta: *"¿Cuáles aplico? Puedo empezar por el #1."*

Escribe para alguien que programa pero no es experto en accesibilidad: frases cortas, sin siglas sin explicar, el problema en términos de personas y clientes.

## Errores comunes

- **Proponer colores sin medirlos.** El color "más oscuro" que se ve bien a veces sigue sin cumplir. Mide cada propuesta.
- **Redondear hacia arriba.** 4.49:1 **no** cumple 4.5:1. La herramienta nunca redondea hacia arriba.
- **Revisar solo el estado feliz.** La mayoría de las pantallas rotas lo están cuando la lista viene vacía, la API falla o el usuario no tiene permiso.
- **Ver solo el idioma principal.** Una llave que falta en inglés se ve cruda solo para los clientes en inglés.
- **Pedir aria-label para todo.** Si un botón ya tiene texto visible, no le hace falta. Lo primero es usar el elemento correcto (`<button>`, `<label>`).
- **Unir componentes que solo se parecen.** Si cada uno tiene reglas de negocio distintas, únelos solo en la parte visual.
- **Citar un criterio WCAG de memoria.** Usa solo los números de la tabla de [referencias/accesibilidad.md](referencias/accesibilidad.md). Si dudas, describe el problema sin número.
