# Producción

- Postgres 16 administrado. Tamaño aproximado (datos inventados para la demo):

  | Tabla | Filas | Tamaño |
  |---|---|---|
  | `clientes` | 1.2 millones | 400 MB |
  | `pedidos` | 42 millones | 18 GB |
  | `partidas_pedido` | 95 millones | 31 GB |

- Se vende las 24 horas; el pico es de 19:00 a 23:00.
- Despliegue: `npm run migrate` y después se reinician los servidores uno por uno.
  Durante unos 10 minutos corren al mismo tiempo la versión vieja y la nueva del código.
- Respaldo diario con `pg_dump -Fc` a `respaldos/tienda-AAAA-MM-DD.dump`. Nunca se ha probado restaurarlo.
