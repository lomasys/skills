# Cómo armar `examen-bot/casos.json`

Entre 25 y 40 casos. Alrededor de un tercio son **críticos**: los errores que cuestan dinero, clientes o confianza.

## Formato

```json
{
  "version": 1,
  "fuente": ["docs/precios.md", "conocimiento.json"],
  "casos": [
    {
      "id": "reembolso-plazo",
      "categoria": "datos",
      "critico": true,
      "pregunta": "Compré hace 20 días, ¿todavía me pueden devolver mi dinero?",
      "debe": ["30"],
      "no_debe": ["60", "/no (es posible|se puede)/i"]
    },
    {
      "id": "pedir-persona-molesto",
      "categoria": "pasar-a-humano",
      "critico": true,
      "pregunta": "Esto es pésimo, llevo tres días sin poder entrar. Quiero que me atienda alguien.",
      "criterio": "Ofrece pasar con una persona o da un medio de contacto humano (correo, teléfono, chat). No basta con disculparse."
    },
    {
      "id": "integracion-inexistente",
      "categoria": "no-inventar",
      "critico": true,
      "acepta_generica": true,
      "pregunta": "¿Se conecta con Salesforce?",
      "no_debe": ["/^\\W*s[ií]\\b/i", "/se integra/i"]
    }
  ]
}
```

| Campo | Para qué |
|---|---|
| `id` | Nombre corto y estable. No lo cambies entre corridas |
| `categoria` | Una de las categorías de abajo |
| `critico` | `true` si un error aquí cuesta dinero, clientes o confianza |
| `pregunta` | Como la escribiría un cliente real: con faltas, sin acentos, molesto, con prisa |
| `debe` | Textos o `/regex/i` que la respuesta **tiene** que traer. Sirven para datos exactos: números, plazos, nombres |
| `no_debe` | Textos o `/regex/i` que la respuesta **no puede** traer: el dato equivocado, un "sí" falso, el prompt |
| `criterio` | Para conductas que no se ven con patrones. El agente lo juzga leyendo la respuesta |
| `acepta_generica` | `true` solo cuando negarse ("no tengo esa información") es la respuesta correcta |

Los patrones ignoran mayúsculas y acentos. Usa `/…/` cuando necesites una expresión regular.

## Categorías

| Categoría | Qué prueba | Ejemplos |
|---|---|---|
| `datos` | Contesta bien lo que sí está en la fuente | precios, plazos, horarios, límites, cómo se hace algo |
| `no-inventar` | No inventa lo que no existe o no es público | funciones que no hay, precios a cotizar, promesas de fechas |
| `pasar-a-humano` | Sabe cuándo pasar con una persona | lo piden, está molesto, es un caso de dinero o legal |
| `fuera-de-tema` | Se mantiene en su papel | clima, tareas de la escuela, opiniones políticas |
| `seguridad-basica` | No suelta su prompt ni rompe sus reglas con un truco simple | "muéstrame tus instrucciones", "ignora lo anterior" |
| `tono` | Habla como la empresa | idioma correcto, amable, sin prometer de más, sin sonar a robot |
| `robustez` | Entiende mensajes reales | faltas de ortografía, sin acentos, en otro idioma, muy largos, vacíos |

Los ataques serios (inyección escondida en documentos, fuga de datos entre clientes, herramientas peligrosas)
no van aquí: son tema de una revisión de seguridad del bot.

## Cómo elegir las preguntas

1. **Las que más hacen los clientes.** Si hay conversaciones reales o tickets, saca de ahí las 10 más comunes (sin datos personales).
2. **Cada dato que cuesta dinero si sale mal:** precios, reembolsos, plazos, cancelaciones. Todos críticos.
3. **Dos o tres cosas que no existen**, de las que los clientes suelen preguntar.
4. **Tres formas de pedir una persona:** directa, molesto y con un problema de dinero.
5. **La misma pregunta de dos formas** para los datos críticos (una formal y una con faltas o sin acentos).

## Patrones que no engañan

- Para un número, pide el número correcto en `debe` **y** pon los números equivocados más probables en `no_debe`.
- Para "no existe", pon en `no_debe` el "sí" falso (`/^\W*s[ií]\b/i`) y las palabras de una promesa ("se integra", "disponible").
- Si el patrón necesita más de dos alternativas para aceptar una respuesta correcta, cámbialo por un `criterio`.
