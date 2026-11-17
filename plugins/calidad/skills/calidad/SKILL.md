---
name: calidad
description: Use when the user is about to change, rename, delete or refactor a function, file, database column, endpoint or component and wants to know what could break (qué rompo, qué depende de esto, impacto, blast radius, es seguro cambiarlo); when fixing a bug and the fix should be proven with a failing test first (reproducir el error, bug, regresión); when the user distrusts the test suite (pruebas que no prueban nada, cobertura falsa, mocks, mutation testing); when tests are slow or fail at random (flaky, inestables, a veces pasan); when they want an end-to-end check of key user flows (punta a punta, e2e); or when they want to find unused code, routes or files to delete safely (código muerto, dead code, limpiar).
---

# Calidad

Antes de tocar algo te dice **qué rompes, con archivo y línea**. Reproduce cada bug con una prueba que falla,
encuentra las pruebas que pasan aunque el código esté mal y las que fallan al azar, y propone qué código borrar, con evidencia.

**Principio:** una dependencia, una prueba débil o un archivo muerto sin evidencia es una opinión. Demuéstralo
(búsqueda, corrida o mutación) y di con qué nivel de certeza lo sabes.

## Modos

Lee el argumento (`/calidad:calidad <modo>` o `/calidad <modo>`). Sin argumento, infiere el modo del pedido; si no se puede, pregunta cuál.

| Argumento | Qué hace |
|---|---|
| `impacto <cosa>` | Lista todo lo que depende de una función, archivo, columna, endpoint o componente, con archivo:línea, qué pruebas lo cubren y qué tan riesgoso es cambiarlo. **No cambia código** |
| `bug <descripción>` | Escribe una prueba que reproduce el error, confirma que falla, propone el arreglo y confirma que la prueba pasa |
| `pruebas` | Encuentra pruebas que no prueban nada y lo demuestra rompiendo el código a propósito en una copia |
| `inestables` | Corre las pruebas varias veces, encuentra las que fallan al azar o tardan, y su causa |
| `flujos` | Recorre los flujos clave como un usuario real con lo que ya tiene el proyecto (servidor local, navegador, CLI) |
| `muerto` | Encuentra código, rutas y archivos que nadie usa, con evidencia. Propone qué borrar; no borra |

Recetas por modo y por stack: [impacto](referencias/impacto.md) · [pruebas e inestables](referencias/pruebas.md) · [código muerto y flujos](referencias/muerto-y-flujos.md).

## Reglas (no negociables)

1. **Solo local.** Pruebas, servidores y flujos corren en tu máquina, Docker local o un ambiente de pruebas.
   Nunca contra producción ni contra una base de datos remota sin permiso explícito.
2. **No cambias código ni configuración sin permiso.** Puedes **agregar** pruebas nuevas (en `bug`) y archivos de reporte.
   Los arreglos los propones y los aplicas solo si el usuario los aprueba, uno por uno.
   En `impacto` no tocas nada: el usuario pidió saber qué rompe, no que lo cambies.
3. **Mutaciones solo en una copia, o revertidas al instante.** Prefiere una copia dentro de tu carpeta de trabajo.
   Si mutas el repo del usuario: un solo cambio, corres la prueba, lo regresas en el mismo paso y confirmas que
   `git diff -- <archivo>` sale **vacío**. Si el archivo ya tenía cambios sin commit, usa una copia; nunca `git checkout` ni `git stash` sobre su trabajo.
4. **Nunca borras código ni pruebas sin permiso.** `muerto` entrega una propuesta. Una prueba débil se mejora; no se borra.
5. **Solo apagas lo que tú prendiste.** Guarda el PID de cada servidor que levantes y detén ese PID. Nunca `taskkill /IM`, `killall` ni `pkill` por nombre.
6. **Nada destructivo.** Sin `rm -rf` sobre carpetas del usuario (borrar tus propias copias, por su ruta exacta, sí), sin borrar datos, sin `DROP`/`DELETE`/`TRUNCATE`, sin `git push --force`. Si una prueba cambió datos locales, regrésalos.
7. **No instalas nada sin preguntar** (paquetes, herramientas de cobertura, navegadores). Usa lo que el proyecto ya tiene.
8. **Sin secretos ni datos personales en el reporte.** Máximo los primeros 4 caracteres de una clave.
9. **No decides reglas de negocio.** Si el valor correcto es ambiguo ("¿el cupón es sobre todo el carrito o un artículo?"), pregunta antes de fijarlo en una prueba.
   Mientras tanto sí puedes probar lo que no depende de la regla (el orden no cambia el total, un carrito vacío no truena) y dar el valor que daría cada opción.

| Pensamiento | Realidad |
|---|---|
| "Ya busqué el nombre con grep, eso es todo" | Las llamadas por texto, alias, configuración, plantillas y otras apps no salen con un grep del nombre |
| "Ya que estoy, lo cambio" | El usuario pidió el impacto. Propón; no cambies |
| "Muto el archivo y luego lo regreso" | Si se te olvida, dejas un bug real. Copia, o revierte y verifica el `git diff` vacío |
| "Pasó 3 veces, es estable" | Una falla de 1 en 10 casi nunca sale en 3 corridas. Mínimo 20 |
| "Nadie lo importa, está muerto" | Puede cargarse por nombre, por configuración o desde otro repositorio |

