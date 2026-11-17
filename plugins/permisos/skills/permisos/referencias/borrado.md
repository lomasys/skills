# Borrado completo de una cuenta

Cuando un cliente se va y pide que se borre su información (contrato, GDPR, ley de protección de datos), todo lo suyo debe
desaparecer o quedar anónimo, y **nada de otro cliente** se debe tocar. Lo que se queda es un riesgo legal y un costo de almacenamiento.

## 1. Inventario: dónde vive un cliente

Arma la lista antes de mirar el código de borrado. Para cada lugar, anota cómo se identifica lo del cliente.

| Lugar | Cómo encontrarlo |
|---|---|
| Tablas con `account_id` (o `tenant_id`, `organization_id`…) | `grep` del campo en migraciones/esquema; en Postgres `information_schema.columns` |
| Tablas que cuelgan de otras (comentarios de documentos de la cuenta) | llaves foráneas; revisa `ON DELETE` |
| Archivos (disco, S3, GCS, Active Storage, Media Library) | carpetas o prefijos por cuenta; tablas de adjuntos |
| Buscador (Elasticsearch, Meilisearch, Algolia, Typesense, columnas `tsvector`) | índices con el id de cuenta |
| Caché (Redis, Memcached) | llaves con el id de cuenta |
| Sesiones, tokens, llaves de API, invitaciones pendientes | tablas o almacén de sesiones |
| Colas y tareas programadas | trabajos pendientes con el id de cuenta |
| Servicios externos (pagos, correo, CRM, analítica) | el cliente en Stripe, la lista en el proveedor de correo |
| Bitácora y logs | ver abajo |
| Respaldos | ver abajo |

## 2. Qué hacer con cada cosa

- **Borrar:** datos del cliente, archivos, entradas del buscador, caché, sesiones, tokens, trabajos pendientes.
- **Anonimizar en lugar de borrar** cuando otra cosa depende del registro: facturas (la ley suele exigir conservarlas),
  la bitácora (se conserva el hecho, se quita el nombre y el correo), métricas agregadas.
- **Respaldos:** normalmente no se editan. Lo correcto es una política escrita: "los respaldos caducan en N días y,
  si se restaura uno, se vuelve a correr el borrado de las cuentas borradas". Si no existe esa política, es un hallazgo "Por decidir".
- **Borrado lógico** (`deleted_at`): no cuenta como borrado. Puede ser un primer paso con un borrado real programado.

La retención de la bitácora y las facturas es una decisión de negocio y legal: **pregúntala**, no la decidas tú.

## 3. Cómo verificarlo (solo local o pruebas)

1. Crea una **cuenta desechable** con datos en cada lugar del inventario: usuarios, registros, un archivo, algo indexado en el buscador,
   algo en caché, una sesión abierta. Crea también datos en **otra cuenta de control**.
2. Toma una foto "antes": cuenta lo que hay de cada cuenta en cada lugar.
3. Corre el borrado de la cuenta desechable **por el camino real** (la ruta o el comando que usa la app).
4. Toma la foto "después" y compara:
   - de la cuenta borrada debe quedar **cero** (o solo lo anonimizado que acordó el negocio);
   - de la cuenta de control debe quedar **exactamente lo mismo** que antes;
   - la sesión abierta de la cuenta borrada ya no debe servir.
5. Convierte la verificación en una prueba automática con esos mismos pasos. Debe fallar hoy si queda algo.

Para crear la cuenta desechable usa la ruta de registro de la app, o las factories y fixtures del proyecto. Si no hay ninguna,
créala directo en los datos de prueba y dilo en el reporte. La preparación puede ir por atajo; **el borrado siempre va por el camino real**.

Nunca verifiques borrando una cuenta del seed que otras pruebas usan, ni en una base que no sea de pruebas.

## Ejemplo de prueba (Node)

```js
test('borrar una cuenta no deja nada suyo y no toca la de otros', async () => {
  const { app, base, cerrar } = await arrancar();               // datos y carpeta temporal nuevos
  try {
    const desechable = await crearCuentaDesechable(app);        // usuarios, documentos, archivo, buscador, caché
    const antesB = foto(app, 2);                                // la cuenta de control
    const cookie = await entrar(base, desechable.emailAdmin);
    assert.strictEqual((await fetch(`${base}/api/cuenta`, { method: 'DELETE', headers: { cookie } })).status, 200);
    assert.deepStrictEqual(foto(app, desechable.id), { usuarios: 0, documentos: 0, archivos: 0, indice: 0, cache: 0 });
    assert.deepStrictEqual(foto(app, 2), antesB);
    assert.strictEqual((await fetch(`${base}/api/yo`, { headers: { cookie } })).status, 401);
  } finally { cerrar(); }
});
```

En Rails, Django o Laravel, la "foto" es un conteo por tabla con `where(account_id:)`, más la lista de archivos del almacén
de pruebas (`ActiveStorage::Blob`, `Storage::fake()`, `MEDIA_ROOT` temporal) y las llaves de Redis de pruebas con el prefijo de la cuenta.
