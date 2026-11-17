// Acceso a la base. En la app real esto usa el paquete `pg` con DATABASE_URL.
// La demo no necesita correr la app: el código está para que se vea qué columnas y consultas usa.
export async function query(sql, params = []) {
  throw new Error('Demo: conecta aquí tu cliente de Postgres. ' + sql.slice(0, 40) + ' ' + params.length);
}
