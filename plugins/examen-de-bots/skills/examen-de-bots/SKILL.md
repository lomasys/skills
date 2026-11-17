---
name: examen-de-bots
description: Use when the user wants to know how good a chatbot, AI assistant or support agent is, grade or score it, check if it invents answers (hallucinations), compare prompts or models, or verify a bot did not get worse after changing its prompt, model or knowledge base (examen, calificar bot, evaluar chatbot, evals, regresión).
---

# Examen de bots

Le hace al bot un examen con preguntas reales y respuestas correctas sacadas de la fuente de verdad del negocio.
Lo califica con un número y guarda el resultado para comparar después de cada cambio de prompt, modelo o información.

**Principio:** la respuesta correcta sale de la información real del negocio, nunca de lo que hoy contesta el bot.

## Modos

| Argumento | Qué hace |
|---|---|
| *(nada)* | Arma el examen (o usa el que ya existe en `examen-bot/`), lo corre y entrega el reporte |
| `comparar` | Corre el mismo examen y lo compara con la línea base. Lo primero que muestra es qué empeoró |
| `modelos` | Corre el mismo examen con varios modelos o prompts y los compara en calificación, velocidad y costo |

## Reglas (no negociables)

1. **Producción solo con permiso.** Examina el bot en local o en pruebas. Si solo existe en producción, pregunta antes y explica
   el riesgo: las preguntas de "quiero hablar con una persona" pueden abrir tickets reales o avisarle al equipo de soporte.
2. **Cuenta el costo antes.** Llamadas = casos × repeticiones. Si el bot usa un modelo de pago y pasan de 200 llamadas, di el número y pregunta.
3. **No cambias el bot sin permiso.** Ni su prompt, ni su código, ni su información. Propones los cambios.
4. **Solo apagas lo que tú prendiste.** Si levantas el bot, guarda su PID y detén solo ese proceso.
5. **Sin datos reales de personas.** Si sacas preguntas de conversaciones reales, cambia los nombres, correos y teléfonos.
6. **Usa la herramienta de la skill** (`scripts/examen.mjs`). No escribas otro script de examen: así cualquier corrida futura se puede comparar con esta.

## Proceso

1. **Entiende el bot.** Identifica:
   - cómo recibe un mensaje (endpoint HTTP, comando o función);
   - su prompt del sistema;
   - de dónde saca la información (documentos, base de datos, archivo de conocimiento, FAQ);
   - qué herramientas puede usar.
2. **Encuentra la fuente de verdad:** precios, políticas, funciones, horarios y lo que **no** existe.
   Si no hay una fuente clara, pídele al usuario los 5 datos que más le preguntan sus clientes.
3. **Arma `examen-bot/casos.json`** en el proyecto, siguiendo [referencias/casos.md](referencias/casos.md). Si ya existe, úsalo tal cual.
4. **Si el bot es un servidor, levántalo** (regla 4). Para un bot que solo vive dentro de la app, usa la ruta que usa la app.
5. **Corre el examen** con la herramienta. La ruta es relativa a esta skill:
   ```bash
   node <carpeta-de-esta-skill>/scripts/examen.mjs correr --casos examen-bot/casos.json --url http://localhost:PUERTO/RUTA --campo mensaje --respuesta respuesta --repeticiones 3 --etiqueta linea-base
   ```
   Usa `--cmd "node bot.js"` si el bot responde por comando. Usa `--repeticiones 3` con modelos de IA, porque responden distinto cada vez, y `1` si el bot es determinista.
6. **Juzga los casos `por_juzgar`.** Lee cada respuesta contra su `criterio` con rigor: si dudas, no aprueba.
   Escribe `veredictos.json` (`{"id": {"pasa": false, "razon": "..."}}`) y córrelo con `examen.mjs juzgar <resultado> veredictos.json`.
7. **Revisa las fallas automáticas.** Si una falla es culpa del patrón y no del bot (por ejemplo, contestó bien con otras palabras),
   corrige el caso, sube `version` en `casos.json` y **corre todo otra vez**. Nunca edites un resultado a mano.
8. **Detén el bot** si lo levantaste y entrega el reporte.

En modo `comparar`: corre con `--etiqueta` descriptiva (por ejemplo `prompt-v2`), juzga, y ejecuta
`examen.mjs comparar examen-bot/resultados/<linea-base>.json examen-bot/resultados/<nueva>.json`.

## Reporte

El reporte tiene estas partes, en este orden:

**1. Calificación.** `X/Y (Z%) · Críticos a/b` y un veredicto en una frase: ¿está listo para hablar con clientes?

**2. Por categoría.** Tabla con aprobados por categoría.

**3. Fallas críticas**, de la que más cuesta a la que menos. Cada una con este formato exacto:

```markdown
### ❌ <qué hace mal, en palabras de negocio>
- **Le preguntamos:** "<pregunta>"
- **Contestó:** "<respuesta literal, recortada>"
- **Debía decir:** <lo correcto> (fuente: `<archivo o documento>`)
- **Qué puede pasar:** <reclamo, venta perdida, promesa falsa, dato expuesto>
```

**4. Otras fallas.** Una línea por falla.

**5. Aprobados dudosos.** Casos que aprobaron con una respuesta comodín (`respuesta_generica`) o por muy poco.

**6. Cómo repetirlo.** Los comandos exactos de `correr` y `comparar`, y dónde quedó la línea base.

**7. Siguiente paso.** Una pregunta: *"¿Propongo cambios al prompt para las fallas críticas? Después corro el examen otra vez y comparamos."*

En modo `comparar`, el reporte empieza con **qué empeoró** (cada caso con su respuesta nueva), luego qué mejoró y al final la calificación antes y después.

## Errores comunes

- **Sacar la respuesta correcta del bot.** Así el examen aprueba los errores. Sale de la fuente de verdad.
- **Aprobar por patrones.** "No puedo pasarte con una persona" contiene "persona". Las conductas (escalar, tono, negarse) se juzgan con `criterio`.
- **Premiar al bot que no sabe nada.** Si contesta "no tengo esa información" a todo, aprueba lo que no debe inventar y nada más. La herramienta marca esas respuestas comodín.
- **Cambiar el examen entre corridas.** La comparación deja de valer. Si cambias casos, sube `version`.
- **Una sola corrida con un modelo de IA.** Un caso que aprueba 1 de 3 veces está fallando.
