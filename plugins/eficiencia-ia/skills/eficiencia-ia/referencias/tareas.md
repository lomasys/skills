# Tareas claras, contexto justo y el modelo adecuado

## Plantilla de tarea (lista para pegar)

Un pedido vago ("arregla el login", "mejora el carrito") hace que el agente lea medio repo y adivine qué es "terminado".
Conviértelo en esto. Si falta un dato que solo el usuario sabe, **pregúntalo antes**; no lo inventes.

```markdown
## Objetivo
<Qué debe pasar para el usuario final, en una frase. No "refactorizar X": "que el cliente vea su total con IVA".>

## Alcance
- Sí: <lo que entra>
- No: <lo que NO se toca, aunque se vea mejorable>

## Archivos
- Leer primero: `<ruta>` (por qué), `<ruta>`
- Probablemente cambia: `<ruta>`
- No tocar: `<ruta>` (generado, compartido, otra área)

## Terminado cuando
- [ ] <criterio observable 1>
- [ ] <criterio observable 2>
- [ ] Pruebas existentes en verde y una prueba nueva para <caso>

## Cómo se verifica
`<comando exacto>` → <qué debe salir>

## Si te atoras
Si el mismo error sale 2 veces o la prueba no cambia después de 2 intentos, para y reporta: qué intentaste, qué salió y qué dato falta.

## Modelo sugerido
<barato | medio | caro> porque <razón de la tabla de abajo>
```

## Contexto justo: qué archivos importan

Para encontrar los archivos sin cargar el repo entero:

1. **Busca por palabras del pedido** (nombre de la pantalla, la ruta, el mensaje de error) con búsqueda de texto: `rg -n "total con IVA"`, `git grep`.
2. **Sigue la llamada**, no la carpeta: ruta → controlador → servicio → modelo. Lee solo esas funciones.
3. **Mira la historia**: `git log --oneline -5 -- <ruta>` dice qué cambió hace poco y quién lo tocó junto.
4. **Busca la prueba vecina**: el archivo de prueba de ese módulo enseña cómo se usa y cómo se prueba.
5. **Deja fuera**: dependencias (`node_modules/`, `vendor/`), archivos generados, `dist/`, migraciones viejas, datos de ejemplo grandes, bitácoras.

Regla práctica: si la lista de "leer primero" pasa de 8 archivos, la tarea es muy grande. Pártela.

## IA barata primero

Precios y nombres de modelos cambian cada pocos meses: aquí van **criterios**, no marcas.
"Barato" = el modelo chico o gratis que tenga el usuario; "caro" = el más capaz.

| Barato o gratis alcanza | Pide uno caro |
|---|---|
| Buscar en el repo, listar archivos, resumir un archivo | Diseñar algo nuevo que toca varias capas |
| Cambios mecánicos: renombrar, mover, formatear, actualizar imports | Un error que nadie entiende después de 2 intentos |
| Escribir pruebas siguiendo una prueba vecina | Seguridad, dinero, permisos, datos de clientes |
| Documentación, mensajes de commit, traducciones | Migraciones de datos o cambios que no se pueden deshacer |
| Clasificar, extraer campos, revisar estilo | Revisar el plan antes de un cambio grande |
| Tareas con criterio de terminado claro y comando que lo verifica | Tareas donde "bien hecho" es una decisión de criterio |

Señales para **subir** de modelo: el barato falló 2 veces en lo mismo, la tarea no tiene cómo verificarse sola, o un error ahí cuesta dinero.
Señales para **bajar**: la tarea es repetitiva, hay un ejemplo vecino que copiar y una prueba que lo verifica.

## Detector de vueltas inútiles

| Señal | Qué está pasando |
|---|---|
| El **mismo error** (mismo mensaje, misma línea) sale 2 veces seguidas | Está probando variaciones sin entender la causa |
| **Edita y revierte** el mismo bloque, o alterna entre dos versiones | No tiene criterio para decidir |
| Corre **la misma prueba sin cambiar nada** entre corridas | Espera que "esta vez sí" |
| Lee **los mismos archivos** otra vez en la misma tarea | Perdió el hilo o el contexto se llenó |
| Agrega `try/catch`, `sleep`, `skip` o desactiva la prueba para "que pase" | Esconde el problema en lugar de arreglarlo |
| Más de 15 minutos o 3 intentos sin que cambie el resultado | Ya no está avanzando |

Qué hacer, en este orden:
1. **Parar.** No hay intento número 3 igual al 2.
2. **Escribir el estado** en 3 líneas: qué intentó, qué salió, qué cree que falta.
3. **Cambiar de estrategia:** leer el error completo y la pila, reproducir con el caso más chico, poner un `log` en el punto exacto, leer la documentación de la función que falla, revisar `git diff` para ver si el problema lo metió él.
4. **Pedir información** si lo que falta es un dato del usuario (credencial de pruebas, comportamiento esperado, versión).
5. **Empezar limpio**: si el contexto está lleno de intentos fallidos, una conversación nueva con el resumen de 3 líneas suele costar menos que seguir.
6. Si la trampa era del proyecto, **proponer** agregarla a "Trampas conocidas" del archivo de instrucciones.
