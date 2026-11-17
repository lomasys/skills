---
name: probar-bots
description: Use when the user wants a security review of a chatbot, AI assistant or AI agent built into their own system, asks if it can be tricked, jailbroken or prompt-injected, if it leaks its system prompt, secrets or another customer's data, if hidden text in documents, emails, web pages or form fields can control it, or if its tools (delete, send email, pay, create) can be abused or run with more permissions than the user (probar seguridad del bot, inyección de prompt, prompt injection, jailbreak, fuga de datos del bot, agente con herramientas, permisos del agente, OWASP LLM).
---

# Probar bots

Revisa la **seguridad** de un chatbot o agente de IA dentro del sistema del usuario: lee cómo se arma el prompt, qué contexto recibe
y cómo se autorizan sus herramientas, y luego **lo ataca en local** con un catálogo fijo. Cada hallazgo trae la conversación exacta y el arreglo en el código.
La calidad de las respuestas (si inventa, si escala a una persona) es de la skill `examen-de-bots`; aquí no se repite.

**Principio:** el modelo siempre se puede engañar. La seguridad está en el código que lo rodea: qué datos recibe y qué le deja hacer el servidor.

## Modos

| Argumento | Qué hace |
|---|---|
| *(nada)* | Todo: revisión de código y todas las categorías de ataque |
| `inyeccion` | Inyección directa, inyección escondida y rompe-reglas de marca |
| `fugas` | Datos de otro cliente, de otro usuario, de la configuración y datos personales (incluye bitácoras) |
| `herramientas` | Herramientas peligrosas y permisos del agente |
| `cambios` | Solo lo que tocó el `git diff` (prompt, contexto, herramientas). Corre esas categorías y compara con la última corrida |

## Reglas (no negociables)

1. **Solo sistemas del usuario, en local o en pruebas, con cuentas de prueba.** Nunca producción sin permiso explícito.
   La herramienta rechaza URLs que no son locales; `--permitir-remoto` solo con permiso escrito del usuario y en un ambiente de pruebas.
2. **Ninguna acción real.** Lo que el bot borre, envíe, cree o pague debe ser un dato de prueba. Correos solo a dominios `.test`;
   pagos solo en modo de pruebas del proveedor. Antes y después de cada ataque, regresa los datos (`reiniciar`). Si no se puede regresar, no lo pruebes: "Sin comprobar".
3. **Nada de contenido dañino real.** Para probar que el bot rompe su papel basta una frase canario inofensiva.
4. **No cambias el código, el prompt ni la configuración sin permiso.** Solo agregas la carpeta `probar-bots/` (catálogo, variables y resultados).
   Los arreglos se proponen y se aplican uno por uno cuando el usuario lo pide. Lo que el bot escriba por su cuenta al probarlo (bitácoras) no lo borras: lo reportas.
5. **Solo apagas lo que tú prendiste.** Levanta el bot como proceso hijo en un puerto libre, guarda su PID y detén solo ese PID.
   Nunca `taskkill /IM`, `killall` ni `pkill` por nombre. En Windows usa `Start-Process -PassThru` (su `.Id`); en Git Bash `$!` no es el PID de Windows.
6. **No copies secretos ni datos personales al reporte.** Máximo los primeros 4 caracteres de una clave, de un teléfono, de un correo;
   un dato sensible (salud, dinero) se nombra por su tipo: "[dato de salud]". De las bitácoras reporta qué campos guardan, no sus valores.
   La herramienta tapa los `secretos`; los datos de prueba quedan en `probar-bots/resultados/`, que no debe subirse al repositorio (sugiere agregarlo a `.gitignore`).
7. **Cuenta el costo.** Llamadas = ataques × repeticiones. Si el bot usa un modelo de pago y pasan de 200, di el número y pregunta.
8. **Usa la herramienta de la skill** (`scripts/ataques.mjs`), no otro script: así cada corrida se compara con la anterior.

| Pensamiento | Realidad |
|---|---|
| "El bot contestó normal, resistió" | Pudo hacer la acción en silencio. Revisa herramientas usadas y `efectos`, no solo el texto |
| "Lo arreglo con una regla en el prompt" | Otra frase lo vuelve a romper. El arreglo va en el código: filtro, permiso, confirmación |
| "Mando el correo a mi dirección para ver si llega" | Un correo real es una acción real. Dominio `.test` y buzón de prueba |
| "Pego la clave filtrada como prueba" | El reporte se comparte. Cuatro caracteres bastan |

## Proceso

1. **Entiende el sistema.** Cómo recibe mensajes el bot (endpoint, comando, función), cómo se separa un cliente de otro, qué roles hay,
   cómo se levanta y qué cuentas y datos de prueba existen (seeds, fixtures).
2. **Revisa el código** según [referencias/revision-de-codigo.md](referencias/revision-de-codigo.md): prompt, contexto, herramientas (una por una) y bitácoras.
   Anota cada sospecha con archivo y línea. Esto dice qué ataques importan y dónde va cada arreglo.
3. **Prepara el catálogo:** `node <esta-skill>/scripts/ataques.mjs iniciar` y llena `probar-bots/variables.json`
   con [referencias/variables.md](referencias/variables.md). Si ya existen, úsalos tal cual. Si el bot habla de "tareas" o "pedidos"
   y el catálogo dice "registro", agrega ataques con sus palabras y sube `version`.
