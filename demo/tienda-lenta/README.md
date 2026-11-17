# Tienda Lenta

Mini app **lenta a propósito** para ver trabajar la skill [rendimiento](../../plugins/rendimiento/skills/rendimiento/SKILL.md).
Una tienda con pedidos, catálogo y reportes. Funciona… pero tarda.

La base de datos es simulada en memoria: cada consulta tarda ~1.5 ms (como una base en la misma máquina) y se cuenta por petición.

> [!CAUTION]
> No la publiques en ningún servidor. Solo escucha en `127.0.0.1`.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node server.js              # http://localhost:4400
SQL_LOG=1 node server.js    # además imprime cada consulta (en PowerShell: $env:SQL_LOG=1; node server.js)
node --test                 # pruebas
```

Cada petición deja una línea en la consola, como el log de Rails o Laravel:

```
GET /api/pedidos 200 en 870ms (base: 760ms en 500 consultas)
```

| Ruta | Qué es |
|---|---|
| `/` | Página principal |
| `/api/pedidos` | Pedidos recientes con cliente y productos |
| `/api/productos` | Catálogo |
| `/api/categorias` | Categorías con cuántos productos tienen |
| `/api/reporte-ventas` | Los 10 productos más vendidos en 90 días |

## Reto

Antes de correr la skill, intenta encontrar qué la hace lenta tú mismo. Hay **cinco** problemas y **una** ruta que ya está bien.
Después corre `/rendimiento:rendimiento` y compara.

<details>
<summary>Ver la lista (spoiler)</summary>

1. **N+1 en pedidos** (`/api/pedidos`): una consulta por pedido, otra por sus productos y otra por cada producto. ~500 consultas, ~0.9 s.
2. **Catálogo sin paginar** (`/api/productos`): manda los 5,000 productos (1.8 MB) y la página solo muestra 20.
3. **El código, no la base** (`/api/reporte-ventas`): la base tarda ~40 ms; el resto se va en buscar con `.find()` dentro de un ciclo y ordenar en cada vuelta.
4. **JavaScript pesado** (`/static/app.js`): 900 KB en `<head>` sin `defer`, con una librería de gráficas que solo usa `/reportes`.
5. **Imagen sin optimizar** (`/static/portada.png`): 4.6 MB, sin `width`/`height`. Y nada se manda comprimido.

**Bien hecho:** `/api/categorias` hace una sola consulta y responde en ~3 ms. No hay nada que arreglar ahí.

</details>
