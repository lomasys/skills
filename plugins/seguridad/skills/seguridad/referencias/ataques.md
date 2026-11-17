# Cómo comprobar cada tipo de hoyo

Cada receta dice **qué buscar en el código**, **cómo comprobarlo contra la app local** y **qué prueba dejar**.
Todas las peticiones van solo a `localhost`, `127.0.0.1` o un contenedor local.

Antes de empezar, prepara **dos cuentas (A y B)** y, en A, **dos roles** (admin y miembro).
Usa los datos de prueba del proyecto (seeds, fixtures, factories). Si no existen, créalos en la base local de desarrollo y avísalo en el reporte.

---

## 1. Fuga entre cuentas (multi-tenant)

**Busca:** consultas que encuentran un registro **solo por id** (`find(id)`, `findById`, `WHERE id = ?`, `Model.find(params[:id])`)
en recursos que pertenecen a una cuenta. Compáralas con las rutas que sí filtran (`current_account.boards.find`, `where(account_id:)`).
Revisa también listados, exportaciones, búsquedas, contadores, adjuntos y trabajos en segundo plano.

**Comprueba:** inicia sesión como A y pide un recurso de B por su id, en cada verbo (GET, PATCH/PUT, DELETE y acciones especiales).
- `200` con datos de B → **comprobado**.
- `404` o `403` → **seguro**.
- PATCH que devuelve `200` → confirma con un GET de B que el cambio quedó, y después **regrésalo como estaba**.

**Prueba a dejar:** usuario de A pide el recurso de B y espera 404/403. Debe fallar hoy.

## 2. Permisos dentro de la cuenta

**Busca:** acciones de administrador (borrar usuarios, cambiar roles, facturación, exportar todo) que el servidor no protege y que solo esconde el front.

**Comprueba:** con el rol miembro llama directo a la acción de admin. Si funciona → **comprobado**.
Usa un registro desechable que tú creaste, nunca uno que el usuario necesite.

**Prueba a dejar:** el miembro recibe 403 en esa acción.

## 3. Enlaces públicos

**Busca:** rutas sin login que muestran datos (`/share/:id`, `/public/`, `/compartir/`, tokens en la URL).

**Comprueba:**
- **¿Se puede adivinar?** Si el id es consecutivo o corto, pide `id+1` e `id-1`. Si sale otro recurso → **comprobado**.
- **¿Caduca?** Busca fecha de expiración en el código. Si no hay ninguna → hallazgo (no hace falta esperar).
- **¿Qué muestra?** Lista los campos que regresa. Correos, teléfonos o datos internos → hallazgo.

**Prueba a dejar:** el enlace consecutivo no abre otro recurso; la respuesta no incluye campos privados.

## 4. Secretos en el código

**Busca:** `gitleaks detect` o `trufflehog filesystem .` si están instalados. Si no, busca patrones como
`(api|secret|token|password|passwd|key)\s*[:=]\s*['"][^'"]{12,}`, archivos `.env` versionados (`git ls-files | grep -i env`)
y llaves privadas (`BEGIN .* PRIVATE KEY`). Revisa también el historial: `git log -p -S '<fragmento>'`.

**Comprueba:** no hace falta atacar. Confirma que el valor **no es un ejemplo** (`changeme`, `xxx`, `<tu-clave>`) y que no viene de una variable de entorno.
**Nunca copies el secreto completo en el reporte**: muestra solo los primeros 4 caracteres.

**Arreglo:** moverlo a variable de entorno **y rotarlo**, porque ya quedó en el historial de git.

**Prueba a dejar:** opcional. Puede ser una prueba que falle si el archivo de configuración contiene un valor literal.

## 5. Entradas peligrosas

| Tipo | Busca | Comprueba con |
|---|---|---|
| XSS | HTML armado con texto del usuario sin escapar (`innerHTML`, plantillas con `${}`, `html_safe`, `raw`, `dangerouslySetInnerHTML`) | `q=<img src=x onerror=alert(1)>` y revisa si la respuesta lo trae **sin escapar** |
| Inyección SQL | SQL armado con concatenación o interpolación | `'` y `' OR '1'='1` en el parámetro. Un error de SQL o resultados de más → comprobado. **Nunca** `DROP`, `DELETE` ni `UPDATE` |
| Redirección abierta | `Location`/`redirect_to` con un valor que manda el usuario | `?to=https://ejemplo-externo.test` → `302` con ese `Location` |
| Archivos | Subidas sin validar tipo, tamaño o nombre | Sube un `.html` o `.svg` con script, o un nombre con `../` |

**Prueba a dejar:** la entrada maliciosa vuelve escapada, rechazada o redirigida a una ruta interna.

## 6. Login y abuso

**Busca:** límite de intentos (rate limit) en login, registro, recuperar contraseña y API. Revisa los atributos de la cookie de sesión.

**Comprueba:**
- Manda **20** intentos fallidos seguidos al login local. Si ninguno se bloquea ni se frena → **comprobado**. No mandes más.
- Revisa `Set-Cookie`: si falta `HttpOnly`, `SameSite` o (en producción) `Secure` → hallazgo.

**Prueba a dejar:** después de N intentos fallidos el login responde 429.

## 7. Webhooks

**Busca:** rutas que reciben avisos externos (pagos, correo, mensajería).

**Comprueba:**
- **Firma:** manda el evento **sin firma** o con una firma inventada. Si lo procesa → **comprobado**.
- **Duplicados:** manda el **mismo** evento dos veces. Si el efecto se aplica dos veces (por ejemplo, créditos sumados dos veces) → **comprobado**.

Usa una cuenta de prueba y regrésala como estaba.

**Prueba a dejar:** sin firma → 401/400; el evento repetido no cambia nada.

## 8. Dependencias

**Busca:** corre lo que exista: `npm audit --json`, `pnpm audit`, `yarn npm audit`, `bundle exec bundler-audit`, `pip-audit`, `govulncheck ./...`, `cargo audit`.
No instales herramientas sin preguntar.

**Filtra:** para cada falla grave, busca si el proyecto **usa** la función o el módulo afectado.
- Sí la usa → hallazgo con la ruta del código.
- No la usa → va a la sección "baja prioridad", con la explicación.

## 9. Configuración

**Comprueba:** pide `/` y una ruta de API a la app local y revisa los encabezados:
`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options` o `frame-ancestors`, `Referrer-Policy` y,
en producción, `Strict-Transport-Security`. Revisa también CORS: manda `Origin: https://otro.test`. Si responde con
`Access-Control-Allow-Origin: https://otro.test` **y** `Allow-Credentials: true` → **comprobado**.

---

## Si la app no levanta

Intenta los comandos del proyecto (`package.json`, `Procfile`, `docker-compose.yml`, `bin/dev`, README).
Si después de dos intentos no levanta, **no sigas peleando con ella**:
haz solo la revisión de código, marca cada hallazgo como **"Sin comprobar"** y explica qué faltó para levantarla.
