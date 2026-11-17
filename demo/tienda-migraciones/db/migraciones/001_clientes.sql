CREATE TABLE clientes (
  id         bigserial PRIMARY KEY,
  nombre     text NOT NULL,
  email      text,
  telefono   text,
  creado_en  timestamptz NOT NULL DEFAULT now()
);
