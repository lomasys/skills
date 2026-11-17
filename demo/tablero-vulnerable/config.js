// Configuración de la demo. La clave de abajo es FALSA y está aquí a propósito:
// la skill debe detectar que hay un secreto escrito en el código.
module.exports = {
  port: Number(process.env.PORT || 4300),
  paymentsApiKey: 'demo_live_7f3a9c1e5b2d8f40a6c3e9b1d7f2a5c8',
  webhookSecret: 'whsec_demo_cambiame',
};
