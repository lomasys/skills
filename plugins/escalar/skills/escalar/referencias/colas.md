# Colas de trabajo

Una cola saca de la petición lo que es lento o puede fallar. El cliente recibe su respuesta en milisegundos y un proceso aparte
(el *worker*) hace el trabajo, con reintentos.

## Qué buscar en el código

Dentro de una petición, cualquier cosa que tarde más de ~200 ms o dependa de otro servicio:

- enviar correos, SMS o notificaciones;
- generar PDF, reportes, exportaciones, miniaturas de imágenes;
- llamar webhooks de clientes o APIs de terceros que no hacen falta para responder;
- cálculos pesados (recalcular totales, sincronizar con otro sistema).

Señal de alarma: la petición guarda algo en la base **y luego** hace algo que puede fallar. Si falla, responde error aunque ya guardó:
el cliente reintenta y queda duplicado.

## El cambio básico

1. La petición guarda lo importante y **encola** el trabajo en la misma transacción (o justo después del commit).
2. Responde de inmediato (`201` o `202`).
3. El worker hace el trabajo con reintentos espaciados y, si se agotan, lo deja en una cola de fallidos para revisarlo.

Si encolar y guardar no pueden ir en la misma transacción, usa el patrón **outbox**: guarda una fila "por enviar" en una tabla de la misma base,
dentro de la transacción, y un proceso la lee y la encola. Así nunca se pierde un trabajo ni se encola uno de algo que no se guardó.

## Reintentos que no duplican (idempotencia)

Un trabajo puede correr dos veces: el worker se reinició, hubo un tiempo límite, la red falló después de enviar. Diséñalo para que correrlo dos veces dé lo mismo que una.

- **En la API:** acepta un encabezado `Idempotency-Key` en las rutas que crean cosas (pedidos, pagos). Guarda la llave con un índice único
  junto con la respuesta; si llega otra vez, regresa la misma respuesta sin crear nada.
- **En el worker:** antes de hacer el trabajo, revisa si ya se hizo (`correo_enviado_at`, una tabla de "trabajos hechos" con índice único por `pedido_id + tipo`).
- **Con terceros:** manda tu propia llave de idempotencia si el proveedor la acepta (los de pagos y varios de correo la aceptan).
- **Reintentos con espera creciente y algo de azar** (1 s, 4 s, 16 s… más un poco aleatorio) y un máximo. Nunca reintentar de inmediato y sin fin.

## Ejemplos por stack

**Rails (Sidekiq)**
```ruby
class EnviarConfirmacionJob
  include Sidekiq::Job
  sidekiq_options retry: 8   # espera creciente por defecto
  def perform(pedido_id)
    pedido = Pedido.find(pedido_id)
    return if pedido.confirmacion_enviada_at        # ya se hizo
    Mailer.confirmacion(pedido).deliver_now
    pedido.update!(confirmacion_enviada_at: Time.current)
  end
end
# en el controlador, después de guardar: EnviarConfirmacionJob.perform_async(pedido.id)
# (con after_commit para que el worker no busque un pedido que aún no existe)
```

**Python (Celery)**
```python
@app.task(bind=True, autoretry_for=(ErrorProveedor,), retry_backoff=True, retry_jitter=True, max_retries=8, acks_late=True)
def enviar_confirmacion(self, pedido_id):
    pedido = Pedido.objects.get(id=pedido_id)
    if pedido.confirmacion_enviada_at: return
    enviar_correo(pedido)
    Pedido.objects.filter(id=pedido_id).update(confirmacion_enviada_at=now())
# en la vista: transaction.on_commit(lambda: enviar_confirmacion.delay(pedido.id))
```

**Node (BullMQ)**
```js
await cola.add('confirmacion', { pedidoId }, {
  jobId: `confirmacion:${pedidoId}`,            // el mismo trabajo no se encola dos veces
  attempts: 8, backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 1000, removeOnFail: false,
});
```

**Laravel**
```php
class EnviarConfirmacion implements ShouldQueue, ShouldBeUnique {
    public $tries = 8;
    public function backoff() { return [1, 5, 15, 60]; }
    public function uniqueId() { return $this->pedido->id; }
    public function handle() { if ($this->pedido->confirmacion_enviada_at) return; /* enviar y marcar */ }
}
// EnviarConfirmacion::dispatch($pedido)->afterCommit();
```

## Qué vigilar cuando hay colas

- **Largo de la fila y edad del trabajo más viejo.** Si crece sin parar, faltan workers.
- **Trabajos fallidos.** Una alarma cuando aparezcan, y una forma de reintentarlos a mano.
- **Separar colas por urgencia** (correos de pedidos vs. reportes), para que un reporte enorme no detenga los correos.
- **Por cliente:** un cliente grande que exporta 1 millón de filas no debe dejar a los demás esperando. Limita trabajos simultáneos por cuenta.

## Cómo comprobarlo

- Con la app local y el proveedor simulado lento o fallando: la ruta responde rápido y el pedido existe **una sola vez**.
- Manda la misma petición dos veces con la misma `Idempotency-Key`: un solo registro, la misma respuesta.
- Apaga el worker, crea pedidos, préndelo: los trabajos se procesan solos.
