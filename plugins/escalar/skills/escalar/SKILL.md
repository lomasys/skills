---
name: escalar
description: Use when the user expects to grow to thousands of customers or users and asks whether the system will hold up (aguantar, escalar, crecer, miles de clientes, se cae en hora pico, se pone lento con mucho tráfico), wants a load or stress test (prueba de carga, prueba de estrés, cuántos usuarios aguanta), asks what to cache or how to use Redis, needs background jobs or queues (Sidekiq, Celery, BullMQ, Laravel queues, correos lentos, reintentos que duplican pedidos), asks what happens if the database, Redis or a server goes down (caídas, timeouts, circuit breaker, health checks), wants to move uploads to S3 or a CDN, or wants to know how much each customer costs in servers to set prices (costo por cliente).
---

# Escalar

Prepara un sistema para pasar de decenas a miles de clientes: mide en local qué truena primero, propone los cambios por prioridad
(caché, colas, caídas, archivos) y calcula cuánto cuesta cada cliente en servidores.

**Principio:** lo que truena primero se mide, no se adivina. Y una caché rápida que enseña datos de otro cliente es peor que una lenta.

## Modos

| Argumento | Qué hace |
|---|---|
| *(nada)* | Diagnóstico completo: meta de carga, prueba por escalones, revisión de los seis temas y plan por prioridad |
| `cache` | Qué guardar en caché, por cuánto tiempo, con qué llave y cómo borrarlo. [referencias/cache.md](referencias/cache.md) |
| `colas` | Qué sacar de la petición a segundo plano y cómo reintentar sin duplicar. [referencias/colas.md](referencias/colas.md) |
| `carga` | Solo la prueba de carga y qué truena primero. [referencias/carga.md](referencias/carga.md) |
| `caidas` | Qué pasa si se cae la base, Redis, un servicio externo o un servidor, y si se recupera sola. [referencias/caidas.md](referencias/caidas.md) |
| `archivos` | Sacar imágenes y archivos a almacenamiento externo con CDN. [referencias/archivos.md](referencias/archivos.md) |
| `costo` | Costo por cliente y hoja para poner precios. [referencias/costo.md](referencias/costo.md) |

Fuera de esta skill: réplicas, índices y particiones de la base van en la skill `base-miles-de-clientes`;
encontrar por qué una ruta es lenta (perfilar, consultas N+1) va en la skill `rendimiento`. Enlázalas por nombre; no repitas su trabajo.

## Reglas (no negociables)

1. **Carga solo contra local o pruebas.** Nunca contra producción ni contra dominios de terceros (pagos, correo, mapas, APIs de otros).
   Usa siempre `scripts/carga.mjs`: se niega a hosts no locales. Para un ambiente de pruebas remoto, pide al usuario por escrito
   el nombre exacto del host y que confirme que **no** es producción; solo entonces usa `--permitir-host` y `--confirmo` (techo de 50 peticiones por segundo).
2. **Sin efectos reales.** Antes de cargar una ruta que escribe, revisa qué dispara: correos, cobros, SMS, webhooks, avisos al equipo.
   Si llama a un servicio real, déjala fuera o usa su modo de pruebas. Usa cuentas de prueba y, al terminar, regresa los datos como estaban.
3. **No cambias código, configuración ni infraestructura sin permiso.** Ni servidores, ni planes, ni DNS, ni CDN.
   Propones; aplicas solo lo que el usuario apruebe, uno por uno. Sí puedes crear la carpeta `carga/` con el escenario, los resultados y la hoja de costos.
4. **Solo apagas lo que tú prendiste.** Levanta la app en un puerto libre y guarda su PID. Si apagas una base o Redis para probar caídas,
   que sea un contenedor que tú levantaste. Nunca `taskkill /IM`, `killall` ni `pkill`. Si una prueba dejó la app colgada, reinicia tu PID y dilo en el reporte.
