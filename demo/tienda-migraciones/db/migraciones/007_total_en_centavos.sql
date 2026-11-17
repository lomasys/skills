-- Guardar el total en centavos, como entero, para no tener problemas de redondeo.
ALTER TABLE pedidos ALTER COLUMN total TYPE integer USING total::integer;
