# Costo por función: cuánto gastó la IA en lo que entregaste

## 1. Define qué es "la función"

Lo más fácil de medir es una **rama** o un **periodo** en una **carpeta**:

```bash
git log --format=%cI main..<rama> | tail -1   # primer commit de la rama
git log --format=%cI -1 <rama>                # último commit
```

Si la función se hizo en `main` sin rama, pídele al usuario las fechas de inicio y fin.

## 2. Suma lo que dicen las bitácoras locales

La herramienta de la skill lee las bitácoras que Claude Code y Codex guardan en la máquina y **solo suma números**
(tokens, modelo, fecha, carpeta, rama). No imprime el texto de las conversaciones ni lo manda a ningún lado.
Antes de correrla, dile al usuario qué carpetas va a leer (`~/.claude/projects`, `~/.codex/sessions`).

```bash
node <carpeta-de-esta-skill>/scripts/uso.mjs --carpeta <nombre-del-repo> --desde 2026-11-03 --hasta 2026-11-07
node <carpeta-de-esta-skill>/scripts/uso.mjs --carpeta <nombre-del-repo> --rama feature/carrito
node <carpeta-de-esta-skill>/scripts/uso.mjs --carpeta <nombre-del-repo> --desde 2026-11-03 --precios precios.json
```

- `--rama` solo funciona si la herramienta guardó la rama; si sale vacío, usa fechas.
- Las columnas son **entrada nueva**, **cache leído**, **cache escrito** y **salida**. Se pueden sumar sin contar dos veces.
- Con bitácoras grandes tarda: usa siempre `--desde` para que salte los archivos viejos.
- Con `--json` sale en un formato fácil de guardar para comparar después.

### `precios.json`

Solo con precios que consultaste hoy en la página oficial del proveedor. La herramienta **rechaza** un precio sin `fecha` y `fuente`.
Precios en dólares por millón de tokens:

```json
{
  "<nombre exacto del modelo como sale en la tabla>": {
    "entrada": 0, "salida": 0, "cache_lectura": 0, "cache_escritura": 0,
    "fecha": "2026-11-16", "fuente": "https://<página oficial de precios>"
  }
}
```

Si falta el precio de cache, la herramienta lo cobra como entrada normal y lo avisa: el estimado queda por arriba, nunca por abajo.

## 3. Lo que la herramienta no ve

| Herramienta | Dónde ver el uso |
|---|---|
| Cursor | Panel de uso de la cuenta en su sitio (por solicitud o por tokens, según el plan) |
| GitHub Copilot | Configuración de la cuenta o de la organización en GitHub: solicitudes "premium" usadas |
| Gemini CLI | Comando de estadísticas de la sesión dentro de la herramienta |
| Claude Code / Codex | Además de las bitácoras, sus comandos de uso dentro de la sesión |
| API directa | Panel de uso y facturación del proveedor, filtrando por clave o proyecto |

Los nombres de menús cambian; si no encuentras el dato, busca en la documentación oficial de la herramienta.
Pídele al usuario que te pase el número: **no le pidas su contraseña ni que te comparta sesión**.

## 4. Si no hay nada que medir todavía

Propón empezar así (lo aplica el usuario o tú con su permiso):

1. **Una rama por función.** Así el costo se separa solo por rama y fechas.
2. **Una clave de API por proyecto o por equipo** en el panel del proveedor, para separar la factura.
3. **Anotar al cerrar la función**: rama, fechas, tokens o costo, y horas que tomó. Una tabla en `docs/costos-ia.md` alcanza.
4. **Revisar una vez al mes** cuáles funciones costaron más y si fue por vueltas inútiles (ver [tareas.md](tareas.md#detector-de-vueltas-inútiles)).

## 5. Cómo reportarlo

```markdown
### 💸 <función> costó <X tokens | ≈ $Y estimado>
Rama `<rama>` · <fecha inicio> → <fecha fin> · carpeta `<repo>`

- **Por herramienta y modelo:** <tabla de uso.mjs>
- **Precio:** <fuente> consultado <fecha> | sin precio: reporte en tokens
- **Lo que no se ve:** <Cursor / Copilot / otros sin datos>
- **Dónde se fue:** <si una sesión o un día concentra la mayor parte, dilo: suele ser una vuelta inútil>
```

En planes de cuota fija (suscripción mensual), el costo real es el **tiempo y los límites de uso**, no la factura. Repórtalo en tokens y en qué porcentaje de la cuota se fue.