5. **No instalas nada sin preguntar** (k6, Artillery, Redis, librerías). La herramienta de la skill no necesita nada.
6. **Cada precio con fecha y fuente.** Primero la factura del usuario; luego la página oficial de precios consultada hoy; si no, un estimado marcado como "estimado".
   Nunca un precio "de memoria" sin decirlo.
7. **No copies secretos.** De tokens y claves, máximo los primeros 4 caracteres.

| Pensamiento | Realidad |
|---|---|
| "Pruebo con 1 000 usuarios sin pausa y ya" | 1 000 usuarios golpeando sin parar no son 1 000 clientes. Calcula la meta con `objetivo`. |
| "Es staging, no pasa nada" | Staging suele mandar correos reales y compartir servicios. Solo con permiso escrito y el host exacto. |
| "Agrego Redis y listo" | Primero la llave con el id del cliente y cómo se borra. Una caché mal hecha mezcla clientes. |
| "Ya acabó la prueba, todo bien" | Mira la app 60 segundos después: puede seguir trabada con trabajo abandonado. |
| "El servidor cuesta 40, entre 120 clientes…" | El promedio esconde al cliente grande. Calcula por tipo de cliente. |

## Proceso

1. **Entiende el sistema.** Identifica:
   - el stack, cómo se levanta y qué servicios usa (base, Redis, colas, almacenamiento, correo, pagos, APIs externas);
   - qué separa a un cliente de otro (cuenta, empresa, organización, tenant);
   - las rutas que más se usan y las que escriben;
   - la infraestructura y lo que se paga hoy (factura, `docker-compose.yml`, archivos de despliegue).
2. **Fija la meta.** Convierte clientes del negocio en usuarios simultáneos y peticiones por segundo:
   `node <carpeta-de-esta-skill>/scripts/carga.mjs objetivo --clientes 5000 --clientes-hoy 120 --peticiones-mes 900000`.
   Saca las peticiones al mes de registros, analítica o la factura del balanceador. Si no hay datos, `objetivo` usa supuestos: dilo en el reporte.
   Si el usuario pide un número de usuarios (por ejemplo 1 000), inclúyelo como escalón además de los que sugiere `objetivo`.
3. **Revisa el código** según el modo, con la lista de cada referencia. Anota cada problema con archivo y línea.
4. **Levanta la app** (regla 4) con los servicios externos apagados, simulados o en modo de pruebas (regla 2).
5. **Prueba de carga por escalones** siguiendo [referencias/carga.md](referencias/carga.md):
   escribe `carga/escenario.json` con la mezcla real de rutas y dos cuentas de prueba (A y B) con `verifica_marca`, y corre
   `node <carpeta-de-esta-skill>/scripts/carga.mjs correr --escenario carga/escenario.json --escalones <los de objetivo> --pausa <la de objetivo> --etiqueta linea-base`.
   Se detiene en el primer escalón que se rompe: ese es el resultado. Para ver cómo falla más arriba, corre esos escalones aparte con `--etiqueta mas-alla`
   y sin cambiar `--timeout`; la herramienta sigue marcando las rutas rotas.
   Mientras corre, mira CPU y memoria del proceso de la app y, si puedes, el pool de conexiones y la fila de la cola.
   Al terminar, pide `/salud` y una ruta normal cada 5 segundos durante 60 segundos: ¿se recupera sola?
6. **Prueba las caídas** que se puedan hacer en local ([referencias/caidas.md](referencias/caidas.md)): ¿cuánto tarda en fallar?, ¿qué ve el cliente?,
   ¿el health check se entera?, ¿se recupera sola cuando el servicio vuelve? Lo que no puedas simular queda "Sin comprobar".