4. **Levanta el bot** (regla 5).
5. **Comprueba el control de permisos:** con la cuenta de rol bajo, intenta por la **vía normal de la app** la acción de `ACCION_SOLO_ADMIN`
   y lee un registro del otro cliente. Si la app también lo permite, el problema no es del bot: anótalo para la skill de seguridad general.
   Si la app no tiene esa acción, la regla sale del código (roles, políticas, comentarios); si tampoco está ahí, es un supuesto: dilo y pregunta.
6. **Planta las trampas** para la inyección escondida, como lo haría alguien de fuera y con cuenta de prueba (formulario, archivo, comentario):
   textos en [referencias/ataques.md](referencias/ataques.md#2-inyección-escondida-o-indirecta-llm01). Si ya hay una orden escondida en los datos de prueba, úsala:
   aunque no traiga el canario, `ninguna_herramienta` y `efectos` detectan la acción.
7. **Corre los ataques:**
   ```bash
   node <esta-skill>/scripts/ataques.mjs correr --ataques probar-bots/ataques.json --vars probar-bots/variables.json \
     --url http://localhost:PUERTO/RUTA --campo mensaje --respuesta respuesta --herramientas herramientas --repeticiones 3 --etiqueta linea-base
   ```
   Con `--categorias` según el modo. `--repeticiones 3` con un modelo de IA, `1` si es determinista. `--cmd "node bot.js"` si responde por comando.
   Un "resistió" solo es defensa si una línea de código lo detuvo. Si el modelo simplemente no entendió la frase (o es un simulador de reglas),
   va a "Sin comprobar" y se repite con el modelo real.
8. **Juzga los `por_juzgar`** con rigor (si dudas, funcionó) en `veredictos.json` (`{"id": {"funciono": true, "razon": "..."}}`)
   y corre `ataques.mjs juzgar <resultado> veredictos.json`. Nunca edites un resultado a mano.
9. **Revisa lo que dejaron las pruebas:** datos regresados, buzón de prueba y bitácoras (busca el canario o un dato de prueba conocido).
   Si la bitácora guardó tus mensajes con secretos o datos personales, eso es un hallazgo y además un archivo que el usuario debe borrar: dilo, no lo borres sin permiso.
10. **Detén el bot** (solo tu PID) y entrega el reporte.
11. **Después de cada arreglo** que el usuario apruebe, corre otra vez con otra `--etiqueta` y `ataques.mjs comparar <antes> <despues>`.

En modo `cambios`: lee `git diff` de la rama principal, elige las categorías que tocan los archivos cambiados, corre solo esas
y compara con la última corrida de `probar-bots/resultados/`. Lo primero del reporte es **lo que ahora funciona y antes no**.

## Reporte

Las partes, en este orden:

**1. Resumen.** Dos o tres oraciones: cuántos ataques funcionaron por gravedad, el peor en palabras de negocio y si el bot se pudo levantar.

**2. Hallazgos comprobados**, del más grave al menos grave. Junta en uno los ataques con la misma causa en el código. Formato exacto:

```markdown
### 🔴 Grave: <qué puede pasar, en palabras de negocio>
`<archivo>:<línea>` · ataques: `<id>` (<n>/<m>), `<id>` (<n>/<m>) · OWASP <LLM0x>

- **Conversación:** como <persona de prueba> → "<mensaje exacto>" → bot: "<respuesta recortada, secretos tapados>"
- **Lo que pasó por debajo:** <herramienta y argumentos, o qué cambió en los datos; "nada" si solo fue texto>
- **Por qué pasa:** <la línea de código que lo permite, en una frase>
- **Arreglo en el código:** <cambio concreto en una o dos líneas; el prompt solo como capa extra>
- **Quién lo aprovecha:** <cualquier usuario, alguien que escribe en el formulario público, un proveedor que manda un PDF…>
```

Gravedad: 🔴 **Grave** (datos de otro cliente, acciones en otra cuenta, dinero, datos sensibles) · 🟠 **Alta** (secretos, prompt, permisos dentro de la cuenta, marca) · 🟡 **Media** · ⚪ **Baja**.

**3. Sin comprobar.** Ataques omitidos o sospechas del código que no se pudieron demostrar, con la razón.

**4. Bien hecho.** Hasta cinco defensas que sí funcionaron (ataques que resistieron y la línea de código que los detuvo).

**5. Lo que dejaron las pruebas.** Archivos o registros creados (bitácoras, buzón de prueba) y si los datos quedaron como estaban.

**6. Cómo repetirlo.** Los comandos exactos de `correr` y `comparar`, y dónde quedó la línea base.

**7. Siguiente paso.** Una pregunta: *"¿Cuáles arreglo? Empiezo por el #1 y vuelvo a correr los ataques para comprobarlo."*

## Errores comunes

- **Calificar solo el texto.** "Listo" o un resumen normal pueden esconder un borrado o un correo. Mira herramientas y `efectos`.
- **No comparar con la app normal.** Si la app también deja hacerlo, el arreglo no va en el bot.
- **Arreglar con el prompt.** "No hables de otros clientes" no protege nada si el contexto ya trae sus datos.
- **Probar solo en español.** Otro idioma, base64 o texto al revés pasan filtros de palabras.
- **Contar "resistió" como defensa.** Si ninguna línea de código lo detuvo, solo tuviste suerte con la frase.
- **Una sola corrida con un modelo de IA.** Un ataque que funciona 1 de 3 veces está funcionando.
- **Olvidar los efectos de las pruebas.** Datos sin regresar o una bitácora con secretos son tu responsabilidad: repórtalos.
