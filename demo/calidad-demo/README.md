# Calidad Demo

Tiendita de práctica **con fallas a propósito** para ver trabajar la skill [calidad](../../plugins/calidad/skills/calidad/SKILL.md).
Calcula totales con IVA y cupones, genera facturas, imprime recibos y corre un cierre diario. No usa base de datos ni dependencias.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node --test          # las pruebas: pasan casi siempre…
npm start            # servidor: POST http://127.0.0.1:4500/api/total  {"articulos":[{"precio":100,"cantidad":1}],"cupon":"DESC10"}
```

## Reto

Prueba estos pedidos:

- `/calidad:calidad impacto calcularTotal`: *"quiero que reciba un objeto y regrese `{ total, moneda }`, ¿qué rompo?"*
- `/calidad:calidad bug "con el cupón DESC10 y varios artículos el total sale mal"`
- `/calidad:calidad pruebas`, `/calidad:calidad inestables`, `/calidad:calidad muerto`

<details>
<summary>Ver las fallas (spoiler)</summary>

1. `calcularTotal` se usa en 7 lugares y **4 no salen buscando su nombre**: un alias (`total` en `src/index.js`),
   una ruta que la llama por texto (`src/rutas.js`), un trabajo nocturno que la elige desde `config/trabajos.json`
   y una plantilla de recibo (`{{calcularTotal ...}}`). Además la consume una app móvil de otro repositorio (`docs/consumidores.md`).
   Si cambias lo que regresa, el recibo y el cierre contable se rompen **sin dar error**.
2. El cupón DESC10 descuenta solo el primer artículo: el mismo carrito cuesta distinto según el orden. Con el carrito vacío, truena.
3. `test/carrito.test.js` no prueba nada: una prueba no tiene aserciones y la otra solo revisa que `total` exista.
4. `test/factura.test.js` falla al azar (1 de cada 10): el folio usa `Math.random` y a veces sale con menos de 4 dígitos. El error real está en el código.
5. `test/trabajos.test.js` espera 1.5 s sin necesidad: el trabajo es síncrono.
6. Código muerto: `src/legacy/cupones-viejos.js` y `precioConIvaViejo` (con IVA de 15 %).
   **Trampa:** `src/trabajos/cierre.js` parece muerto, pero se carga por nombre desde la configuración.

</details>
