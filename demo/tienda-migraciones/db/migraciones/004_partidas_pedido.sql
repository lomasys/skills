CREATE TABLE partidas_pedido (
  id           bigserial PRIMARY KEY,
  pedido_id    bigint NOT NULL,
  producto_id  bigint NOT NULL,
  cantidad     integer NOT NULL,
  precio       numeric(10,2) NOT NULL
);
