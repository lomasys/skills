# Quién usa nuestra API

- **App móvil** (repositorio aparte): llama `POST /api/total` con `{ "articulos": [...], "cupon": "..." }`
  y lee el campo `total` como número con dos decimales.
- **Contabilidad**: recibe cada noche el resultado del trabajo `cierre-diario`.
