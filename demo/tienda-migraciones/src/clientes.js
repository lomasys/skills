import { query } from './db.js';

export async function buscarPorEmail(email) {
  const { rows } = await query('SELECT id, nombre, email, telefono FROM clientes WHERE lower(email) = lower($1)', [email]);
  return rows[0];
}

// El correo debe ser único. Lo revisamos aquí antes de guardar.
export async function crearCliente({ nombre, email, telefono }) {
  if (await buscarPorEmail(email)) throw new Error('Ese correo ya está registrado');
  const { rows } = await query(
    'INSERT INTO clientes (nombre, email, telefono) VALUES ($1, $2, $3) RETURNING id',
    [nombre, email, telefono],
  );
  return rows[0].id;
}

export async function actualizarTelefono(id, telefono) {
  await query('UPDATE clientes SET telefono = $1 WHERE id = $2', [telefono, id]);
}

export async function borrarCliente(id) {
  await query('DELETE FROM clientes WHERE id = $1', [id]);
}
