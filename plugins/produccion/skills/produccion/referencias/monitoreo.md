# Monitoreo mínimo

Meta: enterarse **antes que los clientes**, con pocas alertas que sí se atienden. Cada alerta necesita:
qué mide, el umbral, a quién le llega (un canal que sí se ve: celular, Telegram, Slack) y qué hacer cuando suena.

Antes de recomendar, revisa qué ya existe: manifiesto de despliegue, `healthCheckPath`, dependencias de Sentry o similares,
cron jobs, colas (Sidekiq, Celery, BullMQ, Horizon), base de datos administrada, dominio propio.
No instales nada ni crees cuentas: das la configuración y el usuario la aplica.

## Las seis alertas

| # | Alerta | Mide | Umbral para empezar | Opciones baratas o gratis |
|---|---|---|---|---|
| 1 | **Caída** | Una petición a `/salud` (o la portada) desde fuera | 2 fallas seguidas | UptimeRobot, Better Stack, Uptime Kuma (propio), el chequeo de salud de la plataforma |
| 2 | **Lentitud** | Tiempo de respuesta de la página o ruta principal | > 2 s por 5 min | El mismo monitor externo (casi todos miden tiempo), métricas de la plataforma |
| 3 | **Tasa de errores** | % de respuestas 5xx o errores nuevos | > 2 % en 5 min, o error nuevo | Sentry, GlitchTip (propio), Rollbar, Honeybadger: todos tienen plan gratis o barato |
| 4 | **Cola atorada** | Trabajos esperando o el último trabajo que terminó | > N en espera por 10 min, o sin latido en 2× su periodo | Healthchecks.io o Cronitor (latidos), el panel de la cola |
| 5 | **Disco o base llena** | % usado del disco y de la base, conexiones | > 80 % | Alertas de la base administrada, `df`/consulta programada que pega a un latido |
| 6 | **Certificado por vencer** | Días que le quedan al certificado HTTPS | < 14 días | Better Stack o UptimeRobot (revisa si tu plan lo incluye), o el script de abajo con un latido |

Los planes y límites gratis cambian: pide al usuario que los confirme en la página del servicio antes de elegir.

Si no hay cola, la alerta 4 se aplica a lo que trabaja en segundo plano y es crítico (avisos de pago que llegan por webhook, cron jobs, correos).
Si no hay nada así, márcala "no aplica hoy" en la tabla. Si no sabes el dominio, deja `<tu-dominio>` y pídelo en el siguiente paso.

### El endpoint de salud

Si `/salud` solo responde "ok", no ve si la base cayó. Propón (no lo cambies sin permiso) que revise lo indispensable y responda rápido:

```js
// Node: responde 200 si la base contesta en menos de 2 s; 503 si no.
app.get('/salud', async (req, res) => {
  try { await Promise.race([db.query('SELECT 1'), new Promise((_, r) => setTimeout(() => r(new Error('lento')), 2000))]); res.send('ok'); }
  catch { res.status(503).send('base no responde'); }
});
```

Rails: `get "/up" => "rails/health#show"` (Rails 7.1+) más un chequeo de base. Django: una vista con `connection.ensure_connection()`.
Laravel 11: `health: '/up'` en `bootstrap/app.php`.

### Latido para trabajos y colas

Un trabajo programado avisa "sigo vivo" al terminar; si no avisa a tiempo, el servicio manda la alerta.

```bash
# Al final del trabajo (cron, Sidekiq, Celery beat, scheduler de Laravel):
curl -fsS -m 10 --retry 3 https://hc-ping.com/<id-del-chequeo> > /dev/null
```

Para la cola: un trabajo cada 5 min que mide cuántos trabajos esperan y solo manda el latido si están bajo el umbral.

### Certificado sin servicio de pago

```bash
# Días que le quedan al certificado; programarlo diario y mandar latido solo si son más de 14.
fin=$(echo | openssl s_client -servername ejemplo.com -connect ejemplo.com:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
dias=$(( ( $(date -d "$fin" +%s) - $(date +%s) ) / 86400 ))
[ "$dias" -gt 14 ] && curl -fsS -m 10 https://hc-ping.com/<id> > /dev/null
```

Si el certificado lo renueva la plataforma (Render, Vercel, Netlify, Fly, Heroku ACM), la alerta igual vale: la renovación a veces falla por DNS.

## Configuración por plataforma

| Plataforma | Qué ya trae | Qué configurar |
|---|---|---|
| Render | `healthCheckPath` en `render.yaml`, avisos de despliegue fallido y servicio caído por correo/Slack | Monitor externo a `/salud`, Sentry, latido para cron jobs, alertas de disco de la base en el panel |
| Heroku | Métricas y alertas de tiempo de respuesta en dynos profesionales | Monitor externo, add-on de errores, `heroku pg:info` para tamaño de base |
| Fly.io | `[[http_service.checks]]` en `fly.toml`, métricas | Monitor externo, alerta de volumen (`fly volumes list`) |
| Vercel / Netlify | Estado de despliegues | Monitor externo, errores del lado del navegador, latido para cron |
| AWS | CloudWatch | Alarmas: `5XXError`, `TargetResponseTime`, `FreeStorageSpace` de RDS, `ApproximateAgeOfOldestMessage` de SQS |
| Servidor propio | Nada | Uptime Kuma u otro monitor externo, `df` y tamaño de base con latido, Sentry/GlitchTip |

Ejemplo para Render (`render.yaml`, solo si el usuario aprueba el cambio):

```yaml
    healthCheckPath: /salud      # Render deja de mandar tráfico a una instancia que no responde
```

Y en el monitor externo: URL `https://<dominio>/salud`, cada 1–5 min, alerta tras 2 fallas, tiempo máximo 2 s, aviso de certificado a 14 días.

## Qué no alertar

- Avisos de desuso, 404 de bots, errores ya conocidos y aceptados.
- Un solo error aislado: eso va al resumen diario, no al celular.
- Cualquier cosa sin una acción clara. Si nadie sabe qué hacer cuando suena, quítala.

## Reporte

```markdown
| # | Alerta | Umbral | Herramienta | Costo | ¿Ya existe? |
|---|---|---|---|---|---|
| 1 | Caída | 2 fallas seguidas a /salud | … | gratis | ❌ |
```

Después, la configuración concreta en el orden en que conviene hacerla (la primera es la que más protege con menos esfuerzo).
