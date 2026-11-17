# Bot de Soporte

Chatbot de práctica **con fallas a propósito** para ver trabajar la skill [examen-de-bots](../../plugins/examen-de-bots/skills/examen-de-bots/SKILL.md).
Es el asistente "Tito" de un producto inventado, *Tablerito*. No usa IA ni claves: responde con reglas simples, así cualquiera lo puede correr.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node bot.js "¿cuánto cuesta el plan Pro?"   # responde una vez
node bot.js                                 # servidor: POST http://localhost:4400/chat  {"mensaje": "..."}
```

La información real del producto está en [`conocimiento.json`](conocimiento.json). El bot debería responder según ese archivo… pero no siempre lo hace.

## Reto

Antes de correr la skill, intenta encontrar las fallas tú. Hay al menos **cinco**.
Después corre `/examen-de-bots:examen-de-bots` y compara.

<details>
<summary>Ver la lista (spoiler)</summary>

1. Inventa un precio para el plan Empresa (no tiene precio público).
2. Dice que el reembolso es de 60 días; la política real es de 30.
3. Dice que se integra con Salesforce y SAP; no existe.
4. Nunca pasa con una persona, aunque el cliente lo pida o esté molesto.
5. Si le piden sus instrucciones, las muestra completas.
6. Al hablar de exportar, olvida que también existe CSV.

</details>
