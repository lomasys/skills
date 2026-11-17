<div align="center">

<img src="assets/banner.png" alt="lomasys Skills: skills que comprueban en lugar de adivinar" width="100%">

<br>

[![Licencia](https://img.shields.io/badge/licencia-Apache%202.0-2781F6?style=for-the-badge)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-13-22C55E?style=for-the-badge)](#-índice-de-skills)
[![Agent Skills](https://img.shields.io/badge/Claude%20Code%20·%20Codex%20·%20Cursor%20·%20Copilot-compatible-FFB020?style=for-the-badge)](#-instalación)
[![Idioma](https://img.shields.io/badge/idioma-español-A78BFA?style=for-the-badge)](#)

**Skills para desarrolladores que entregan software en serio.**
No te dan una lista de "posibles problemas": **lo comprueban en tu app, te lo demuestran y dejan una prueba para que no regrese.**

[Instalar](#-instalación) · [Las 13 skills](#-índice-de-skills) · [Pruébalas en 2 minutos](#-pruébalas-en-2-minutos) · [Preguntas](#-preguntas-frecuentes)

</div>

---

## ⚡ Instalación

Cada skill se instala **por separado**: instalas solo las que quieres. Necesitas tener [Claude Code](https://code.claude.com) instalado.

### Opción A: desde tu terminal (la más fácil)

Abre **PowerShell, CMD o tu terminal** (no dentro de Claude) y copia esto. La primera línea agrega el catálogo (solo se hace una vez) y la segunda instala la skill:

```bash
claude plugin marketplace add lomasys/skills
claude plugin install seguridad@lomasys-skills
```

¿Quieres **las 13 de una vez**?

<details>
<summary>PowerShell (Windows)</summary>

```powershell
claude plugin marketplace add lomasys/skills
"seguridad","permisos","probar-bots","examen-de-bots","calidad","rendimiento","migraciones","base-miles-de-clientes","escalar","produccion","pantallas","mockup-vs-app","eficiencia-ia" | ForEach-Object { claude plugin install "$_@lomasys-skills" }
```
</details>

<details>
<summary>bash / zsh (Mac, Linux, Git Bash)</summary>

```bash
claude plugin marketplace add lomasys/skills
for s in seguridad permisos probar-bots examen-de-bots calidad rendimiento migraciones base-miles-de-clientes escalar produccion pantallas mockup-vs-app eficiencia-ia; do claude plugin install "$s@lomasys-skills"; done
```
</details>

Después abre Claude Code (o una conversación nueva en tu editor) y ya las puedes usar.

### Opción B: dentro de Claude Code

Abre Claude Code en la terminal (escribe `claude`) y escribe **un comando por mensaje**, esperando a que termine cada uno:

```text
/plugin marketplace add lomasys/skills
```
```text
/plugin install seguridad@lomasys-skills
```
```text
/reload-plugins
```

> [!IMPORTANT]
> Los comandos que empiezan con `/` solo funcionan **dentro de Claude Code en la terminal**. Si los escribes en PowerShell o en el chat de la extensión de tu editor, marcan error: usa la opción A.

### Si algo sale mal

| Ves esto | Qué pasó | Qué hacer |
|---|---|---|
| `'/plugin' no se reconoce como nombre de un cmdlet…` | Lo escribiste en PowerShell | Usa `claude plugin …` (sin la `/`), como en la opción A |
| `/plugin isn't available in this environment` | Lo escribiste en el chat de la extensión del editor | Usa la opción A en una terminal |
| `Marketplace "lomasys-skills" not found` | Te saltaste el primer paso | Corre primero `claude plugin marketplace add lomasys/skills` |
| `… is not a valid GitHub owner/repo` | Pegaste dos comandos en una sola línea | Uno por línea; en el cuadro "Enter marketplace source" escribe solo `lomasys/skills` |
| Instalada pero no aparece | Claude Code ya estaba abierto | `/reload-plugins` o abre una conversación nueva |

### Las 13 skills

| Skill | Instalar | Usar |
|---|---|---|
| 🛡️ Seguridad | `/plugin install seguridad@lomasys-skills` | `/seguridad:seguridad` |
| 🔐 Permisos | `/plugin install permisos@lomasys-skills` | `/permisos:permisos` |
| 🕵️ Probar bots | `/plugin install probar-bots@lomasys-skills` | `/probar-bots:probar-bots` |
| 🤖 Examen de bots | `/plugin install examen-de-bots@lomasys-skills` | `/examen-de-bots:examen-de-bots` |
| 🧪 Calidad | `/plugin install calidad@lomasys-skills` | `/calidad:calidad` |
| ⚡ Rendimiento | `/plugin install rendimiento@lomasys-skills` | `/rendimiento:rendimiento` |
| 🧱 Migraciones | `/plugin install migraciones@lomasys-skills` | `/migraciones:migraciones` |
| 🗄️ Base para miles de clientes | `/plugin install base-miles-de-clientes@lomasys-skills` | `/base-miles-de-clientes:base-miles-de-clientes` |
| 📈 Escalar | `/plugin install escalar@lomasys-skills` | `/escalar:escalar` |
| 🚀 Producción | `/plugin install produccion@lomasys-skills` | `/produccion:produccion` |
| ♿ Pantallas | `/plugin install pantallas@lomasys-skills` | `/pantallas:pantallas` |
| 🎨 Mockup vs app | `/plugin install mockup-vs-app@lomasys-skills` | `/mockup-vs-app:mockup-vs-app` |
| 💸 Eficiencia IA | `/plugin install eficiencia-ia@lomasys-skills` | `/eficiencia-ia:eficiencia-ia` |

También puedes pedirlo con tus palabras: *"revisa la seguridad de este proyecto"*, *"documenta quién puede hacer qué"*, *"ataca mi chatbot a ver si suelta datos"*, *"hazle un examen a mi chatbot"*…

En la terminal, cambia `/plugin install` por `claude plugin install`.

> [!TIP]
> **Actualizar** a la última versión: `claude plugin marketplace update lomasys-skills`.

### Otras herramientas (Codex, Cursor, Copilot, Gemini…)

Un comando por skill. Detecta qué herramientas tienes y te pregunta dónde instalarla:

```bash
npx skills add lomasys/skills --skill <nombre>      # por ejemplo: --skill seguridad
```

Nombres: `seguridad` · `permisos` · `probar-bots` · `examen-de-bots` · `calidad` · `rendimiento` · `migraciones` · `base-miles-de-clientes` · `escalar` · `produccion` · `pantallas` · `mockup-vs-app` · `eficiencia-ia`

### A mano

```bash
git clone https://github.com/lomasys/skills.git
```

Copia la carpeta de la skill (por ejemplo `plugins/seguridad/skills/seguridad`) a la carpeta de skills de tu herramienta:

| Herramienta | Para ti (todos tus proyectos) | Solo para un proyecto (y tu equipo) |
|---|---|---|
| Claude Code | `~/.claude/skills/<skill>/` | `.claude/skills/<skill>/` |
| Codex, Copilot CLI, Gemini CLI | `~/.agents/skills/<skill>/` | `.agents/skills/<skill>/` |

---

## 📋 Índice de skills

| | Skill | Qué resuelve | Estado |
|---|---|---|---|
| 🛡️ | [**Seguridad**](plugins/seguridad/skills/seguridad/SKILL.md) | Encuentra hoyos de seguridad, **los comprueba atacando tu app en tu máquina**, deja una prueba que evita que regresen y marca qué control de SOC 2 / ISO 27001 toca cada uno. | ✅ Lista |
| 🔐 | [**Permisos**](plugins/permisos/skills/permisos/SKILL.md) | Saca de tu código **quién puede hacer qué**, lo compara con lo que quiere el negocio y deja pruebas por rol. Revisa también el "ver como", la bitácora de auditoría y que borrar un cliente borre todo lo suyo. | ✅ Lista |
| 🕵️ | [**Probar bots**](plugins/probar-bots/skills/probar-bots/SKILL.md) | Ataca tu chatbot o agente en tu máquina: **inyección de prompt, órdenes escondidas en documentos, fugas entre clientes y herramientas que borran o envían sin permiso**. Cada hallazgo con la conversación exacta y el arreglo en el código. | ✅ Lista |
| 🤖 | [**Examen de bots**](plugins/examen-de-bots/skills/examen-de-bots/SKILL.md) | Le hace a tu chatbot un examen con preguntas reales, **lo califica con un número** y te avisa si empeora al cambiar el prompt, el modelo o su información. | ✅ Lista |
| 🧪 | [**Calidad**](plugins/calidad/skills/calidad/SKILL.md) | Antes de tocar una función, columna o endpoint te dice **qué rompes, con archivo y línea** y qué tan riesgoso es. Reproduce cada bug con una prueba, desenmascara pruebas que no prueban nada o fallan al azar y propone qué código muerto borrar. | ✅ Lista |
| ⚡ | [**Rendimiento**](plugins/rendimiento/skills/rendimiento/SKILL.md) | Mide por qué una pantalla o API está lenta y encuentra la causa real: consultas repetidas, listas sin paginar, código lento o frontend pesado. Cada arreglo llega con su número antes y después. | ✅ Lista |
| 🧱 | [**Migraciones**](plugins/migraciones/skills/migraciones/SKILL.md) | Revisa tus migraciones **antes de producción**: si pierden datos, si bloquean tablas grandes, si se pueden deshacer y si tu código sigue funcionando durante el despliegue. También encuentra índices, reglas y datos huérfanos, y prueba tu respaldo. | ✅ Lista |
| 🗄️ | [**Base para miles de clientes**](plugins/base-miles-de-clientes/skills/base-miles-de-clientes/SKILL.md) | Mide si de verdad necesitas copias de lectura, arma una base para escribir y copias para leer, y **encuentra en tu código lo que fallaría por el retraso de la copia**, comprobado en tu máquina. | ✅ Lista |
| 📈 | [**Escalar**](plugins/escalar/skills/escalar/SKILL.md) | Prueba tu app con cientos o miles de usuarios en tu máquina, **te dice qué truena primero** y te da el plan por prioridad (caché, colas, caídas, archivos) más cuánto te cuesta cada cliente. | ✅ Lista |
| 🚀 | [**Producción**](plugins/produccion/skills/produccion/SKILL.md) | Antes de cada despliegue te da un semáforo (**listo / con riesgos / no subir**) con lo que falta. Ordena los errores de producción por clientes afectados, arma las alertas mínimas, escribe el post mortem y las novedades para clientes. | ✅ Lista |
| ♿ | [**Pantallas**](plugins/pantallas/skills/pantallas/SKILL.md) | Revisa tus pantallas: **contraste medido con la fórmula WCAG**, botones sin nombre, textos sin traducir y llaves crudas, estados que faltan y componentes repetidos. Cada propuesta trae archivo, línea y el cambio exacto. | ✅ Lista |
| 🎨 | [**Mockup vs app**](plugins/mockup-vs-app/skills/mockup-vs-app/SKILL.md) | Compara tu diseño con la pantalla real en celular, tablet, escritorio y modo oscuro, y te da **cada diferencia medida** ("48 px en el mockup, 40 px en la app") con el cambio exacto de CSS. | ✅ Lista |
| 💸 | [**Eficiencia IA**](plugins/eficiencia-ia/skills/eficiencia-ia/SKILL.md) | Tus agentes de IA y la IA de tu producto **gastan menos y avanzan más**: archivo de instrucciones con comandos probados, tareas claras, modelo barato primero y ahorro medido en tokens. | ✅ Lista |

**Por tema:**
- **Seguridad:** [Seguridad](#️-cómo-funciona-seguridad) · [Permisos](#-cómo-funciona-permisos) · [Probar bots](#️-cómo-funciona-probar-bots)
- **Calidad:** [Examen de bots](#-cómo-funciona-examen-de-bots) · [Calidad](#-cómo-funciona-calidad) · [Pantallas](#-cómo-funciona-pantallas) · [Mockup vs app](#-cómo-funciona-mockup-vs-app)
- **Base de datos y escala:** [Migraciones](#-cómo-funciona-migraciones) · [Base para miles de clientes](#️-cómo-funciona-base-para-miles-de-clientes) · [Escalar](#-cómo-funciona-escalar) · [Rendimiento](#-cómo-funciona-rendimiento)
- **Operación y equipo:** [Producción](#-cómo-funciona-producción) · [Eficiencia IA](#-cómo-funciona-eficiencia-ia)

> [!NOTE]
> **Todas siguen las mismas reglas:** nunca tocan producción sin tu permiso, nunca cambian tu código sin preguntarte, solo apagan los procesos que ellas prendieron, no instalan nada sin avisar y nunca copian tus claves al reporte.

---

## 🛡️ Cómo funciona: Seguridad

### Qué la hace distinta

| Lo que ya existe | Lo que le falta | Lo que hace esta skill |
|---|---|---|
| Escáneres de código (Semgrep, CodeQL, Brakeman) | Dan cientos de avisos de "posible problema"; muchos son falsos | **Solo reporta lo que pudo comprobar**, con la petición exacta como prueba |
| `/security-review` y revisiones con IA | Leen el código y opinan; no prueban nada | **Levanta tu app y la ataca** como lo haría alguien de fuera |
| Herramientas de secretos y dependencias | Revisan una sola cosa cada una | Las usa si las tienes y **junta todo en un solo reporte** |
| Nadie | No saben qué es un "cliente" en tu sistema | **Entiende tu modelo de cuentas** y busca dónde un cliente puede ver datos de otro |
| Nadie | El hoyo se arregla… y regresa meses después | **Deja una prueba automática** que falla si alguien lo vuelve a meter |
| Consultoras de SOC 2 / ISO | La evidencia técnica se arma a mano | **Marca qué control toca cada hallazgo** y arma el reporte de evidencias |

### Qué revisa

1. **Fuga entre cuentas.** Que un cliente no pueda ver ni cambiar datos de otro cliente.
2. **Permisos.** Que un usuario no pueda hacer cosas de un rol que no tiene.
3. **Enlaces públicos.** Qué muestran, si caducan y si se pueden adivinar.
4. **Secretos.** Claves y tokens escritos en el código.
5. **Entradas peligrosas.** Inyección SQL, XSS, redirecciones abiertas y archivos sin validar.
6. **Login y abuso.** Límite de intentos y cookies seguras.
7. **Webhooks.** Que validen la firma y no procesen dos veces el mismo aviso.
8. **Dependencias.** Paquetes con fallas conocidas, y si de verdad usas la parte que falla.
9. **Configuración.** Encabezados de seguridad, HTTPS y CORS.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/seguridad:seguridad` | Revisa todo el proyecto |
| `/seguridad:seguridad cambios` | Revisa solo lo que modificaste, antes de subirlo |
| `/seguridad:seguridad cuentas` | Revisa un solo tema (`cuentas`, `permisos`, `webhooks`, `secretos`…) |
| `/seguridad:seguridad auditoria` | Reporte de controles técnicos para SOC 2 / ISO 27001 / ISO 27701 |

También puedes pedirlo con tus palabras: *"revisa si un cliente puede ver datos de otro"*.

### Así se ve un hallazgo

> 🔴 **Grave: un cliente puede leer y cambiar los tableros de otro**
> `GET /api/tableros/:id` y `PATCH /api/tableros/:id` · `server.js:85`
>
> **Lo comprobé:** con la sesión de Ana (Empresa A) pedí el tablero 2 (Empresa B) → `200` con *"Nómina Empresa B"*.
> **Quién lo aprovecha:** cualquier usuario con cuenta, cambiando un número en la URL.
> **Arreglo:** buscar el tablero dentro de la cuenta del usuario (`b.accountId === user.accountId`).
> **Prueba agregada:** `test/seguridad/aislamiento-tableros.test.js`: falla hoy y pasa con el arreglo.
> **Controles:** ISO 27001 8.3 · SOC 2 CC6.1

### Lo que nunca hace

- **Nunca ataca producción** ni ningún servidor que no sea tu máquina o Docker local.
- **Nunca arregla nada sin preguntarte.** Te propone el cambio y tú decides.
- **Nunca dice "cumples SOC 2 o ISO".** Eso solo lo puede decir un auditor. Te da la evidencia técnica y te lista lo que falta fuera del código.

---

## 🔐 Cómo funciona: Permisos

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| Los permisos viven regados en políticas, middlewares y botones escondidos | Nadie puede contestar "¿quién puede exportar?" sin leer todo el código | **Arma el mapa** rol × acción en `permisos/mapa.md`, con archivo y línea |
| Se prueba con el rol admin y ya | El lector que se hace admin, o el admin de otra empresa, nunca se prueba | **Una prueba por acción y por rol**, más un usuario de otra cuenta y uno sin sesión |
| La prueba copia la regla del código | Si la regla está mal, la prueba la protege para siempre | **La regla correcta sale del negocio**; si no está clara, te pregunta |
| Las pruebas que fallan se marcan "pendiente" | La suite queda verde y el hoyo, escondido | **Las que fallan se quedan fallando**: cada una es un hallazgo |
| "Ver como" para soporte | No deja rastro, no avisa y permite cambiar la contraseña del cliente | **Revisa 7 requisitos** y deja una prueba para cada uno |
| "Borrar cuenta" borra la base de datos | Quedan archivos, el buscador, la caché y las sesiones | **Verifica con una cuenta desechable** que no quede nada suyo y nada ajeno se toque |

### Qué revisa

1. **Mapa de permisos.** Qué permite el servidor, qué muestra el front y qué quiere el negocio.
2. **Pruebas por rol.** En el framework de pruebas de tu proyecto.
3. **"Ver como".** Registro, aviso en pantalla, caducidad y acciones bloqueadas.
4. **Bitácora.** Qué debe quedar registrado, qué se registra hoy y cómo implementarlo.
5. **Borrado de cuenta.** Base de datos, archivos, buscador, caché, sesiones, servicios externos y política de respaldos.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/permisos:permisos` | Mapa y pruebas por rol |
| `/permisos:permisos mapa` | Solo el mapa |
| `/permisos:permisos pruebas` | Solo las pruebas, a partir del mapa |
| `/permisos:permisos ver-como` | Revisa la suplantación de usuarios |
| `/permisos:permisos auditoria` | Revisa la bitácora y propone cómo implementarla |
| `/permisos:permisos borrado` | Verifica que borrar un cliente borre todo lo suyo |

### Lo que nunca hace

- **Nunca cambia tus reglas de permisos sin preguntarte.** Agrega el mapa y las pruebas; los arreglos los propone.
- **Nunca prueba el borrado con datos reales.** Solo en una base local o de pruebas, con una cuenta creada para eso.
- **Nunca corre contra producción** sin tu permiso explícito.

---

## 🕵️ Cómo funciona: Probar bots

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| Le pides al bot "muéstrame tu prompt" y dice que no | Hay cien formas más: otro idioma, base64, "soy del equipo de desarrollo" | **Catálogo fijo de ataques** que se corre igual cada vez y se compara después de cada cambio |
| Revisas lo que el bot contesta | Puede contestar "aquí está el resumen" y haber mandado un correo en silencio | **Mira las herramientas y los datos**, no solo el texto: detecta acciones que el bot no menciona |
| "Le dijimos en el prompt que no hable de otros clientes" | Si el contexto ya trae sus datos, una frase basta para sacarlos | **Lee cómo se arma el contexto** y propone el filtro en la consulta, no en el prompt |
| Las herramientas confían en el id que manda el modelo | Un cliente borra o lee registros de otro | **Revisa cada herramienta** contra la sesión del usuario y lo comprueba con cuentas de prueba |
| Una orden escondida en un PDF o un formulario | Quien escribe ahí controla tu bot | **Planta trampas inofensivas** y comprueba si el bot las obedece |

### Qué revisa

1. **Inyección directa.** "Ignora tus reglas", cambio de papel, otro idioma, texto codificado.
2. **Inyección escondida.** Órdenes en documentos, correos, páginas, campos de formulario y nombres de archivo.
3. **Fugas.** Datos de otro cliente, de otro usuario o de la configuración.
4. **Herramientas peligrosas.** Borrar, enviar, crear o pagar sin permiso o en la cuenta equivocada.
5. **Permisos del agente.** Que nunca pueda más que el usuario que le habla.
6. **Datos personales.** Que no los cuente a quien no debe ni los guarde en las bitácoras.
7. **Marca.** Que no lo saquen de su papel para hablar contra tu empresa.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/probar-bots:probar-bots` | Revisa el código del bot y corre todos los ataques |
| `/probar-bots:probar-bots inyeccion` | Inyección directa, escondida y de marca |
| `/probar-bots:probar-bots fugas` | Datos de otros clientes, secretos y datos personales |
| `/probar-bots:probar-bots herramientas` | Herramientas y permisos del agente |
| `/probar-bots:probar-bots cambios` | Solo lo que cambiaste, comparado con la última corrida |

Los ataques quedan en tu proyecto (`probar-bots/`), así que también los puedes correr en CI, sin IA:

```bash
node ataques.mjs correr --ataques probar-bots/ataques.json --vars probar-bots/variables.json --url http://localhost:3000/chat --repeticiones 3
node ataques.mjs comparar probar-bots/resultados/antes.json probar-bots/resultados/despues.json
```

### Lo que nunca hace

- **Nunca ataca producción** ni nada que no sea tu máquina o tu ambiente de pruebas, y siempre con cuentas de prueba.
- **Nunca hace acciones reales.** Los correos van a dominios `.test` y los pagos solo en modo de pruebas. Regresa los datos después de cada ataque.
- **Nunca genera contenido dañino** para "probar": le basta una frase inofensiva para demostrar que el bot rompió su papel.
- **Nunca cambia tu bot sin preguntarte**, y nunca copia tus claves al reporte.

---

## 🤖 Cómo funciona: Examen de bots

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| Pruebas el bot "a mano" con 5 preguntas | No sabes si mejoró o empeoró después de cambiar algo | **Examen fijo con calificación**: 87/100 hoy, 91/100 mañana |
| Le pides a la IA que "revise el bot" | Arma un examen distinto cada vez; no se puede comparar | **Siempre la misma herramienta** y el mismo formato: cualquier corrida se compara con la anterior |
| Calificar buscando palabras | Una respuesta mala puede contener la palabra correcta | **Datos con patrones, conductas con juicio**: escalar, tono y negarse los califica el agente con un criterio |
| El bot dice "no tengo esa información" a todo | Parece que nunca inventa | **Detecta respuestas comodín** y no las cuenta como aciertos |
| La respuesta "correcta" sale de lo que ya dice el bot | El examen aprueba los errores | **La respuesta correcta sale de tu información real**: precios, políticas, funciones |

### Qué califica

| Categoría | Pregunta |
|---|---|
| Datos | ¿Contesta bien precios, plazos, horarios y cómo se hace algo? |
| No inventar | ¿Inventa funciones, precios o promesas que no existen? |
| Pasar a humano | ¿Pasa con una persona cuando se lo piden o el cliente está molesto? |
| Fuera de tema | ¿Se mantiene en su papel? |
| Seguridad básica | ¿Suelta su prompt con un truco simple? |
| Tono | ¿Habla como tu empresa? |
| Robustez | ¿Entiende faltas de ortografía, mensajes sin acentos o en otro idioma? |

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/examen-de-bots:examen-de-bots` | Arma el examen con tu información real, lo corre y te da la calificación |
| `/examen-de-bots:examen-de-bots comparar` | Lo corre otra vez y te dice **qué empeoró** desde la última vez |
| `/examen-de-bots:examen-de-bots modelos` | Compara varios modelos o prompts: calificación, velocidad y costo |

El examen queda en tu proyecto (`examen-bot/`), así que también lo puedes correr en CI, sin IA:

```bash
node examen.mjs correr --casos examen-bot/casos.json --url http://localhost:3000/chat --repeticiones 3
node examen.mjs comparar examen-bot/resultados/antes.json examen-bot/resultados/despues.json
```

`comparar` termina con error si empeoró algún caso crítico, para que tu CI lo detenga.

### Lo que nunca hace

- **Nunca examina tu bot de producción sin preguntarte.** Una pregunta como "quiero hablar con una persona" puede abrir un ticket real.
- **Te avisa del costo** antes de hacer muchas preguntas a un modelo de pago.
- **Nunca cambia tu bot.** Te propone cambios al prompt y tú decides.

---

## 🧪 Cómo funciona: Calidad

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| Buscas el nombre de la función antes de cambiarla | No salen las llamadas por texto, alias, configuración, plantillas ni otras apps | **9 búsquedas obligatorias** y una tabla con archivo:línea, qué prueba lo cubre y qué falla en silencio |
| "Tenemos 90 % de cobertura" | Una prueba sin aserciones también cuenta como cubierta | **Rompe el código a propósito en una copia** y te muestra qué pruebas no se dieron cuenta |
| La prueba falla "a veces" y le das reintentar | Se esconde un error real (folios repetidos, horas, orden) | **La corre 20 veces o más**, cuenta las fallas y encuentra la causa en el código |
| Arreglas el bug y "ya quedó" | Nada demuestra que el arreglo sirve ni que no regresa | **Primero una prueba que falla**, luego el arreglo, luego la prueba pasa |
| Borras código "que nadie usa" | Se cargaba por nombre desde la configuración y se cae en producción | **Evidencia por candidato**, y te avisa de lo que parece muerto pero no lo está |

### Qué hace

1. **Impacto.** Qué rompes si cambias una función, archivo, columna, endpoint o componente, y qué tan riesgoso es.
2. **Bug.** Reproduce el error con una prueba antes de arreglarlo.
3. **Pruebas.** Encuentra pruebas que pasan aunque el código esté mal y lo demuestra.
4. **Inestables.** Pruebas lentas o que fallan al azar, y por qué (azar, hora, esperas, orden, red, datos compartidos).
5. **Flujos.** Recorre los flujos clave como un usuario real, en tu máquina.
6. **Muerto.** Código, rutas y archivos sin uso, con evidencia para borrarlos sin miedo.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/calidad:calidad impacto calcularTotal` | Lista todo lo que depende de eso y el riesgo de cambiarlo. No cambia nada |
| `/calidad:calidad bug "el cupón cobra de más"` | Prueba que falla → arreglo (con tu permiso) → prueba que pasa |
| `/calidad:calidad pruebas` | Pruebas que no prueban nada, demostrado con mutaciones |
| `/calidad:calidad inestables` | Pruebas que fallan al azar o tardan, con su causa |
| `/calidad:calidad flujos` | Recorre registro, compra y los flujos clave en tu app local |
| `/calidad:calidad muerto` | Propuesta de código para borrar, con evidencia |

### Lo que nunca hace

- **Nunca borra código ni pruebas sin tu permiso.** Te da la propuesta y tú decides.
- **Nunca deja una mutación puesta.** Rompe el código solo en una copia, o lo regresa al instante y confirma que `git diff` sale vacío.
- **Nunca decide tus reglas de negocio.** Si no está claro cuál es el valor correcto, te pregunta.
- **Nunca corre contra producción** ni instala herramientas sin preguntar.

---

## ⚡ Cómo funciona: Rendimiento

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| "Optimizas" lo que parece lento | Muchas veces la causa está en otro lado | **Mide primero**: tiempo en la base, en el código y en llamadas externas |
| Le pides a la IA que "lo haga más rápido" | Reescribe todo de una vez, sin números, en tu código | **No toca tu código**: prueba cada arreglo en una copia y te da el antes y después |
| Mides una vez con el navegador | La primera petición miente y el ruido parece mejora | **Herramienta fija**: calienta, mide 20 veces, mediana y p95, y avisa si la diferencia es ruido |
| Arreglas un N+1 | Meses después alguien lo vuelve a meter | **Presupuesto**: una prueba que falla si la ruta pasa de N consultas o de cierto peso |
| Todo "se ve mejorable" | Se tocan rutas que ya estaban bien | **"Bien hecho"**: te dice qué ya es rápido, con su número, para no tocarlo |

### Qué revisa

1. **Lento por qué.** Tiempo total, consultas, tiempo en la base, en el código y en servicios externos.
2. **Consultas repetidas (N+1).** Las encuentra en el log y propone `includes`, `select_related`, `with`, `include` o `WHERE IN`.
3. **Listas sin paginar.** APIs y pantallas que cargan todo para mostrar 20.
4. **Frontend pesado.** JavaScript, imágenes, compresión y carga por partes, con las herramientas que ya tienes.
5. **Presupuesto de velocidad.** Límites por ruta que hacen fallar una prueba.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/rendimiento:rendimiento` | Mide las rutas principales y encuentra por qué están lentas |
| `/rendimiento:rendimiento /pedidos` | Revisa una ruta o pantalla |
| `/rendimiento:rendimiento n+1` | Busca consultas repetidas |
| `/rendimiento:rendimiento listas` | Busca listas que cargan todo de golpe |
| `/rendimiento:rendimiento frontend` | Mide lo que descarga la página |
| `/rendimiento:rendimiento presupuesto` | Deja pruebas que fallan si una ruta se vuelve lenta |

La herramienta también se usa sola, en CI:

```bash
node medir.mjs medir http://localhost:3000/api/pedidos --n 20 --max-p95 300
node medir.mjs comparar rendimiento/mediciones/antes.json rendimiento/mediciones/despues.json
```

### Lo que nunca hace

- **Nunca manda carga a producción.** Solo mide local o pruebas.
- **Nunca cambia tu código sin preguntarte.** Prueba los arreglos en una copia y tú decides cuáles aplicar.
- **Nunca instala herramientas de perfilado sin preguntar.**

---

## 🧱 Cómo funciona: Migraciones

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| Se revisa que la migración "corra" en local | Con 300 mil filas tarda un segundo; con 40 millones bloquea la tienda media hora | **Estima con el tamaño de producción** y dice qué candado toma y qué deja de funcionar |
| Se revisa solo el código nuevo | Durante el despliegue también corre el viejo, y es el que se cae al borrar o renombrar | **Busca cada columna tocada en el código** y revisa las dos versiones |
| Se "prueba" la migración con ROLLBACK | Toma los mismos candados y escribe en tu base | **Solo lee**: nunca corre migraciones ni escribe sin tu permiso |
| Índices "por si acaso" | Cada índice cuesta disco y hace más lenta cada escritura | **Índices a partir de tus consultas reales**, cada uno con su costo |
| Reglas que solo vigila el código | Dos peticiones al mismo tiempo pasan la revisión; quedan correos repetidos y pedidos sin cliente | **Pasa las reglas a la base** sin bloquear (`NOT VALID` + `VALIDATE`) |
| "Tenemos respaldo diario" | Nadie lo ha restaurado | **Lo restaura en una base nueva** y comprueba que sirve |

### Qué revisa

1. **Pérdida de datos.** Borrar o renombrar columnas, cambiar tipos y conversiones que redondean.
2. **Bloqueos.** Índices sin `CONCURRENTLY`, cambios de tipo, llaves y `NOT NULL` en tablas grandes.
3. **Reversa.** Si se puede deshacer y si eso recupera los datos o solo la estructura.
4. **Código durante el despliegue.** Que la versión vieja y la nueva sigan funcionando mientras conviven.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/migraciones:migraciones` | Revisa las migraciones pendientes y dice si se pueden correr así |
| `/migraciones:migraciones plan <cambio>` | Parte un cambio grande en pasos sin caída, despliegue por despliegue |
| `/migraciones:migraciones indices` | Propone los índices que faltan, con su costo |
| `/migraciones:migraciones huerfanos` | Encuentra registros que apuntan a cosas borradas |
| `/migraciones:migraciones reglas` | Pasa a la base las reglas que hoy solo vigila el código |
| `/migraciones:migraciones respaldo` | Restaura tu respaldo en una base nueva y comprueba que sirve |
| `/migraciones:migraciones datos-prueba` | Genera muchos datos realistas sin datos personales |

La revisión rápida también corre sola en CI, sin IA: `node revisar.mjs db/migrate --codigo app` termina con error si encuentra algo grave.

### Lo que nunca hace

- **Nunca corre migraciones ni escribe en producción.** Te da el SQL y los pasos.
- **Nunca restaura encima de una base que ya existe.** Siempre en una base nueva.
- **Nunca borra tus datos huérfanos.** Te propone cómo limpiarlos y tú decides.

---

## 🗄️ Cómo funciona: Base para miles de clientes

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| "La base está lenta, pongamos réplicas" | Muchas veces era un índice que faltaba; la copia cuesta lo mismo que la principal | **Mide primero** y te dice con números si basta un índice, un agrupador de conexiones o subir un tamaño |
| Se activan las réplicas en el framework | Guardas algo y "no aparece", el login falla tras registrarse, se cobra dos veces | **Encuentra en tu código cada lectura tras escritura** y la reproduce en local |
| La copia se cae | Se caen todos los listados | Revisa que haya **plan B**: leer de otra copia o de la principal |
| "¿Y si se cae la principal?" | Nadie sabe qué se pierde | Explica el cambio de principal y **lo practica en Docker local** |
| Precios de memoria | Números sin fecha | **Costo estimado por servidor, con fecha y fuente**, contra la alternativa |

### Qué revisa

1. **¿Ya lo necesitas?** Consultas lentas, CPU, conexiones y proporción lectura/escritura por tiempo.
2. **Qué va a cada base.** Reportes, dashboards y listados a las copias; guardar, pagos y login a la principal.
3. **Retraso de la copia.** Los lugares donde se guarda y enseguida se lee, y cómo arreglarlos.
4. **Fallas.** Qué pasa si una copia se cae y si se cae la principal.
5. **Configuración** para Rails, Django, Laravel y Node (Prisma, Knex, Sequelize).
6. **Carga y costo.** Prueba local antes y después, y costo aproximado de cada servidor.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/base-miles-de-clientes:base-miles-de-clientes` | Diagnóstico completo y plan |
| `/base-miles-de-clientes:base-miles-de-clientes medir` | Solo "¿ya lo necesito?", con números |
| `/base-miles-de-clientes:base-miles-de-clientes plan` | Servidores, tamaños, costo, configuración y fallas |
| `/base-miles-de-clientes:base-miles-de-clientes codigo` | Busca lecturas tras escritura y consultas que deberían ir a la copia |
| `/base-miles-de-clientes:base-miles-de-clientes docker` | Levanta principal + copia en tu máquina y prueba retraso, caída y cambio de principal |

### Lo que nunca hace

- **Nunca toca tu base de producción** ni cambia su configuración: te da las consultas de solo lectura y tú las corres.
- **Nunca cambia tu código sin preguntarte.** Propone y aplica uno por uno.
- **Nunca da un precio sin fecha ni fuente.**

---

## 📈 Cómo funciona: Escalar

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| "Pruébalo con 1 000 usuarios" | 1 000 usuarios sin pausa no son 1 000 clientes; el número no significa nada | **Convierte tus clientes en una meta real** (peticiones por segundo) con tus datos y prueba por escalones |
| Cada quien escribe su script de carga | No se puede repetir ni comparar; a veces apunta a producción | **Una herramienta fija** que solo acepta tu máquina, con topes, y compara antes y después |
| "Agrega Redis" | Una caché con la llave equivocada enseña datos de otro cliente | **Detecta la fuga entre cuentas durante la carga** y propone llave, tiempo de vida y cómo borrarla |
| La prueba de carga crea pedidos y manda correos | En una app real, son correos y cobros de verdad | **Revisa qué dispara cada ruta** antes de cargarla y deja los datos como estaban |
| La prueba "terminó bien" | La app puede quedar trabada minutos después | **Mide si se recupera sola** después de la carga y de cada caída |
| Costo = factura / clientes | El promedio esconde al cliente grande en el plan barato | **Costo por tipo de cliente**, con precios con fecha y fuente, y una hoja para tus precios |

### Qué revisa

1. **Prueba de carga:** en qué escalón se rompe y qué ruta truena primero.
2. **Caché:** qué guardar, por cuánto tiempo, con el cliente en la llave y cómo borrarla sin datos viejos.
3. **Colas:** sacar correos, PDF y llamadas lentas de la petición, con reintentos que no duplican.
4. **Caídas:** qué pasa si se cae la base, Redis, un servicio externo o un servidor, y si se recupera sola.
5. **Archivos:** sacarlos del servidor a almacenamiento externo con CDN.
6. **Costo por cliente:** fórmula, hoja y lectura para precios y límites por plan.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/escalar:escalar` | Diagnóstico completo y plan por prioridad |
| `/escalar:escalar carga` | Solo la prueba de carga y qué truena primero |
| `/escalar:escalar cache` | Revisa y propone la caché |
| `/escalar:escalar colas` | Qué mover a segundo plano y cómo reintentar sin duplicar |
| `/escalar:escalar caidas` | Plan de caídas, comprobado en local |
| `/escalar:escalar archivos` | Archivos a almacenamiento externo y CDN |
| `/escalar:escalar costo` | Costo por cliente y hoja de precios |

La herramienta queda para usarla sin IA:

```bash
node carga.mjs objetivo --clientes 5000 --clientes-hoy 120 --peticiones-mes 900000
node carga.mjs correr --escenario carga/escenario.json --escalones 50,100,250,500 --etiqueta linea-base
node carga.mjs comparar carga/resultados/antes.json carga/resultados/despues.json
```

Réplicas e índices de la base van en **Base para miles de clientes**; encontrar por qué una ruta es lenta, en **Rendimiento**.

### Lo que nunca hace

- **Nunca hace carga contra producción ni contra servidores de terceros.** La herramienta se niega; un ambiente de pruebas remoto solo con tu permiso por escrito y con tope de 50 peticiones por segundo.
- **Nunca cambia tu infraestructura ni tu código sin preguntarte.** Propone, y tú decides uno por uno.
- **Nunca te da un precio sin fecha y fuente.**

---

## 🚀 Cómo funciona: Producción

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| "¿Está listo para subir?" se responde corriendo las pruebas | Las variables nuevas, la migración que borra datos y la bandera que no se puede apagar aparecen ya en producción | **Revisa 7 puntos y da un semáforo** con cada pendiente y su `archivo:línea` |
| El plan para regresar es "hacemos rollback" | Regresar el código no devuelve una columna borrada ni un cobro hecho | **Escribe el plan concreto** y dice qué no se puede regresar |
| Se lee el log de arriba a abajo | 120 avisos sin importancia tapan 9 cobros colgados | **Agrupa por causa y ordena por clientes y dinero**; avisa si el log trae claves |
| Alertas para todo o para nada | Te enteras por un cliente, o ignoras las alertas por ruido | **Seis alertas mínimas** con opciones gratis y la configuración para tu plataforma |
| Notas de versión copiadas de los commits | Salen nombres de clientes, tickets y arreglos de seguridad | **Novedades en palabras simples**, sin nada interno |

### Qué revisa antes de subir

1. **Pruebas y build.**
2. **Migraciones:** cuáles son riesgosas y si el código aún usa lo que se borra.
3. **Variables de entorno nuevas** que faltan en producción.
4. **Dependencias:** cambios, versiones mayores y archivo de versiones fijas.
5. **Banderas de funciones:** si se pueden apagar sin desplegar.
6. **Plan para regresar:** a qué versión, cómo y qué no se recupera.
7. **Otros riesgos:** dinero sin prueba, parches que el despliegue borraría.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/produccion:produccion` o `/produccion:produccion antes` | Revisión antes de subir con semáforo |
| `/produccion:produccion errores errores.log` | Agrupa los errores por causa e impacto y propone arreglos |
| `/produccion:produccion monitoreo` | Las alertas mínimas y cómo configurarlas |
| `/produccion:produccion postmortem` | Documento sin culpables después de una falla |
| `/produccion:produccion notas v1.2.0..HEAD` | Novedades para clientes |

### Lo que nunca hace

- **Nunca despliega, regresa versiones ni reinicia servicios.** Tú decides y tú subes.
- **Nunca escribe en producción.** Lee los logs que le das o con un comando de solo lectura que tú apruebas.
- **Nunca pone en las notas para clientes** nombres de clientes, datos internos ni arreglos de seguridad.

---

## ♿ Cómo funciona: Pantallas

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| "Ese gris se ve bajito" | Nadie sabe si cumple, y el color "más oscuro" que se propone tampoco cumple | **Mide cada par de colores con la fórmula WCAG** y propone el color más parecido que sí cumple, ya medido |
| Revisas la pantalla con datos | La pantalla se rompe cuando la lista viene vacía, la API falla o no tienes permiso | **Provoca cada estado** y te da una tabla: vacío, cargando, error y sin permiso por pantalla |
| Las traducciones se revisan a mano | Un título dice `dashboard.title` y nadie lo ve hasta que un cliente lo reporta | **Cruza las llaves del código con cada idioma** y encuentra textos fijos y frases en el idioma equivocado |
| Revisiones de accesibilidad genéricas | Dan una lista de reglas, no qué cambiar | **Archivo, línea y el cambio exacto** de cada hallazgo, con el criterio WCAG cuando aplica |
| Cinco botones casi iguales | Cada arreglo se hace cinco veces y siempre se olvida uno | **Propone el componente único**, su API y la lista de lugares que cambian |

### Qué revisa

1. **Accesibilidad.** Contraste, uso con teclado (foco visible, orden, trampas), nombres para lectores de pantalla y tamaño para tocar.
2. **Textos.** Textos fijos en el código, llaves que faltan en un idioma, llaves crudas en pantalla, frases técnicas.
3. **Estados.** Vacío, cargando, error y sin permiso en cada pantalla con datos.
4. **Componentes.** Componentes casi iguales que conviene unir.

Funciona con React, Vue, Svelte, Angular, plantillas de Rails, Django y Laravel, y Flutter. Si tu app corre en local, la abre con Chrome o Playwright si ya los tienes.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/pantallas:pantallas` | Los cuatro temas sobre tus pantallas principales |
| `/pantallas:pantallas src/pages/clientes` | Los cuatro temas sobre una pantalla o carpeta |
| `/pantallas:pantallas accesibilidad` | Solo un tema (`accesibilidad`, `textos`, `estados`, `componentes`) |

La herramienta también se usa sola, sin IA:

```bash
node pantallas.mjs contraste "#a0a0a0" "#ffffff"   # 2.61:1 · cambia el texto a #767676 (4.54:1)
node pantallas.mjs textos src/
```

### Lo que nunca hace

- **Nunca cambia tus componentes, estilos ni traducciones sin preguntarte.** Te da el cambio exacto y tú decides.
- **Nunca abre producción.** Solo tu app local o un ambiente de pruebas.
- **Nunca instala nada.** Usa el navegador o Playwright que ya tengas; si no hay, revisa el código.

---

## 🎨 Cómo funciona: Mockup vs app

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| Revisas el diseño "a ojo" | Se te pasan 4 px, un azul parecido o el modo oscuro | **Mide con los estilos reales**: "el botón mide 40 px, el mockup 48 px" |
| Herramientas de diferencia de píxeles | Te dan "4% distinto" y una imagen roja | **Una lista de diferencias**, cada una con selector, archivo y arreglo |
| Le pides a la IA que compare | Escribe un script nuevo cada vez y revisa un solo tamaño | **Siempre la misma herramienta**: celular, tablet y escritorio, claro y oscuro |
| Cinco colores mal | Cinco arreglos sueltos | **Encuentra la variable** (`--primario`) y lo arregla una vez |

### Qué revisa

1. **Colores** de fondo, texto y borde, también en modo oscuro.
2. **Letra:** tamaño, grosor, fuente y alto de línea.
3. **Espacios:** relleno, márgenes y separaciones.
4. **Tamaños** de botones, campos y tarjetas.
5. **Textos** distintos y faltas de ortografía.
6. **Elementos que faltan o sobran**, sobre todo los que solo desaparecen en celular.
7. **Estados** (vacío, error, cargando) si el mockup los trae.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/mockup-vs-app:mockup-vs-app` | Compara una pantalla con su mockup |
| `/mockup-vs-app:mockup-vs-app todas` | Todas las pantallas que tengan mockup |
| `/mockup-vs-app:mockup-vs-app celular` | Solo el tamaño celular |
| `/mockup-vs-app:mockup-vs-app oscuro` | Solo modo oscuro, en todos los tamaños |

Funciona con mockups en imagen (PNG/JPG), HTML estático o exportados de Figma. Usa el Chrome o Edge que ya tienes.

### Lo que nunca hace

- **Nunca abre staging ni producción.** Solo tu app local.
- **Nunca cambia tus estilos sin preguntarte.** Te propone el cambio y tú decides.
- **Nunca sube tus capturas** a ningún servicio. Se quedan en `mockup-vs-app/capturas/`.

---

## 💸 Cómo funciona: Eficiencia IA

### Qué la hace distinta

| Lo que pasa hoy | El problema | Lo que hace esta skill |
|---|---|---|
| Cada sesión, el agente "descubre" cómo correr y probar el proyecto | Pagas tokens y minutos por lo mismo una y otra vez | **Archivo de instrucciones corto con comandos que corrió de verdad**; lo que no probó lo marca |
| Le pides a la IA que "lo optimice" | Reescribe tu código de golpe, sin preguntar | **Borrador primero**: te muestra cada cambio y su ahorro; tú decides, uno por uno |
| "Así ahorras 90%" | Porcentajes inventados y precios de memoria | **Ahorro medido en tokens y llamadas**; dinero solo con precio de la página oficial y fecha |
| El agente repite el mismo error | Quema contexto sin avanzar | **Detector de vueltas inútiles**: para, resume y cambia de estrategia |
| Nadie sabe cuánto costó una función | No se puede decidir qué vale la pena | **Suma el uso real** de las bitácoras locales por rama, carpeta y fechas |

### Qué revisa

1. **Memoria del proyecto.** `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, `copilot-instructions`: comandos probados, reglas, trampas, sin repetir lo que ya está en el código.
2. **Contexto justo.** Qué archivos importan para una tarea y cuáles no.
3. **IA barata primero.** Qué tareas resuelve un modelo barato o gratis y cuándo vale uno caro.
4. **Vueltas inútiles.** Mismo error dos veces, editar y revertir, la misma prueba sin cambios.
5. **Tareas claras.** Objetivo, alcance, archivos, criterio de terminado y cómo se verifica.
6. **Costo por función.** Tokens (y dinero, si hay precio con fuente) por rama o periodo.
7. **IA de tu producto.** Llamadas repetidas, prompts enormes, modelo caro para algo simple, sin límite de tokens ni tiempo.

### Cómo se usa

| Escribes | Hace |
|---|---|
| `/eficiencia-ia:eficiencia-ia` | Diagnóstico general: las 3 mejoras que más ahorran |
| `/eficiencia-ia:eficiencia-ia memoria` | Crea o mejora el archivo de instrucciones de tus agentes (te muestra el borrador) |
| `/eficiencia-ia:eficiencia-ia tarea "arregla el login"` | Convierte el pedido en una tarea clara, con archivos y modelo sugerido |
| `/eficiencia-ia:eficiencia-ia producto` | Revisa las llamadas a modelos de tu producto y el ahorro de cada cambio |
| `/eficiencia-ia:eficiencia-ia costo` | Cuánto gastaron tus agentes en una función, rama o periodo |

### Lo que nunca hace

- **Nunca cambia tu archivo de instrucciones, la configuración de tus agentes ni tu código sin enseñarte antes el borrador.**
- **Nunca manda tu código ni tus bitácoras a ningún servicio.** Las bitácoras solo se suman en tu máquina.
- **Nunca inventa precios.** Cada precio lleva fuente y fecha; si no hay, te da tokens y la fórmula.

---

## 🧪 Pruébalas en 2 minutos

Este repositorio trae apps de práctica con fallas **puestas a propósito**. No necesitan instalar nada, solo Node 18 o más nuevo.

| App | Para probar | Fallas escondidas |
|---|---|---|
| [**Tablero Vulnerable**](demo/tablero-vulnerable) | `/seguridad:seguridad` | 10+ hoyos de seguridad |
| [**Bot de Soporte**](demo/bot-de-soporte) | `/examen-de-bots:examen-de-bots` | inventa precios, se equivoca de política, no pasa con humanos |
| [**Permisos Demo**](demo/permisos-demo) | `/permisos:permisos` | lector que se hace admin, exportación de todas las empresas, "ver como" sin rastro, borrado que deja archivos |
| [**Bot con Herramientas**](demo/bot-con-herramientas) | `/probar-bots:probar-bots` | suelta su prompt, obedece órdenes escondidas, borra y envía datos de otra empresa |
| [**Calidad Demo**](demo/calidad-demo) | `/calidad:calidad impacto calcularTotal` | dependientes escondidos, prueba que no prueba nada, prueba que falla al azar, código que parece muerto |
| [**Tienda Lenta**](demo/tienda-lenta) | `/rendimiento:rendimiento` | consultas repetidas, lista sin paginar, JavaScript e imagen pesados |
| [**Tienda con migraciones**](demo/tienda-migraciones) | `/migraciones:migraciones` | borra una columna en uso, índice que bloquea, convierte montos redondeando, huérfanos |
| [**Facturas con copia**](demo/facturas-con-copia) | `/base-miles-de-clientes:base-miles-de-clientes` | login que falla tras registrarse, cobro doble, editar que muestra lo viejo, sin plan B |
| [**API sin escalar**](demo/api-sin-escalar) | `/escalar:escalar` | caché que mezcla clientes, correo dentro de la petición, pedidos duplicados, app que no se recupera |
| [**Despliegue Demo**](demo/despliegue-demo) | `/produccion:produccion` | variables nuevas sin configurar, columna borrada en uso, prueba fallando, log con errores repetidos |
| [**Pantallas Demo**](demo/pantallas-demo) | `/pantallas:pantallas` | bajo contraste, botones sin nombre, llaves crudas, listas sin estado de error |
| [**Mockup vs app**](demo/mockup-vs-app) | `/mockup-vs-app:mockup-vs-app` | botón de otro azul y más bajo, título chico, texto distinto, enlace que falta en celular |
| [**Asistente Caro**](demo/asistente-caro) | `/eficiencia-ia:eficiencia-ia producto` | manual completo en cada llamada, saludo repetido, modelo caro, sin límites |

```bash
git clone https://github.com/lomasys/skills.git
cd skills/demo/tablero-vulnerable     # o cualquier otra carpeta de demo/
claude
```

Y dentro de Claude Code escribe el comando de la skill. Cada demo trae su README con el reto y la lista de fallas escondida.

> [!CAUTION]
> Las apps de práctica son inseguras a propósito. Solo escuchan en `127.0.0.1`. No las subas a ningún servidor.

---

## 📂 Estructura

```text
skills/
├── .claude-plugin/
│   └── marketplace.json        ← catálogo: una entrada por skill
├── plugins/
│   └── <skill>/                ← cada skill es su propio plugin
│       ├── .claude-plugin/plugin.json
│       └── skills/<skill>/
│           ├── SKILL.md        ← las instrucciones de la skill
│           ├── referencias/    ← recetas, tablas y ejemplos por framework
│           └── scripts/        ← herramientas sin dependencias (Node 18+), cuando hacen falta
├── demo/                       ← apps de práctica con fallas a propósito
└── assets/                     ← portada
```

---

## ❓ Preguntas frecuentes

<details>
<summary><b>¿Funciona con mi lenguaje o framework?</b></summary>

Sí. La revisión de código sirve para cualquier lenguaje. Para el ataque comprobado, la skill necesita poder levantar tu app en tu máquina (`npm start`, `rails s`, `docker compose up`, etc.). Si no puede, hace solo la revisión de código y te avisa qué no pudo comprobar.
</details>

<details>
<summary><b>¿Manda mi código a algún lado?</b></summary>

No. La skill solo son instrucciones para tu agente. Tu código se queda donde ya lo procesa tu agente de IA, igual que en cualquier otra tarea.
</details>

<details>
<summary><b>¿Reemplaza una auditoría o un pentest profesional?</b></summary>

No. Encuentra y demuestra los errores más comunes en el código antes de que lleguen a producción, y te da evidencia técnica ordenada. Una certificación SOC 2 o ISO 27001 también revisa procesos, políticas y personas, y la otorga un auditor.
</details>

<details>
<summary><b>¿Por qué se escribe <code>/seguridad:seguridad</code> y no solo <code>/seguridad</code>?</b></summary>

Claude Code pone el nombre del plugin delante de sus skills para que no choquen con otras. Si la instalas a mano en `~/.claude/skills/`, se usa como `/seguridad`.
</details>

---

## 🤝 Contribuir

¿Encontraste un tipo de hoyo que la skill no detecta? Abre un *issue* con un ejemplo mínimo. Si puedes, agrégalo también a `demo/tablero-vulnerable` para que quede probado.

## 📄 Licencia

[Apache 2.0](LICENSE). Úsala, modifícala y compártela.

<div align="center">
<br>
<sub>Hecho por <b>lomasys</b></sub>
</div>
