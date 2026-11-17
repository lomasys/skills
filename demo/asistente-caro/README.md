# Asistente Caro

Asistente de tickets **que gasta de más a propósito** para ver trabajar la skill [eficiencia-ia](../../plugins/eficiencia-ia/skills/eficiencia-ia/SKILL.md).
Clasifica cada ticket, manda una bienvenida y hace un resumen para el equipo de soporte de *Tablerito*, un producto inventado.
Usa una IA **simulada** (`ia.js`): no necesita claves ni internet y cuenta los tokens como lo haría una API real.

## Correr

Necesitas Node 18 o más nuevo. No hay que instalar nada.

```bash
node tickets.js     # procesa los 12 tickets de tickets.json y muestra llamadas y tokens
```

Hoy gasta **36 llamadas y unos 291,000 tokens de entrada** para 12 tickets.

## Reto

Antes de correr la skill, intenta encontrar los gastos tú. Hay al menos **cinco**.
Después corre `/eficiencia-ia:eficiencia-ia producto` y compara.

<details>
<summary>Ver la lista (spoiler)</summary>

1. El manual completo del producto (unos 8,000 tokens) va en **todas** las llamadas, aunque ninguna tarea lo usa.
2. La bienvenida es siempre el mismo texto, pero se le pide a la IA en cada ticket.
3. Usa el modelo más caro para elegir una de cuatro etiquetas.
4. Ninguna llamada tiene límite de tokens de salida.
5. Reintenta para siempre si la IA falla, sin tiempo límite ni espera.

</details>
