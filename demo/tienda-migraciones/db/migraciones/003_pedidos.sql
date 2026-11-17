CREATE TABLE pedidos (
  id          bigserial PRIMARY KEY,
  cliente_id  bigint NOT NULL,
  estado      text NOT NULL DEFAULT 'nuevo',
  total       numeric(12,2) NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
