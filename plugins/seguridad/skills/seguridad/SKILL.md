---
name: seguridad
description: Use when the user asks to review, audit or harden the security of a codebase or web app (revisar seguridad, auditoría, hoyos, vulnerabilidades, pentest), asks whether one customer or tenant can see another's data, prepares for SOC 2, ISO 27001 or ISO 27701, or wants a security check of pending changes before pushing.
---

# Seguridad

Encuentra hoyos de seguridad, **los comprueba contra la app corriendo en la máquina del usuario** y deja una prueba
automática por cada uno. El usuario recibe pocos hallazgos, todos demostrados, explicados en español simple.

**Principio:** un hallazgo sin comprobar es una opinión. Comprueba lo que puedas y marca con claridad lo que no.

## Modos

Lee el argumento que escribió el usuario (`/seguridad:seguridad <modo>` o `/seguridad <modo>`):

| Argumento | Alcance |
|---|---|
| *(nada)* | Todo el proyecto |
| `cambios` | Solo lo que cambió: `git diff` contra la rama principal, más los archivos sin commit |
| `cuentas`, `permisos`, `enlaces`, `secretos`, `entradas`, `login`, `webhooks`, `dependencias`, `configuracion` | Solo ese tema (recetas en [referencias/ataques.md](referencias/ataques.md)) |
| `auditoria` | Revisión completa más el reporte de controles de [referencias/controles.md](referencias/controles.md) |

## Reglas de seguridad (no negociables)

1. **Solo local.** Las peticiones de ataque van únicamente a `localhost`, `127.0.0.1` o un contenedor local que tú levantaste.
   Si la configuración apunta a una URL remota (staging, producción, una API externa), no la toques: reporta el hallazgo como "Sin comprobar".
2. **No cambias el código del usuario sin su permiso.** Tú agregas pruebas; los arreglos los propones.
   Solo los aplicas cuando el usuario lo pide, y uno por uno.
3. **Solo apagas lo que tú prendiste.** Levanta la app como proceso hijo, en un puerto libre, y guarda su PID.
   Al terminar, detén **ese PID** y nada más. Nunca uses `taskkill /IM`, `killall`, `pkill node` ni nada que mate procesos por nombre.
4. **Nada destructivo.** Sin `DROP`, `DELETE` ni `UPDATE` masivos, sin borrar registros que no creaste y sin miles de peticiones.
   Si una comprobación cambió datos, regrésalos como estaban.
5. **No copies secretos.** En el reporte muestra solo los primeros 4 caracteres de cualquier clave.

| Pensamiento | Realidad |
|---|---|
| "Es más rápido arreglarlo de una vez" | El usuario pidió una revisión, no una reescritura. Propón el arreglo. |
| "Mato los procesos de node y listo" | Hay otras apps del usuario corriendo. Detén solo tu PID. |
| "Es solo una petición al servidor de staging" | Staging tiene datos y usuarios reales. Solo local. |
| "Seguro es vulnerable, no hace falta comprobarlo" | Entonces es "Sin comprobar", no "Comprobado". |

## Proceso

1. **Entiende el sistema.** Identifica:
   - qué separa a un cliente de otro (cuenta, empresa, organización, workspace, tenant);
   - los roles que existen;
   - cómo se levanta la app (scripts del proyecto, `docker-compose.yml`, README);
   - cómo se escriben las pruebas del proyecto (framework, carpeta, ayudas para iniciar sesión).
2. **Lee las excepciones aceptadas** en `.seguridad/aceptados.md`, si el archivo existe. No vuelvas a reportar esos puntos.
3. **Busca en el código** según el modo, siguiendo [referencias/ataques.md](referencias/ataques.md). Anota cada sospecha con archivo y línea.
4. **Levanta la app** (regla 3) y prepara dos cuentas, A y B, con roles admin y miembro.
   Si no levanta en dos intentos, sigue sin ella y marca todo como "Sin comprobar".
5. **Comprueba cada sospecha** con la receta de su tipo. Guarda la petición exacta y lo que respondió la app.
   Si la app se defendió, descarta el hallazgo.
6. **Escribe una prueba por hallazgo comprobado**, con el estilo y el framework del proyecto, en una carpeta o archivo marcado como seguridad
   (por ejemplo `test/seguridad/`). Córrela y confirma que **falla hoy**: así queda demostrado el hoyo.
7. **Detén la app** (solo tu PID) y entrega el reporte.
8. **Pregunta** qué hallazgos quiere que arregles. Cuando arregles uno, corre su prueba y confirma que ahora pasa.

## Reporte

El reporte tiene estas partes, en este orden:

**1. Resumen.** Dos o tres oraciones: cuántos hallazgos comprobados por gravedad, el peor en palabras simples y si la app se pudo levantar.

**2. Hallazgos comprobados**, del más grave al menos grave. Cada uno con este formato exacto:

```markdown
### 🔴 Grave: <qué puede pasar, en palabras de negocio>
`<método y ruta o función>` · `<archivo>:<línea>`

- **Lo comprobé:** <quién hizo qué petición> → <qué respondió la app>
- **Quién lo aprovecha:** <qué tipo de persona y con qué facilidad>
- **Arreglo:** <el cambio concreto, en una o dos líneas>
- **Prueba agregada:** `<ruta de la prueba>`: falla hoy y pasa con el arreglo
- **Controles:** ISO 27001 <x.y> · SOC 2 <CCx.y>
```

Gravedad: 🔴 **Grave** (datos de otro cliente, dinero, tomar cuentas) · 🟠 **Alta** · 🟡 **Media** · ⚪ **Baja**.

**3. Sin comprobar.** Sospechas que no pudiste demostrar, con la razón (la app no levantó, depende de producción, hace falta un servicio externo).

**4. Bien hecho.** Hasta cinco defensas que sí funcionan y que comprobaste. Así el usuario sabe qué no tocar.

**5. Siguiente paso.** Una pregunta: *"¿Cuáles arreglo? Puedo empezar por el #1."*

Escribe para alguien que programa pero no es experto en seguridad: frases cortas, sin siglas sin explicar,
el riesgo en términos de clientes y dinero. El detalle técnico va en la prueba, no en el texto.

En modo `auditoria`, agrega al final el reporte de controles de [referencias/controles.md](referencias/controles.md).

## Excepciones aceptadas

Si el usuario dice que un hallazgo está bien así, agrégalo a `.seguridad/aceptados.md`
(créalo si no existe) con la fecha, la ruta y el motivo que dio. En las revisiones siguientes, menciónalo solo en una línea al final.

## Errores comunes

- **Revisar solo GET.** El mismo hoyo suele estar en PATCH, DELETE, en las exportaciones y en los trabajos en segundo plano.
- **Confiar en el front.** Que un botón esté escondido no protege la acción en el servidor.
- **Reportar dependencias sin filtrar.** Primero busca si el código usa la parte vulnerable.
- **Pruebas que pasan hoy.** Una prueba de seguridad que no falla antes del arreglo no demuestra nada.
- **Decir "cumples SOC 2 / ISO".** Solo un auditor puede certificar. Tú das evidencia técnica.
