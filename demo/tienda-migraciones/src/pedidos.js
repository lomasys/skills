import { query } from './db.js';

// "Mis pedidos": la pantalla más visitada.
export async function pedidosDeCliente(clienteId) {
  const { rows } = await query(
    'SELECT id, estado, total, creado_en FROM pedidos WHERE cliente_id = $1 ORDER BY creado_en DESC LIMIT 20',
    [clienteId],
  );
  return rows.map(p => ({ ...p, total: `$${Number(p.total).toFixed(2)}` }));
}

// Tablero de pendientes del almacén.
export async function pendientes() {
  const { rows } = await query("SELECT id, cliente_id, total FROM pedidos WHERE estado = 'nuevo' ORDER BY creado_en LIMIT 100");
  return rows;
}

export async function detalle(pedidoId) {
  const { rows } = await query(
    `SELECT pp.cantidad, pp.precio, pr.nombre
       FROM partidas_pedido pp JOIN productos pr ON pr.id = pp.producto_id
      WHERE pp.pedido_id = $1`,
    [pedidoId],
  );
  return rows;
}

export async function cobrar(pedidoId, monto) {
  // monto llega con centavos, por ejemplo 1499.90
  await query("UPDATE pedidos SET estado = 'pagado', total = $2 WHERE id = $1", [pedidoId, monto]);
}