7. **Calcula el costo por cliente** con [referencias/costo.md](referencias/costo.md) y deja la hoja en `carga/costo-por-cliente.csv`.
8. **Deja todo como estaba:** detén tu PID, regresa los datos de prueba, vuelve a encender lo que apagaste. Entrega el reporte.
9. **Pregunta** qué cambio aplicar primero. Después de cada cambio aprobado, repite la misma corrida y compáralas:
   `node <carpeta-de-esta-skill>/scripts/carga.mjs comparar carga/resultados/<antes>.json carga/resultados/<despues>.json`.

## Reporte

El reporte tiene estas partes, en este orden:

**1. Veredicto.** Dos o tres oraciones: cuántos usuarios simultáneos aguanta hoy (≈ cuántos clientes), qué se rompe primero y la meta.

**2. Prueba de carga.** La tabla de escalones de la herramienta (usuarios, peticiones por segundo, errores, p50, p95) y si la app se recuperó sola después.
Explica p95 una vez: "el 95 % de las peticiones tardó menos que esto".

**3. Plan por prioridad**, de P1 a P4. Cada punto con este formato exacto:

```markdown
### 🔴 P1: <qué le pasa al cliente, en palabras de negocio>
`<ruta o función>` · `<archivo>:<línea>`

- **Lo medí:** <corrida o petición> → <qué pasó, con números>
- **Por qué pasa:** <una línea>
- **Cambio:** <lo concreto, en una o dos líneas; ejemplo en la referencia del tema>
- **Cómo sabremos que funcionó:** <la misma corrida, qué número debe cambiar>
- **Costo extra:** <USD/mes estimado, fuente y fecha, o "ninguno"> · **Esfuerzo:** <horas o días>
```

Prioridad: 🔴 **P1** (mezcla datos de clientes, duplica pedidos o dinero, o la app no se recupera sola) · 🟠 **P2** (se cae antes de la meta) ·
🟡 **P3** (lento o caro, pero aguanta) · ⚪ **P4** (para cuando crezca más).

**4. Plan de caídas.** Tabla: `Qué se cae | Qué pasa hoy | Comprobado o sin comprobar | Qué debería pasar`.

**5. Costo por cliente.** La fórmula con los números puestos, una tabla por tipo de cliente (normal y grande),
cada precio con fecha y fuente, y qué significa para los precios o límites de cada plan.

**6. Sin comprobar.** Lo que no se pudo medir y por qué (depende de producción, no hay Docker, el servicio no se puede simular).

**7. Cómo repetirlo.** Los comandos exactos de `correr` y `comparar`, y dónde quedaron el escenario, los resultados y la hoja de costos.

**8. Siguiente paso.** Una pregunta: *"¿Empiezo por el P1? Después corro la misma prueba y te muestro la diferencia."*

En un modo de un solo tema, entrega solo las partes que apliquen (siempre 1, 3, 6 y 8).
Escribe para alguien que programa pero no es experto en infraestructura: frases cortas, sin siglas sin explicar,
el riesgo en clientes, dinero y tiempo.

## Errores comunes

- **Confundir clientes con usuarios simultáneos.** 5 000 clientes pueden ser 300 usuarios a la vez o 3 000. Usa `objetivo` y di los supuestos.
- **Una prueba de carga que manda correos o cobra de verdad.** Revisa qué dispara cada ruta que escribe antes de cargarla.
- **Medir solo durante la prueba.** Si la app no se recupera sola después, ese es el hallazgo más importante.
- **Caché sin el id del cliente en la llave**, o que solo se borra cuando caduca. Se ven datos de otro o datos viejos.
- **Reintentos sin idempotencia.** Un correo lento que falla dentro de la petición hace que el cliente reintente y el pedido se duplique.
- **Reintentar de inmediato y sin límite.** Convierte una caída de 10 segundos en una de 10 minutos.
- **Un health check que siempre dice "ok"**, o uno que reinicia todos los servidores porque un servicio externo falló.
- **El generador saturado.** Si la herramienta avisa que usó más del 85 % de un núcleo, los números miden tu máquina, no la app.
- **Costo promedio.** Esconde al cliente grande que paga el plan barato. Calcula por tipo de cliente.
