# Mockup vs app (demo)

Pantalla de práctica **con diferencias a propósito** para ver trabajar la skill [mockup-vs-app](../../plugins/mockup-vs-app/skills/mockup-vs-app/SKILL.md).
Es la pantalla "Crear cuenta" de un producto inventado, *Tablerito*.

- `mockup.html`: el diseño aprobado (claro y oscuro).
- `pagina.html` + `estilos.css`: lo que se programó.

## Correr

Necesitas Node 18 o más nuevo y Chrome o Edge. No hay que instalar nada.

```bash
node server.js     # pantalla real en http://127.0.0.1:4500/registro
```

Después, dentro de tu agente, escribe `/mockup-vs-app:mockup-vs-app` (o *"compara mockup.html con la pantalla de registro"*).

## Reto

Antes de correr la skill, abre las dos y busca las diferencias a ojo. Hay **siete**, y dos solo se ven en celular o en modo oscuro.

<details>
<summary>Ver la lista (spoiler)</summary>

1. El botón es de otro azul (`#3b82f6` en lugar de `#2563eb`); también el logo y el enlace, porque es la misma variable.
2. El botón mide 40 px de alto; el mockup, 48 px.
3. La tarjeta tiene 24 px de relleno; el mockup, 32 px.
4. El título mide 24 px; el mockup, 28 px.
5. El botón dice "Registrarse"; el mockup, "Crear cuenta gratis".
6. En celular desaparece "¿Ya tienes cuenta? Inicia sesión".
7. En modo oscuro el texto gris no se aclara (`#6b7280` en lugar de `#9ca3af`).

</details>
