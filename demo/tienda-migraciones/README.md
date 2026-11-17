# Tienda con migraciones peligrosas

Mini tienda con **migraciones peligrosas a propósito**, para ver trabajar la skill [migraciones](../../plugins/migraciones/skills/migraciones/SKILL.md).
Hay cuatro migraciones pendientes (005 a 008) y el equipo quiere correrlas esta noche.

## Correr

La revisión de migraciones no necesita nada instalado: son archivos SQL y código Node.
Para los modos que consultan la base (`indices`, `huerfanos`, `reglas`) hace falta Docker:

```bash
docker compose up -d                 # Postgres 16 en 127.0.0.1:54329 (usuario, clave y base: tienda)
                                     # la primera vez carga ~1 millón de filas inventadas (unos 30 segundos)
node migrar.mjs --estado             # muestra las pendientes, sin aplicar nada
```

`node migrar.mjs` (sin `--estado`) **aplica** las pendientes. Úsalo solo si quieres ver el daño con tus propios ojos.
`docker compose down -v` borra la base de la demo; la siguiente vez se crea de nuevo.

Datos de "producción" para estimar: [docs/produccion.md](docs/produccion.md). Consultas lentas: [logs/consultas-lentas.log](logs/consultas-lentas.log).
Todos los datos son inventados: correos `@ejemplo.test` y teléfonos `0000`.

## Reto

Antes de correr `/migraciones:migraciones`, intenta encontrar los problemas tú. Hay al menos **diez**.

<details>
<summary>Ver la lista (spoiler)</summary>

1. **005** borra `clientes.telefono`, pero `src/clientes.js` y `src/avisos.js` lo usan: el código viejo y el nuevo fallan, y los clientes sin correo se quedan sin aviso.
2. **005** no se puede deshacer: los teléfonos se pierden (y el respaldo nunca se ha probado).
3. **006** crea un índice sin `CONCURRENTLY` sobre una tabla de 18 GB: no se pueden crear ni cobrar pedidos mientras se construye.
4. **006** además es el índice equivocado: `estado` tiene 4 valores y la consulta ordena por fecha; conviene un índice parcial.
5. **007** convierte `total` a entero **redondeando**: 1499.90 queda en 1500, no en 149990 centavos.
6. **007** reescribe toda la tabla `pedidos` con un candado que bloquea también las lecturas.
7. **007** rompe `cobrar()` y `pedidosDeCliente()`, que siguen usando pesos con decimales.
8. **008** sí es segura (columna opcional sin default). Una buena revisión lo dice.
9. Ninguna migración tiene `lock_timeout`.
10. Índices que faltan según el log: `pedidos (cliente_id, creado_en)`, `partidas_pedido (pedido_id)`, `clientes (lower(email))`.
11. Huérfanos: pedidos de 150 clientes borrados (`borrarCliente()` no revisa nada) y partidas de 3 productos borrados.
12. Reglas que solo vigila el código: correo único (hay 40 repetidos por mayúsculas), y ninguna llave foránea.
13. El despliegue corre `npm run migrate` en hora pico y el respaldo diario nunca se ha restaurado.

</details>
