-- Crea la base de la demo: migraciones 001 a 004 ya aplicadas y datos de ejemplo.
-- Lo corre Docker solo la primera vez que crea el volumen (ver docker-compose.yml).
-- Todos los datos son inventados: correos @ejemplo.test y teléfonos 0000.

CREATE TABLE schema_migrations (version text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now());

\i /demo/migraciones/001_clientes.sql
\i /demo/migraciones/002_productos.sql
\i /demo/migraciones/003_pedidos.sql
\i /demo/migraciones/004_partidas_pedido.sql
INSERT INTO schema_migrations (version) VALUES ('001'), ('002'), ('003'), ('004');

-- 20 000 clientes. 2 % sin correo. 40 correos repetidos con otra capitalización.
INSERT INTO clientes (nombre, email, telefono, creado_en)
SELECT 'Cliente ' || g,
       CASE WHEN g % 50 = 0 THEN NULL ELSE 'cliente' || g || '@ejemplo.test' END,
       '+52 55 0000 ' || lpad((g % 10000)::text, 4, '0'),
       now() - (g || ' minutes')::interval * 30
FROM generate_series(1, 20000) g;

INSERT INTO clientes (nombre, email, telefono)
SELECT 'Cliente repetido ' || g, 'Cliente' || g || '@Ejemplo.test', NULL
FROM generate_series(1, 40) g;

-- 300 productos.
INSERT INTO productos (nombre, precio)
SELECT 'Producto ' || g, round((50 + random() * 2000)::numeric, 2)
FROM generate_series(1, 300) g;

-- 300 000 pedidos. La mayoría entregados; pocos nuevos.
INSERT INTO pedidos (cliente_id, estado, total, creado_en)
SELECT 1 + (random() * 19999)::int,
       CASE WHEN r < 0.90 THEN 'entregado' WHEN r < 0.96 THEN 'cancelado' WHEN r < 0.98 THEN 'pagado' ELSE 'nuevo' END,
       round((100 + random() * 5000)::numeric, 2),
       now() - (random() * 730 || ' days')::interval
FROM (SELECT random() AS r FROM generate_series(1, 300000)) s;

-- 600 000 partidas.
INSERT INTO partidas_pedido (pedido_id, producto_id, cantidad, precio)
SELECT 1 + (random() * 299999)::int, 1 + (random() * 299)::int, 1 + (random() * 4)::int, round((50 + random() * 2000)::numeric, 2)
FROM generate_series(1, 600000);

-- Así borra la app (src/clientes.js): sin revisar pedidos ni partidas. Deja huérfanos.
DELETE FROM clientes WHERE id IN (SELECT id FROM clientes WHERE id BETWEEN 1 AND 20000 ORDER BY id DESC LIMIT 150);
DELETE FROM productos WHERE id IN (7, 77, 177);

ANALYZE;