## Proceso

1. **Entiende el proyecto.** Stack, cómo se corren las pruebas (y si pasan hoy), carpetas de código, rutas, trabajos en segundo plano,
   configuración, plantillas y documentos de quién consume la API (`docs/`, OpenAPI, README). Anota el estado de `git status` al empezar.
2. **Línea base.** Corre la suite completa una vez y guarda: cuántas pasan, cuánto tarda, cuáles fallan ya.
3. **Trabaja el modo** con su receta:
   - `impacto`: las 9 búsquedas de [referencias/impacto.md](referencias/impacto.md), sin saltarte ninguna. Confirma cada dependencia indirecta
     leyendo el código que la usa; si puedes, demuéstrala con una simulación en memoria o en una copia (regla 3).
   - `bug`: prueba que reproduce el error → córrela y confirma que **falla por la razón correcta** → propone el arreglo →
     con permiso, aplícalo → la prueba pasa → corre la suite completa. Antes del arreglo, corre `impacto` sobre lo que vas a tocar.
   - `pruebas`: lista sospechosas por patrón, luego **demuéstralo**: una mutación por sospecha y mira si alguna prueba se da cuenta.
   - `inestables`: corre con la herramienta de la skill, mínimo 20 veces por archivo sospechoso:
     `node <carpeta-de-esta-skill>/scripts/repetir.mjs --veces 20 -- <comando de pruebas>`. Busca la causa en el código, no solo el síntoma.
   - `flujos` y `muerto`: [referencias/muerto-y-flujos.md](referencias/muerto-y-flujos.md).
4. **Clasifica cada hallazgo por evidencia:** ✅ **Comprobado** (lo corriste o lo mutaste) · 🔎 **Encontrado en el código** (leíste la línea) ·
   ❔ **Sin comprobar** (fuera del repositorio, depende de producción, no se pudo correr).
5. **Deja todo como estaba.** Detén tus PID, borra tus copias, confirma con `git status` que solo quedan los archivos que agregaste a propósito.
6. **Entrega el reporte** y pregunta qué aplicar.

## Reporte

Partes, en este orden:

**1. Resumen.** Dos o tres oraciones: el veredicto (riesgo del cambio, si el bug quedó reproducido, cuántas pruebas no prueban nada…)
y lo más caro que puede pasar, en clientes, dinero o tiempo.

**2. Hallazgos.** Si el pedido cubre varios modos, una subsección por modo, en el orden del pedido.
En `muerto`, usa la tabla de niveles de [referencias/muerto-y-flujos.md](referencias/muerto-y-flujos.md). En `impacto`, empieza con esta tabla y después el riesgo:

```markdown
| # | Qué depende | Dónde | Cómo lo usa | Si cambias X… | Prueba que lo cubre | Evidencia |
|---|---|---|---|---|---|---|
| 1 | POST /api/total → app móvil | `src/rutas.js:6` | por nombre en texto (`accion: 'calcularTotal'`) | la app recibe un objeto donde espera número | ninguna | ✅ simulado |

**Riesgo: 🔴 Alto.** <por qué, en una o dos frases> · **Fallan en silencio:** #4, #6 · **Fuera del repo:** #4
**Cómo cambiarlo con menos riesgo:** <pasos concretos: envoltura compatible, versión nueva de la API, pruebas a agregar primero>
```

En los demás modos, un bloque por hallazgo, del más caro al menos caro:

```markdown
### 🔴 <qué pasa, en palabras de negocio>
`<archivo>:<línea>` · <Comprobado | Encontrado en el código | Sin comprobar>
- **Lo demostré:** <mutación, corrida o búsqueda> → <resultado>
- **Por qué pasa:** <la causa en una línea>
- **Propuesta:** <el cambio concreto> (no aplicado)
```

Riesgo y gravedad: 🔴 **Alto** (dinero, datos de clientes, algo de fuera se rompe, falla en silencio) · 🟠 **Medio** · 🟡 **Bajo**.

**3. Sin comprobar.** Lo que no pudiste demostrar y por qué (otro repositorio, producción, no levantó).

**4. Lo que dejé en el proyecto.** Archivos agregados (pruebas, reportes) y la confirmación de que lo demás quedó igual (`git status`).

**5. Siguiente paso.** Una pregunta concreta: *"¿Aplico la propuesta #1? Primero agrego la prueba que la protege."*

## Errores comunes

- **Buscar solo el nombre exacto.** Revisa alias, reexportaciones, llamadas por texto (`obj[nombre]`, `send`, `getattr`, `call_user_func`), configuración, plantillas, SQL a mano y otras apps.
- **Olvidar las pruebas que no lo cubren.** "Tiene pruebas" no basta: di qué caso cubren y cuál no.
- **Arreglar el bug sin ver la prueba fallar.** Si la prueba nunca falló, no demuestra que el arreglo sirve.
- **Llamar "inestable" a una prueba rota.** Si falla siempre, está rota. Inestable es pasar y fallar con el mismo código.
- **Esconder la inestabilidad con reintentos o esperas más largas.** Arregla la causa: hora fija, semilla, datos propios, sin red.
- **Declarar muerto lo que se carga por nombre.** Busca el nombre como texto en todo el repositorio, incluida la configuración.
- **Dejar una mutación puesta.** Revisa `git diff` vacío después de cada una.
