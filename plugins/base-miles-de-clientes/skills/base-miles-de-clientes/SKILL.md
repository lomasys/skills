---
name: base-miles-de-clientes
description: Use when a SaaS or web app is growing and its database is slowing down or saturating (base de datos lenta, se traba, CPU al 100%, too many connections, miles de clientes), when the user asks about read replicas, primary/replica or writer/reader setups, splitting reads and writes (base para escribir y copias para leer, réplicas de lectura), replication lag or stale reads after saving (read-your-writes, "guardo y no aparece"), database failover, or scaling Postgres/MySQL on RDS, Aurora, Cloud SQL or Supabase with Rails, Django, Laravel, Prisma, Knex or Sequelize.
---

# Base para miles de clientes

Decide **con números** si ya necesitas copias de lectura, arma una base principal para escribir y copias (réplicas) para leer,
encuentra en el código las lecturas que fallarían por el retraso de la copia y lo **comprueba en local**.

**Principio:** primero mide. Una copia solo ayuda si las lecturas saturan la base; un índice o un agrupador de conexiones cuestan $0.

## Modos

Lee el argumento (`/base-miles-de-clientes:base-miles-de-clientes <modo>`):

| Argumento | Qué hace |
|---|---|
| *(nada)* | Diagnóstico completo: medir, revisar código, comprobar en local y plan |
| `medir` | Solo "¿ya lo necesito?": números, arreglos baratos primero ([referencias/medir.md](referencias/medir.md)) |
| `plan` | Arquitectura, tamaños, costo, configuración por framework, fallas ([referencias/armar.md](referencias/armar.md), [referencias/frameworks.md](referencias/frameworks.md)) |
| `codigo` | Revisa el código: lecturas tras escritura, consultas que deberían ir a la copia, plan B si la copia falla ([referencias/codigo.md](referencias/codigo.md)) |
| `docker` | Levanta principal + copia en Docker local y prueba retraso, caída de la copia y cambio de principal ([referencias/docker.md](referencias/docker.md)) |

## Reglas (no negociables)

1. **Nunca toca la base de producción.** No se conecta a ella, ni para leer estadísticas, ni cambia su configuración, sus copias ni su failover.
   Las consultas de producción **las corre el usuario**: le das el bloque de solo lectura de [medir.md](referencias/medir.md) y él te pega el resultado.
   Staging, solo con permiso explícito. Por defecto: app local, base local o Docker local.
2. **No cambia código ni configuración sin permiso.** Propones; aplicas solo lo que el usuario apruebe, uno por uno.
   Sí puedes crear archivos nuevos **solo** en `carga/` (plan, resultados y scripts de comprobación) y `copias-local/docker-compose.yml`.
   Dilos en el reporte para que el usuario decida si los conserva.
3. **Solo apaga lo que prendió.** La app como proceso hijo con su PID; Docker con `-p base-miles-prueba` y `down -v` de ese proyecto.
   Nunca `taskkill /IM`, `killall`, `pkill`, `docker stop $(docker ps -q)` ni `docker system prune`.
4. **Nada destructivo.** Sin `DROP`, `DELETE` ni `TRUNCATE` masivos. La carga va solo contra una base local desechable. Si cambiaste datos de prueba, regrésalos.
5. **No instala nada sin preguntar:** paquetes (por ejemplo `@prisma/extension-read-replicas`), extensiones de la base ni imágenes de Docker.
6. **Sin secretos en el reporte.** De una URL de conexión muestra el host y máximo 4 caracteres de la contraseña.
7. **Costos con fecha y fuente.** Todo precio es un "estimado", con la fecha y la página de donde salió. Nunca un número suelto.
8. **Cada recomendación con su número.** Si no se pudo medir, escribe "sin medir" y qué falta. Nada de "la base está lenta".

| Pensamiento | Realidad |
|---|---|
| "Es solo un `SELECT` a producción para ver las estadísticas" | Producción la toca el usuario. Tú le das la consulta. |
| "Ya sé que necesita réplicas, lo pidió" | Mide primero. Si un índice lo resuelve, dilo con el número. |
| "El framework ya cambia de base solo" | El cambio automático no cubre trabajos en segundo plano, ni transacciones, ni APIs sin sesión. Revísalos. |
| "La copia va casi al día, no pasa nada" | Un cobro doble en medio segundo cuesta dinero real. Lo que mueve dinero o acceso, a la principal. |
| "Lo arreglo de una vez y luego le cuento" | Propón. Aplica uno por uno con permiso y mide después de cada cambio. |

## Proceso

1. **Entiende el sistema.** Anota: motor y versión (Postgres, MySQL), dónde vive (RDS, Aurora, Cloud SQL, Supabase, servidor propio),
   framework y ORM, cómo se conecta (variables, `database.yml`, `settings.py`, `config/database.php`, cliente de Node), si ya hay copia,
   agrupador de conexiones y tamaño del pool, trabajos en segundo plano y cómo se levanta la app en local.
   Marca las direcciones de producción como **prohibidas** (regla 1).
