# Cómo convertir una diferencia en un arreglo concreto

El arreglo bueno cambia **el origen** (la variable, la clase del sistema de diseño o el componente compartido), no el síntoma.

## 1. Encontrar dónde vive el estilo

1. Toma el selector que dio la comparación (`section.tarjeta > button.boton`) y busca la clase:
   `grep -rn "boton" --include=*.css --include=*.scss --include=*.tsx --include=*.vue --include=*.erb --include=*.html .`
2. Si la comparación dice **"Variables CSS distintas"**, busca la variable: `grep -rn "\-\-primario" .`. Ese es el arreglo.
3. Si el mismo cambio aparece en varios elementos ("+3 elementos más"), busca qué comparten: casi siempre una variable o un componente.
4. Revisa las media queries (`@media (max-width…)`, `md:`, `lg:`) y el modo oscuro (`prefers-color-scheme`, `.dark`, `dark:`):
   ahí se esconden los elementos que solo faltan en celular y los colores que no cambian en oscuro.

## 2. Valores de Tailwind más usados

| Medida | Clase | Medida | Clase |
|---|---|---|---|
| 32 px de alto | `h-8` | 12 px de relleno | `p-3` |
| 40 px | `h-10` | 16 px | `p-4` |
| 44 px | `h-11` | 20 px | `p-5` |
| 48 px | `h-12` | 24 px | `p-6` |
| 14 px de letra | `text-sm` | 32 px | `p-8` |
| 16 px | `text-base` | 8 px de separación | `gap-2` |
| 18 px | `text-lg` | 16 px | `gap-4` |
| 20 px | `text-xl` | radio 6 / 8 / 12 / 16 px | `rounded-md` / `rounded-lg` / `rounded-xl` / `rounded-2xl` |
| 24 px | `text-2xl` | peso 600 / 700 | `font-semibold` / `font-bold` |
| 30 px | `text-3xl` | 28 px (fuera de escala) | `text-[28px]` o agregar el valor al tema |

Colores: `#2563eb` es `blue-600`, `#3b82f6` es `blue-500`, `#6b7280` es `gray-500`, `#9ca3af` es `gray-400`.
Si el proyecto tiene `tailwind.config` con colores propios, usa esos nombres.

## 3. Otros sistemas

| Stack | Dónde se cambia | Ejemplo |
|---|---|---|
| CSS / SCSS con variables | `:root { --primario: ... }` o `$primario` | `--primario: #2563eb;` |
| Bootstrap | variables Sass (`$primary`, `$btn-padding-y`) o clases (`py-3`, `fs-4`) | `$btn-padding-y: .75rem;` |
| CSS Modules / styled-components / Emotion | el archivo del componente (`Boton.module.css`, `const Boton = styled.button`) | `height: 48px;` en el componente |
| Rails / Django / Laravel con plantillas | la clase en la vista (`.erb`, `.html`, `.blade.php`) y la hoja en `app/assets`, `static/` o `resources/css` | `class="boton boton--grande"` |
| Material UI / Chakra | el tema (`createTheme`, `extendTheme`) o la prop `sx` | `palette.primary.main` |

## 4. Cómo escribir el arreglo en el reporte

- Bien: *"En `estilos.css:3` cambia `--primario: #3b82f6` por `#2563eb`. Arregla el botón, el logo y el enlace."*
- Bien: *"En `Boton.tsx:12` cambia `h-10` por `h-12` (48 px)."*
- Mal: *"Ajustar el color del botón para que coincida con el diseño."* (no dice dónde ni a qué valor)
- Mal: *"Poner `style="height:48px"` en el botón."* (rompe el sistema de diseño)

## 5. Textos

Si el texto real sale de traducciones (`es.json`, `config/locales/es.yml`, `lang/es/*.php`, `locale/es/LC_MESSAGES`), el arreglo va ahí,
no en el componente. Antes de proponer el cambio, pregunta cuál manda: a veces el texto real es el correcto y el mockup quedó viejo.
