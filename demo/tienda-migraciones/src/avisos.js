import { query } from './db.js';

// Aviso por SMS cuando el pedido sale del almacén. Los clientes sin correo solo reciben este.
export async function avisarEnvio(pedidoId) {
  const { rows } = await query(
    'SELECT c.telefono, c.email FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = $1',
    [pedidoId],
  );
  const cliente = rows[0];
  if (cliente?.telefono) return { canal: 'sms', destino: cliente.telefono };
  return { canal: 'correo', destino: cliente?.email };
}