2. **Mide** ([medir.md](referencias/medir.md)). Pide al usuario los números de producción (consultas de solo lectura o capturas del panel).
   En local, levanta la app (regla 3) y toma sus estadísticas. Llena la tabla de números y decide con la tabla "Qué hacer según los números".
   Si los arreglos baratos bastan, dilo primero y con su efecto esperado.
3. **Revisa el código** ([codigo.md](referencias/codigo.md)). Haz el mapa de accesos (ruta → base hoy → base correcta).
   Busca lecturas tras escritura, revisar-y-actuar con dinero, trabajos encolados tras guardar, lecturas pesadas en la principal
   y qué pasa si la copia no responde. Anota archivo y línea.
4. **Comprueba en local.** Con la copia simulada por la app, Docker local ([docker.md](referencias/docker.md)) o una pausa de la copia,
   repite cada flujo sospechoso. Corre la carga con la herramienta, sin reinventarla ([carga.md](referencias/carga.md)):
   ```bash
   node <carpeta-de-esta-skill>/scripts/carga.mjs correr --plan carga/plan.json --url http://localhost:PUERTO --etiqueta antes
   ```
   Lo que no pudiste reproducir va a "Sin comprobar". Detén solo lo que levantaste.
5. **Arma el plan** ([armar.md](referencias/armar.md), [frameworks.md](referencias/frameworks.md)): servidores y tamaños, costo estimado
   (regla 7) contra la alternativa de subir un tamaño, configuración del framework, ventana de lectura tras escritura, plan B si una copia falla,
   qué pasa si cae la principal y qué se pierde, interruptor para mandar todo a la principal, y el orden de los pasos.
6. **Entrega el reporte** y pregunta qué aplicar. Tras cada cambio aprobado, corre la carga otra vez y `carga.mjs comparar`.

## Reporte

Partes, en este orden:

**1. Veredicto.** Una frase: *¿Necesitas copias?* **Sí** / **Todavía no** / **Primero esto**, con el número que lo decide.

**2. Números.** Tabla `Métrica | Valor | Fuente (producción vía usuario / local / sin medir) | Señal`.

**3. Antes de pagar copias.** Arreglos baratos (índice, N+1, agrupador de conexiones, subir un tamaño), cada uno con su efecto esperado.

**4. Hallazgos del código**, del más grave al menos grave, con este formato exacto:

```markdown
### 🔴 <qué le pasa al cliente, en palabras de negocio>
`<método y ruta o función>` · `<archivo>:<línea>`

- **Lo comprobé:** <qué flujo hiciste> → <qué respondió la app> (o "Sin comprobar: <razón>")
- **Por qué pasa:** <escribe en la principal y lee de la copia, que va N ms atrás>
- **Debe ir a:** principal | copia | copia con ventana de principal tras escribir
- **Arreglo:** <el cambio concreto, en una o dos líneas>
```

Gravedad: 🔴 dinero o acceso (cobro doble, login que falla) · 🟠 error visible (500, 404 tras crear, sin plan B) · 🟡 dato viejo en pantalla · ⚪ menor.

**5. Qué va a cada base.** Tabla `Ruta o función | Hoy | Debe ir a | Motivo`.

**6. Plan.** Servidores y tamaños · costo estimado al mes (con fecha y fuente) contra la alternativa · configuración del framework ·
si una copia falla · si cae la principal y qué se pierde · interruptor de emergencia · pasos en orden.
Una línea sobre cuándo tocaría repartir clientes en varias bases (sharding).

**7. Cómo repetir la prueba.** Comandos exactos de `carga.mjs` y de Docker, y dónde quedaron los resultados.

**8. Siguiente paso.** Una pregunta: *"¿Cuál aplico primero? Sugiero empezar por <el de más impacto y menos riesgo>."*

Escribe para alguien que programa pero no es experto en bases de datos: frases cortas, siglas explicadas,
el riesgo en clientes, dinero y tiempo. En los modos parciales entrega solo las partes que tocan, siempre con 1 y 8.

## Errores comunes

- **Recomendar copias sin medir.** Si el 60 % del tiempo es una consulta sin índice, la copia solo reparte el problema.
- **Contar consultas en lugar de tiempo.** 90 % de llamadas de lectura puede ser 30 % del tiempo. Decide por tiempo.
- **Olvidar los trabajos en segundo plano.** Se encolan justo después de guardar y leen de la copia antes de que llegue el dato.
- **Revisar-y-actuar en la copia.** "¿Ya se pagó?" en la copia = cobro doble. Va a la principal, y mejor atómico (`UPDATE … WHERE pagada = false`).
- **Copia sin plan B.** Si la copia se cae y no hay a dónde caer, se caen todos los listados.
- **Copia más chica que la principal.** Se atrasa con cada pico de escrituras.
- **Prometer "no se pierde nada" en un failover.** Con copias asíncronas se pierde lo que el retraso no alcanzó a copiar.
- **Precios sin fecha.** Cambian por región y cada año.
