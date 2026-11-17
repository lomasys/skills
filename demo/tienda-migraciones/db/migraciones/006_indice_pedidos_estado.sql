-- El tablero de pendientes está lento.
CREATE INDEX pedidos_estado_idx ON pedidos (estado);
