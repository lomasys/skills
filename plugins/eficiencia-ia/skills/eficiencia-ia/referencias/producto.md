# IA dentro del producto: dónde se va el dinero

## 1. Encuentra las llamadas

Busca en el código (no en `node_modules/`, `vendor/` ni `.venv/`):

| Stack | Busca |
|---|---|
| Node / TypeScript | `openai`, `@google/genai`, `ai` (Vercel AI SDK), `langchain`, el SDK de cada proveedor que use el proyecto (revisa `package.json`), `chat.completions.create`, `responses.create`, `messages.create`, `generateText`, `fetch(` a `/v1/chat` o `/v1/messages` |
| Python / Django | `import openai`, `google.genai`, `litellm`, `langchain`, el SDK de cada proveedor (revisa `requirements.txt` o `pyproject.toml`), `.chat.completions.create(`, `.messages.create(`, `requests.post(` a una API de modelos |
| Rails / Ruby | `ruby-openai`, `OpenAI::Client`, `langchainrb`, gemas de otros proveedores en el `Gemfile`, `Faraday`/`Net::HTTP` a una API de modelos |
| Laravel / PHP | `openai-php`, `OpenAI::chat()`, `Prism`, paquetes de otros proveedores en `composer.json`, `Http::post(` a una API de modelos |
| Cualquiera | Nombres de modelos en texto (`"gpt-`, `"gemini-`, `"llama`, `"mistral` y los del proveedor que use), variables `MODEL`, `LLM_`, `AI_`, `max_tokens`, `temperature` |

Para cada llamada anota: archivo y línea, **qué tarea hace** (clasificar, extraer, resumir, responder al cliente), modelo,
de dónde sale el prompt, si tiene límite de salida y tiempo límite, y **cuántas veces se llama por cada acción del usuario**.

## 2. Qué revisar

| Gasto | Cómo se ve | Arreglo típico |
|---|---|---|
| **Llamada repetida** | Mismo prompt fijo en cada petición (saludo, texto legal, descripción de producto); la misma entrada se clasifica otra vez | Texto fijo o cache con clave = hash de (modelo + prompt + entrada) y fecha de caducidad |
| **Prompt enorme** | Manual, catálogo o historial completo en cada llamada; el mismo prefijo largo en tareas que no lo usan | Mandar solo lo que la tarea usa (la sección relevante, búsqueda), o cache de prompt del proveedor para un prefijo fijo |
| **Modelo caro para algo simple** | Clasificar en pocas etiquetas, extraer campos, sí/no, detectar idioma, con el modelo más capaz | Modelo chico, o sin IA (reglas, expresión regular) si las etiquetas son obvias |
| **Sin límite de salida** | No hay `max_tokens` / `max_output_tokens` / `maxTokens` | Límite según la tarea: etiqueta ≈ 5–10, resumen ≈ 150–300 |
| **Sin tiempo límite ni tope de reintentos** | `while (true)`, reintento sin espera, sin `timeout` | Tiempo límite, 2–3 reintentos con espera creciente, y un error claro al final |
| **Una llamada por elemento** | Bucle que llama al modelo por cada fila | Juntar varios en una llamada o usar el modo por lotes del proveedor si acepta esperar |
| **Historial que crece** | El chat manda toda la conversación cada vez | Resumir lo viejo o cortar a los últimos N mensajes |
| **Respuesta larga que nadie lee** | Se pide "explica tu razonamiento" y solo se usa una etiqueta | Pedir solo el campo que se usa; salida estructurada |

## 3. Mide antes de proponer

1. **Busca un modo sin costo**: cliente simulado, pruebas con respuestas grabadas, variable de entorno de modo prueba. Si existe, córrelo y cuenta llamadas y tokens.
2. **Si no hay**, estima sin llamar al modelo: tokens ≈ caracteres / 4 del prompt armado (sistema + usuario). No uses servicios externos para contar tokens: mandarían el prompt fuera de la máquina.
3. **Llamar al modelo real** solo con permiso, con pocas entradas de ejemplo y diciendo antes cuántas llamadas serán.
4. Mide **por tarea y por acción del usuario** (por ticket, por mensaje, por página), no solo el total. Así se puede multiplicar por el volumen real.

## 4. Calcula el ahorro de cada cambio por separado

Para cada cambio: `llamadas antes → después` y `tokens de entrada / salida antes → después`, **por acción del usuario**.
Después multiplica por el volumen que diga el usuario (tickets al mes, mensajes al día). Si no lo sabe, deja la fórmula.

Dinero solo con precio confirmado:

```
costo = (tokens_entrada × precio_entrada + tokens_salida × precio_salida) / 1 000 000
```

- El precio sale de la **página oficial de precios del proveedor** o de la factura/panel del usuario. Anota la URL y la fecha de consulta.
- Si el modelo ya no aparece en la página o no puedes consultarla: **no lo estimes de memoria**. Da tokens, llamadas y la fórmula.
- No inventes proporciones entre precios (entrada vs salida, modelo grande vs chico).
- Si el producto usa cache del proveedor, los tokens leídos de cache tienen otro precio: búscalo en la misma página.

## 5. Antes de recomendar, cuida la calidad

Un ahorro que cambia el resultado no es ahorro. Para cada cambio di cómo se comprueba que sigue igual:

- **Bajar de modelo**: corre las mismas 10–20 entradas reales (sin datos personales) con los dos modelos y compara. Si hay un examen del bot, úsalo.
- **Recortar el prompt**: confirma qué tareas usan esa información. Si una la usa (por ejemplo, responder preguntas del producto), no se quita: se manda solo la parte relevante.
- **Límite de salida**: revisa que ninguna respuesta normal quede cortada.
- **Cache**: confirma que la respuesta no depende del usuario, la hora o datos que cambian.

## 6. Cómo proponer el cambio

Muestra el diff de **un** cambio, su ahorro y su riesgo. Aplica solo si el usuario dice que sí, corre otra vez la medición
y las pruebas, y compara. Luego el siguiente.
