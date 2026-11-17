---
name: rendimiento
description: Use when the user says an app, page, screen or API endpoint is slow, wants to speed it up, asks why something takes so long, suspects too many database queries (N+1), has lists or APIs that load everything at once, a heavy frontend (big JavaScript bundle, large images, slow first load), or wants a speed budget or performance test that fails when a page gets slower (lento, tarda mucho, se traba, optimizar, rendimiento, performance, consultas repetidas, paginación, pesa mucho, presupuesto de velocidad).
---

# Rendimiento

Mide una pantalla o endpoint, encuentra **la causa real** de la lentitud y propone arreglos, cada uno con su número
antes y después. El usuario recibe pocos cambios, todos medidos, y decide cuáles aplicar.

**Principio:** medir antes y después. Sin un número, "optimizar" es adivinar.

## Modos

Lee el argumento que escribió el usuario (`/rendimiento:rendimiento <modo>`):

| Argumento | Qué hace |
|---|---|
| *(nada)* o `<ruta o pantalla>` | **Lento por qué:** mide esa ruta (o las 3–5 más usadas), separa tiempo en la base, en el código y en llamadas externas, y encuentra la causa |
| `n+1` | Busca consultas repetidas en todo el proyecto y mide las rutas donde aparecen |
| `listas` | Busca listas y APIs que cargan todo de golpe y propone paginación real |
| `frontend` | Mide lo que descarga una página: JavaScript, CSS, imágenes, compresión, carga por partes |
| `presupuesto` | Fija un límite por página o endpoint y deja una prueba que falla si se pasa |

Recetas por tema y por stack en [referencias/causas.md](referencias/causas.md), [referencias/frontend.md](referencias/frontend.md)
y [referencias/presupuesto.md](referencias/presupuesto.md).

## Reglas (no negociables)

1. **Solo local o pruebas.** Mide contra `localhost`, Docker local o un ambiente de pruebas. **Nunca** mandes carga a producción.
   Si solo existe en producción, pregunta; con permiso, máximo 20 peticiones, de una en una.
2. **No cambias el código del usuario sin su permiso.** Para medir el "después" de un arreglo, aplícalo en una **copia aparte**
   (`git worktree add` en una carpeta temporal o una copia de la carpeta), nunca en la carpeta del usuario.
   En el proyecto solo puedes agregar la carpeta `rendimiento/` (mediciones y notas) y, en modo `presupuesto`, pruebas nuevas.
3. **Cada arreglo propuesto lleva su número antes y después**, medido con la misma herramienta, la misma `--n` y la misma máquina.
   Un arreglo que no pudiste medir va en "Sin medir", nunca en "Arreglos medidos".
4. **Un arreglo a la vez.** Mide cada cambio por separado. Si mezclas tres, no sabes cuál ayudó y cuál estorbó.
5. **No instalas herramientas de perfilado sin preguntar** (bullet, django-debug-toolbar, Lighthouse, clinic, rack-mini-profiler…).
   Usa lo que el proyecto ya tiene y la herramienta de la skill.
6. **Solo apagas lo que tú prendiste.** Levanta la app en un puerto libre, guarda su PID y al final detén **ese PID**.
   Nunca `taskkill /IM`, `killall` ni `pkill` por nombre. Borra la copia temporal al terminar.
7. **Nada destructivo.** Sin `DROP`, `DELETE` ni `TRUNCATE`. Si necesitas más datos para ver el problema, créalos en la base local y dilo.
8. **No copies secretos ni datos personales** al reporte. Recorta las respuestas a lo necesario.

| Pensamiento | Realidad |
|---|---|
| "Ya sé que es la base, lo arreglo y listo" | Mide primero. La mitad de las veces la causa está en otro lado. |
| "Arreglo todo de una vez y mido al final" | No sabrás qué ayudó. Un arreglo, una medición. |
| "Con 3 peticiones basta" | La primera suele ser lenta (calentamiento). Usa la herramienta: calienta y mide 20. |
| "Este endpoint se ve mejorable" | Si ya es rápido y no hay número malo, va en "Bien hecho". No se toca. |
| "Lo cambio en su carpeta y luego lo regreso" | Se te olvida, o el usuario lo ve a medias. Copia aparte. |

## Proceso

1. **Entiende la app.** Cómo se levanta, qué base usa, qué ORM, qué pruebas tiene, si ya registra consultas o tiempos
   (logs del framework, `Server-Timing`, APM). Si el usuario nombró una pantalla, encuentra qué rutas llama.
2. **Levántala** (regla 6) con el log de consultas prendido si el proyecto ya lo trae (ver [causas.md](referencias/causas.md)).
   Si no levanta en dos intentos, haz solo revisión de código y marca todo como "Sin medir".
