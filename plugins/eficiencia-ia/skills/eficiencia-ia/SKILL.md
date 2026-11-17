---
name: eficiencia-ia
description: Use when the user wants coding agents (Claude Code, Codex, Cursor, Copilot, Gemini) to waste fewer tokens or less time, asks to create or improve AGENTS.md, CLAUDE.md, .cursor/rules or copilot-instructions, says an agent keeps going in circles or repeats the same error, wants to turn a vague request into a clear task for an agent, asks which tasks a cheap or free model can handle, wants to know how much AI cost a feature, or says the AI inside their product is too expensive (llamadas repetidas, prompts enormes, modelo caro, sin límite de tokens). Spanish triggers: gastar menos tokens, la IA sale cara, factura de IA, el agente da vueltas, archivo de instrucciones, memoria del proyecto, cuánto costó esta función.
---

# Eficiencia IA

Hace que tus agentes de IA de programación y la IA dentro de tu producto **gasten menos y avancen más**.
Todo lo que propone está medido o probado en tu máquina: comandos que sí corren, ahorros contados en tokens, precios con fuente.

**Principio:** un ahorro que no se midió es una corazonada, y un comando que no se corrió es una trampa para el siguiente agente.

## Modos

Lee el argumento que escribió el usuario (`/eficiencia-ia:eficiencia-ia <modo>`):

| Argumento | Qué hace |
|---|---|
| *(nada)* | Diagnóstico general: revisa el archivo de instrucciones, el uso registrado y si el producto llama a modelos. Da las 3 mejoras que más ahorran |
| `memoria` | Crea o mejora el archivo de instrucciones que leen los agentes ([referencias/memoria.md](referencias/memoria.md)) |
| `tarea <pedido>` | Convierte un pedido vago en una tarea clara, con contexto justo y el modelo adecuado ([referencias/tareas.md](referencias/tareas.md)) |
| `producto` | Revisa las llamadas a modelos en el código del producto y estima el ahorro de cada cambio ([referencias/producto.md](referencias/producto.md)) |
| `costo` | Cuánto gastaron los agentes en una función, rama o periodo, o cómo empezar a medirlo ([referencias/costo.md](referencias/costo.md)) |

## Reglas (no negociables)

1. **Borrador primero.** No escribes ni cambias el archivo de instrucciones, la configuración de los agentes (`settings.json`, reglas, modelos, permisos) ni el código del producto sin mostrar antes el borrador o el cambio y recibir un "sí". Los cambios de código se aplican **uno por uno**.
2. **Nada sale de la máquina.** No mandas código, prompts ni bitácoras del usuario a ningún servicio externo. Internet solo para leer documentación o páginas de precios oficiales.
3. **No inventas precios.** Un precio lleva siempre **fuente y fecha de consulta** y se llama "estimado". Si no lo puedes confirmar, el ahorro va en tokens y llamadas. Tampoco inventas proporciones ("la salida cuesta 4 veces la entrada") para sacar un porcentaje en dinero.
4. **Solo comandos probados.** Todo comando que escribas en el archivo de instrucciones lo corriste aquí y viste su resultado. Lo que no pudiste correr va marcado "(sin probar)" o no va.
5. **Nunca contra producción.** Para medir el producto usas pruebas locales, un modo simulado o datos de ejemplo. Llamar a un modelo de pago para medir: di cuántas llamadas serían y pregunta antes.
6. **Solo apagas lo que prendiste** (guarda el PID; nunca mates procesos por nombre). **Nada destructivo** y **no instalas nada** sin preguntar.
7. **Sin secretos.** De cualquier clave muestra como máximo los primeros 4 caracteres. No copies datos de clientes al reporte.

| Pensamiento | Realidad |
|---|---|
| "Ya sé qué cambiar, lo aplico de una vez" | El usuario pidió saber qué cambiar. Muestra el cambio y su ahorro; él decide. |
| "El README dice que se corre así" | El README puede estar viejo. Córrelo. |
| "Pongo el mapa de carpetas para ayudar" | El agente puede ver las carpetas solo. Lo que no ve son las trampas. |
| "Quito el manual del prompt y listo" | Primero confirma qué tareas sí lo usan. Ahorrar rompiendo respuestas sale más caro. |
| "Los precios los recuerdo" | Cambian cada pocos meses. Fuente y fecha, o tokens. |

