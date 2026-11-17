# Archivos y CDN

Las imágenes y documentos no deben vivir en el disco ni en la memoria del servidor de la app. Si viven ahí:
se pierden al reiniciar o cambiar de servidor, no puedes poner un segundo servidor, llenan la memoria y cada descarga ocupa a la app.

## Qué buscar en el código

- Archivos guardados en una carpeta local (`public/uploads`, `storage/app`, `MEDIA_ROOT`) o en memoria.
- Archivos guardados dentro de la base (columnas `bytea`/`BLOB`/base64).
- Rutas de la app que leen el archivo y lo mandan (`res.sendFile`, `send_file`, `FileResponse`, `response()->file`).
- Subidas que pasan completas por la app (base64 en JSON, `multipart` sin límite de tamaño).
- Descargas sin `Cache-Control`.

## El cambio

1. **Almacenamiento de objetos** (S3, Cloudflare R2, Google Cloud Storage, Azure Blob, DigitalOcean Spaces, o MinIO en local para probar).
   Llave del archivo con el cliente primero: `cuentas/<cuenta_id>/<uuid>-<nombre>`.
2. **Subida directa con URL firmada.** La app revisa permisos y tamaño, genera una URL firmada que caduca en minutos, y el navegador sube directo al almacenamiento.
   La app solo guarda la llave en la base.
3. **Descarga por CDN.** Archivos públicos (logos, imágenes de producto): CDN con `Cache-Control: public, max-age=31536000, immutable` y un nombre que cambia si cambia el archivo.
   Archivos privados (facturas, documentos): URL firmada de corta duración, nunca un bucket público.
4. **Lo pesado, en una cola:** miniaturas, conversión de formatos, revisión de virus.
5. **Migración sin perder nada:** copia los archivos existentes, guarda la llave nueva junto a la vieja, cambia la lectura, y borra lo viejo solo cuando el usuario lo apruebe.

## Ejemplos por stack

- **Rails:** Active Storage con servicio `amazon`/`google` y `direct_upload: true`.
- **Django:** `django-storages` con `S3Storage`; URLs firmadas con `generate_presigned_url` de boto3.
- **Laravel:** disco `s3` en `config/filesystems.php`; `Storage::temporaryUrl()` y `Storage::temporaryUploadUrl()`.
- **Node:** `@aws-sdk/client-s3` y `@aws-sdk/s3-request-presigner` (`getSignedUrl` con `PutObjectCommand`).

Cualquier paquete nuevo, se pregunta antes de instalarlo.

## Riesgos al hacerlo

- Bucket público por error: todos los archivos de todos los clientes, a la vista. Bloquea el acceso público y usa URLs firmadas.
- URL firmada sin revisar permisos antes: la firma solo prueba que la app la emitió; la app debe revisar que ese usuario puede ver ese archivo.
- CDN guardando respuestas privadas: nunca pongas `public` en algo que depende de quién lo pide.

## Cómo comprobarlo

- La memoria del proceso de la app no sube al subir archivos en la prueba de carga.
- La descarga trae `Cache-Control` y, en pruebas con CDN, la segunda descarga sale del CDN (encabezado tipo `x-cache: HIT`).
- Con dos instancias de la app, un archivo subido en una se descarga desde la otra.
