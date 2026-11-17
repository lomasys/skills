# Componentes repetidos

El objetivo no es tener menos archivos: es que **un cambio de diseño o de accesibilidad se haga en un solo lugar**.
Si hay cinco botones casi iguales, el arreglo de contraste o de foco se hace cinco veces, y siempre se olvida uno.

## Cómo encontrarlos

1. **Por nombre:** componentes que se llaman parecido (`BotonGuardar`, `BotonEnviar`, `PrimaryButton`, `SubmitBtn`; `UserCard`, `ClienteCard`; `ModalConfirmar`, `DialogoBorrar`).
2. **Por estilos:** clases CSS con las mismas declaraciones y uno o dos valores distintos (`.boton-guardar` y `.boton-enviar` cambian solo `padding`).
   Ordena las declaraciones de cada regla y compáralas: si comparten 80 % o más, son candidatas.
3. **Por estructura:** el mismo marcado pegado en varias pantallas (el mismo `<svg>` de borrar, la misma tarjeta, la misma fila de tabla).
   Busca un fragmento distintivo con `grep -rn` y cuenta los lugares.
4. **Por uso a mano:** lugares que copian la clase del componente sin usarlo (`<button class="boton-guardar">` escrito a mano).
5. **Flutter:** widgets con el mismo árbol (`ElevatedButton` con el mismo `style:`), o `TextStyle` y `BoxDecoration` repetidos que deberían ir al tema.

Antes de proponer, revisa si el proyecto **ya tiene** un componente base (carpeta `ui/`, `components/base`, librería como MUI, Vuetify, shadcn).
En ese caso la propuesta es usar el que ya existe, no crear otro.

## Cuándo **no** unir

- Se parecen hoy, pero cambian por razones distintas (uno es de facturación, otro de marketing, con reglas propias).
- Unirlos requiere más de 3 o 4 props de "modo" o banderas que se excluyen entre sí. Eso es señal de que son dos componentes.
- La diferencia es de comportamiento (validaciones, llamadas a la API), no de presentación. Une solo la parte visual.

## Formato de la propuesta

Por cada grupo:

````markdown
### Unir `BotonGuardar` y `BotonEnviar` en `Boton`
- **Hoy:** `public/componentes/botones.js:3` y `:12`, más un uso a mano en `public/index.html:23` (`class="boton-guardar"`).
- **Diferencias:** el texto, el padding (16 px contra 18 px) y que `BotonEnviar` acepta `cargando`. El color es el mismo (`#4fc3f7`) escrito de dos formas.
- **API propuesta:**
  ```js
  Boton({ texto, onClick, variante = 'primario', cargando = false, textoCargando, tipo = 'button' })
  // variante: 'primario' | 'secundario' | 'peligro'
  // cargando: desactiva el botón, muestra textoCargando y pone aria-busy="true"
  ```
- **Lugares que cambian:**
  - `public/app.js:35` `BotonGuardar({ onClick })` → `Boton({ texto: t('acciones.guardar'), onClick })`
  - `public/app.js:36` `BotonEnviar({ onClick })` → `Boton({ texto: t('acciones.enviar'), onClick, textoCargando: t('acciones.enviando') })`
  - `public/pedidos.js:21` igual que la anterior
  - `public/index.html:23` `<button class="boton-guardar">` → mismo estilo con la clase `boton boton--primario`
- **CSS:** una regla `.boton` con lo común y `.boton--primario`, `.boton--secundario` con lo que cambia. Los colores, en variables.
- **Gana además:** el arreglo de contraste y de foco se hace una sola vez.
````

La API va en el estilo del framework:

| Stack | Forma típica |
|---|---|
| React | `<Boton variante="primario" cargando={enviando} onClick={…}>{t('acciones.guardar')}</Boton>` |
| Vue | `<Boton variante="primario" :cargando="enviando" @click="…">{{ $t('acciones.guardar') }}</Boton>` |
| Svelte | `<Boton variante="primario" cargando={enviando} on:click={…}>…</Boton>` |
| Angular | `<app-boton variante="primario" [cargando]="enviando" (click)="…">…</app-boton>` |
| Rails | un parcial `render "ui/boton", texto:, variante:` o un ViewComponent `Ui::BotonComponent` |
| Django | `{% include "ui/boton.html" with texto=… variante="primario" %}` o una etiqueta de inclusión |
| Laravel | `<x-boton variante="primario" :cargando="$enviando">…</x-boton>` |
| Flutter | `Boton(texto: …, variante: Variante.primario, cargando: enviando, onPressed: …)` |

No escribas el componente nuevo ni cambies los usos hasta que el usuario lo apruebe. Si lo aprueba, hazlo en este orden:
crea el componente, cambia **un** uso, que el usuario lo vea, y luego los demás.