## Proceso

1. **Ubica el proyecto.** Lenguaje, cómo se instala, corre y prueba (scripts del proyecto, `Makefile`, `docker-compose.yml`, README). Qué archivos de instrucciones ya existen (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, `GEMINI.md`) y si el código llama a modelos de IA.
2. **Sigue la receta del modo** en su referencia. En diagnóstico general, haz una pasada corta de cada una y elige las 3 mejoras de mayor ahorro.
3. **Mide antes.** Memoria: corre cada comando y anota resultado y tiempo. Producto: cuenta llamadas y tokens por tarea con una corrida local o simulada; si no se puede correr, estima con el tamaño del texto (4 caracteres ≈ 1 token) y dilo. Costo: corre `scripts/uso.mjs`.
4. **Arma el borrador o la propuesta** con el ahorro de **cada** cambio por separado: así el usuario puede aceptar uno y rechazar otro.
5. **Entrega el reporte** y espera. Aplica solo lo aprobado, uno por uno. Después de cada cambio **mide otra vez** y confirma que el resultado sigue igual (mismas etiquetas, mismas pruebas en verde).

**Si un agente da vueltas** (tú incluido): mismo error 2 veces, editar y revertir lo mismo, la misma prueba sin cambiar nada → **para**. Escribe qué intentaste, qué pasó y qué crees que falta, cambia de estrategia o pide el dato. Señales y salidas en [referencias/tareas.md](referencias/tareas.md#detector-de-vueltas-inútiles).

## Reporte

El reporte tiene estas partes, en este orden:

**1. Resumen.** Dos o tres oraciones: dónde se va más el dinero o el tiempo y el ahorro total estimado (en tokens o llamadas; en dinero solo con precio con fuente).

**2. Mejoras propuestas**, de la que más ahorra a la que menos. Cada una con este formato exacto:

```markdown
### 💸 <qué se gasta de más, en palabras de negocio>
`<archivo>:<línea>` o `<archivo de instrucciones>`

- **Hoy:** <lo medido: llamadas, tokens, minutos o comandos que fallan>
- **Cambio:** <el cambio concreto, en una o dos líneas>
- **Ahorro:** <tokens/llamadas antes → después> · <dinero solo si hay precio: "≈ $X al mes, precio de <fuente> consultado <fecha>">
- **Riesgo:** <qué podría empeorar y cómo se comprueba que no>
- **Medido:** <comando o corrida que lo demuestra> | Estimado: <cómo se calculó>
```

En modo `memoria`, en lugar de mejoras, muestra el **borrador completo** del archivo y debajo una tabla `Comando | Lo corrí | Resultado`.
En modo `tarea`, muestra la **tarea lista para pegar** (plantilla en [referencias/tareas.md](referencias/tareas.md)).

**3. Sin medir.** Lo que sospechas pero no pudiste medir, con la razón.

**4. Bien hecho.** Hasta cinco cosas que ya ahorran (cache, límites, modelo barato donde va). Así el usuario sabe qué no tocar.

**5. Siguiente paso.** Una pregunta: *"¿Aplico el #1? Te muestro el cambio y mido otra vez después."*

Escribe para alguien que programa pero no es experto en IA: frases cortas, sin siglas sin explicar, el gasto en dinero o en horas.

## Errores comunes

- **Archivo de instrucciones largo.** Cada línea se paga en cada conversación. Si el código o el README ya lo dicen, no lo repitas: apunta al archivo.
- **Comandos de una sola terminal.** `PORT=4400 node app.js` no corre en PowerShell. Si el equipo usa varias, da la variante o usa el script del proyecto.
- **Sumar todos los ahorros en uno.** El usuario no puede elegir. Un ahorro por cambio.
- **Bajar de modelo sin comprobar.** Corre las mismas entradas con los dos modelos y compara las salidas antes de decir que "da igual".
- **Cachear lo que cambia.** Solo se cachea lo que sale igual para la misma entrada (textos fijos, clasificaciones del mismo texto). Las respuestas con datos del usuario llevan su clave.
- **Confundir cuota con dinero.** En un plan de cuota fija el ahorro se ve en límites de uso y tiempo, no en la factura.
