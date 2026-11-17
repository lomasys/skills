# Post mortem sin culpables

Sirve para que la falla no se repita, no para encontrar a quién culpar. La pregunta nunca es "¿quién?" sino
"¿qué permitió que pasara y qué no lo detectó antes?".

## Qué pedir y qué juntar

Pregunta lo que falte, en una sola lista:
- ¿Qué vieron los clientes y cuándo? ¿Cómo se enteraron ustedes (alerta, cliente, alguien del equipo)?
- ¿Qué se hizo y a qué hora? ¿Cuándo quedó resuelto?
- ¿Cuántos clientes o pedidos se afectaron? ¿Hubo dinero o datos de por medio?

Evidencia que puedes juntar tú, solo leyendo:
- logs que te den (pásalos por `scripts/errores.mjs`);
- `git log --since=<inicio> --until=<fin>` y despliegues de esas horas;
- el diff del cambio sospechoso y las pruebas que lo cubrían o no.

Marca con "(por confirmar)" lo que no tenga evidencia. No inventes horas ni números.

Si la evidencia contradice el relato (el error empezó días antes, el log no cubre la ventana, ningún despliegue explica el inicio),
escribe las dos cosas: el relato del usuario en la línea de tiempo y, aparte, una sección **"Lo que la evidencia no confirma"**.
No corrijas el relato por tu cuenta ni lo ignores.

Si el arreglo se hizo directo en producción y no está en el repositorio, la primera acción es llevarlo al repositorio con su prueba:
el siguiente despliegue lo borraría.

## Plantilla

Guarda en `postmortems/AAAA-MM-DD-<tema-corto>.md`:

```markdown
# <Qué falló, en una frase de negocio>

**Fecha:** AAAA-MM-DD · **Duración:** <inicio> a <fin> (<total>) · **Gravedad:** alta / media / baja · **Estado:** abierto / cerrado

## Resumen
Dos o tres oraciones: qué vieron los clientes, cuánto duró, causa en palabras simples, cómo se resolvió.

## Impacto
- Clientes afectados: <número o rango> (cómo se calculó)
- Pedidos, cobros o datos afectados: <…>
- Dinero: <ventas perdidas, reembolsos, cobros dobles> (por confirmar si no hay dato)
- Quién más se enteró: <soporte, redes, un cliente grande> (sin nombres de clientes)

## Línea de tiempo
Hora con zona horaria. Hechos, no opiniones.

| Hora | Qué pasó |
|---|---|
| 10:02 | Se despliega la versión 1.3.0 |
| 10:05 | Primer error en el registro |
| 10:41 | Un cliente escribe a soporte |
| 10:50 | El equipo confirma la falla |
| 11:10 | Se regresa a la 1.2.0 |
| 11:12 | Los errores se detienen |

## Causa raíz
Qué cambió y por qué produjo la falla. Usa "cinco porqués" hasta llegar a algo que se pueda arreglar en el proceso o en el sistema,
no en una persona. Ejemplo: "El carrito sin cupón trae el descuento vacío → el código asumía que siempre venía → no había prueba sin cupón →
la revisión no exigía pruebas para cambios en el cobro".

## Qué lo detectó
Cómo nos enteramos y cuánto tardamos (de que empezó a que lo supimos). Si fue un cliente, dilo: es la primera acción a corregir.

## Qué se hizo
Pasos para contener y resolver, en orden. Qué funcionó y qué no.

## Qué salió bien
Lo que ayudó (una alerta, un plan para regresar que funcionó, alguien que reconoció el patrón).

## Acciones para que no se repita

| Acción | Tipo | Responsable | Fecha |
|---|---|---|---|
| Prueba para carrito sin cupón | prevenir | <rol o persona> | AAAA-MM-DD |
| Alerta de tasa de errores en el pago | detectar | <…> | <…> |
| Plan escrito para regresar versiones | responder | <…> | <…> |

Cada acción: concreta, con responsable y fecha. "Tener más cuidado" no es una acción.
Tipos: **prevenir** (que no pase), **detectar** (enterarnos antes) y **responder** (arreglarlo más rápido).
```

## Reglas de escritura

- Sin culpables: "se desplegó con una prueba fallando", no "Juan desplegó con una prueba fallando".
- Sin secretos ni datos personales: claves tapadas, sin correos ni nombres de clientes.
- Si el post mortem se va a compartir con clientes, haz una versión aparte con [notas.md](notas.md): sin detalles internos.
- Si falta el responsable o la fecha de una acción, déjalo como `por definir` y dilo en tu resumen: el usuario los tiene que asignar.
