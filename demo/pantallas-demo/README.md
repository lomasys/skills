# Pantallas Demo

App de práctica **con fallas de interfaz a propósito** para ver trabajar la skill [pantallas](../../plugins/pantallas/skills/pantallas/SKILL.md).
Es la sección de clientes y pedidos de una tienda inventada, *Tiendita*. HTML y JavaScript sin framework, para que se lea fácil.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node server.js            # http://localhost:4500
PORT=4600 node server.js  # en otro puerto
```

Para ver los estados de las listas, agrega `?modo=` a la página: `vacio`, `error`, `sinpermiso` o `lento`.
Por ejemplo `http://localhost:4500/?modo=error` o `http://localhost:4500/pedidos.html?modo=vacio`.

## Reto

Antes de correr la skill, intenta encontrar las fallas tú. Hay al menos **doce**.
Después corre `/pantallas:pantallas` y compara.

<details>
<summary>Ver la lista (spoiler)</summary>

**Accesibilidad**
1. Texto de ayuda gris `#a0a0a0` sobre blanco (2.61:1), fechas `#bbbbbb` (1.91:1), encabezados de la tabla `#8a8a8a` (3.45:1).
2. Botones azules con texto blanco sobre `#4fc3f7` (2.00:1).
3. Botones de configuración y de borrar con solo un ícono, sin nombre para el lector de pantalla, de 20×20 px.
4. `button:focus { outline: none; }` sin reemplazo: no se ve dónde está el foco.
5. "Exportar a Excel" es un `<div>` y la × del modal un `<span>`: no se usan con teclado. El modal no se cierra con Esc.
6. Logo y fotos sin `alt`; campos sin etiqueta ligada; `index.html` sin `lang`.

**Textos**
7. `dashboard.title` falta en español: el título se ve crudo. `clientes.contador` y `pedidos.enviados` no existen en ningún idioma.
8. `clientes.vacio` falta en inglés; `acciones.cancelar` dice "Cancel" en español.
9. Textos fijos en el código, algunos en inglés ("Loading...", "Not implemented yet").

**Estados**
10. La lista de clientes no tiene estado vacío ni de error ni de sin permiso: con un error se queda en "Loading..." para siempre.
11. Pedidos sí tiene vacío y cargando, pero no error ni sin permiso.

**Componentes**
12. `BotonGuardar` y `BotonEnviar` son casi iguales (y sus clases CSS también); "+ Nuevo" copia la clase a mano.

</details>