3. **Mide la línea base** con la herramienta. La ruta es relativa a esta skill:
   ```bash
   node <carpeta-de-esta-skill>/scripts/medir.mjs medir http://localhost:PUERTO/RUTA --n 20 --etiqueta antes-RUTA
   node <carpeta-de-esta-skill>/scripts/medir.mjs peso  http://localhost:PUERTO/ --etiqueta antes-pagina   # modo frontend
   ```
   Corre la herramienta desde la carpeta del proyecto: las mediciones quedan en `rendimiento/mediciones/` (también las de la copia, con `--salida`).
   Para cada ruta anota: mediana, p95, peso (sin comprimir y por la red), **número de consultas**, tiempo en la base y fuera de ella (del log).
   Tiempo total − tiempo en base − llamadas externas = tiempo en el código.
   Si la herramienta avisa de mucha variación, o el p95 pasa del doble de la mediana, usa `--n 50` en **todas** las rutas, también en la tabla del reporte.
4. **Encuentra la causa** con esos números, no con la intuición:
   muchas consultas iguales → N+1 · respuesta enorme → falta paginar · base rápida pero total lento → el código ·
   espera a otro servicio → llamada externa · página pesada → frontend. Confírmala en el código con archivo y línea.
5. **Prueba cada arreglo en la copia** (regla 2): levántala en otro puerto, aplica uno, mide la misma ruta con la misma `--n`,
   compara y regresa la copia antes del siguiente. Un arreglo es un cambio que funciona solo (si la API y la página deben cambiar juntas, es uno).
   Si sumas dos arreglos medidos por separado, el total es **estimado**:
   ```bash
   node <carpeta-de-esta-skill>/scripts/medir.mjs comparar rendimiento/mediciones/<antes>.json rendimiento/mediciones/<despues>.json
   ```
   Si dice **SIN DIFERENCIA CLARA** en tiempo y el peso por la red no bajó, no es una mejora. Si dice que **la respuesta cambió**, revisa que regrese los mismos datos.
   Corre las pruebas del proyecto en la copia.
6. **Detén la app** (solo tu PID), borra la copia y entrega el reporte.
7. **Pregunta** qué arreglos aplica. Al aplicar uno en su proyecto, mide otra vez y confirma el número.

## Reporte

El reporte tiene estas partes, en este orden:

**1. Resumen.** Dos o tres oraciones: qué está lento, cuánto, la causa principal en palabras simples y cuánto ganaría.

**2. Mediciones de hoy.** Tabla con todas las rutas medidas, también las que están bien:

| Ruta | Mediana | p95 | Peso | Consultas | En la base | Causa |
|---|---|---|---|---|---|---|

**3. Arreglos medidos**, del que más ahorra al que menos. Cada uno con este formato exacto:

```markdown
### 🔴 <qué siente el cliente, en palabras de negocio>
`<método y ruta>` · `<archivo>:<línea>`

- **Causa:** <qué pasa, con el número que lo demuestra: "hace 500 consultas, una por pedido">
- **Arreglo:** <el cambio concreto en una o dos líneas>
- **Antes → después:** mediana <a> ms → <b> ms · p95 <c> → <d> ms · <consultas o bytes por la red antes → después>
- **Cómo lo medí:** `medir.mjs` <n> peticiones, en una copia; la respuesta <es idéntica | cambió en: …>
- **Riesgo:** <qué podría romper y qué prueba lo cubre>
```

Gravedad, por la mediana o, para peso, por los segundos estimados con 10 Mbps (bytes × 8 / 10,000,000):
🔴 **Grave** (más de 1 s en una pantalla de uso diario, o traba el servidor) · 🟠 **Alta** (300 ms a 1 s, o más de 1 s en una pantalla poco usada) ·
🟡 **Media** (gasto que crece con los datos) · ⚪ **Baja**.

**4. Sin medir.** Lo que sospechas pero no pudiste medir, con la razón y un estimado marcado como **estimado**.

**5. Bien hecho.** Rutas que ya son rápidas, con su número. Así el usuario sabe qué no tocar.

**6. Cómo repetirlo.** Los comandos exactos de `medir` y `comparar`, y dónde quedaron las mediciones.

**7. Siguiente paso.** Una pregunta: *"¿Cuáles aplico? Empiezo por el #1 y te muestro el número otra vez."*

Escribe para alguien que programa pero no es experto en rendimiento: frases cortas, sin siglas sin explicar,
el impacto en clientes que esperan, servidores que cuestan y ventas que se pierden.

## Errores comunes

- **Medir una sola vez.** La primera petición calienta cachés y conexiones. Calienta y usa mediana y p95, no el promedio.
- **Medir en tu máquina y hablar de la del cliente.** En local no hay red. Lo que dependa de la red (peso, imágenes) va como **estimado**.
- **Arreglar lo que ya está bien.** Una ruta de 3 ms con una consulta no se toca, aunque el código "se vea mejorable".
- **Cambiar lo que regresa la API sin decirlo.** Paginar cambia el contrato: avisa quién lo usa y deja el formato viejo si hace falta.
- **Agregar caché para tapar un N+1.** Primero quita las consultas repetidas; la caché esconde el problema y agrega datos viejos.
- **Pruebas de velocidad que fallan al azar.** En el presupuesto, el número de consultas y el peso son exactos; el tiempo lleva margen.
