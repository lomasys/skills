# Costo por cliente

Para poner precios correctos hay que saber cuánto cuesta en servidores **cada tipo de cliente**, no el promedio.
Un cliente grande en el plan barato puede costar más de lo que paga.

## La fórmula

```
costo de un cliente al mes = parte del costo fijo + costo variable por su uso

parte del costo fijo  = costo fijo mensual / número de clientes
costo variable        = Σ (uso del cliente en cada cosa × precio unitario de esa cosa)
margen del plan       = precio del plan − costo del cliente − comisión de cobro
```

- **Costo fijo:** lo que pagas aunque no haya uso (servidores mínimos, base, monitoreo, respaldos). Con más clientes se reparte más.
- **Costo variable:** sube con cada cliente: correos, SMS, almacenamiento (GB al mes), tráfico de salida (GB), llamadas a APIs de pago (IA, mapas), minutos de cómputo de trabajos.
- **Escalones:** algunos costos fijos saltan al crecer (un servidor más cada N usuarios simultáneos, una base más grande). Usa la prueba de carga para saber cuándo:
  si hoy aguanta 300 usuarios simultáneos por servidor y la meta es 3 000, son ~10 servidores más uno de reserva.

## De dónde salen los números

| Dato | Fuente, en orden de preferencia |
|---|---|
| Costo fijo y precios unitarios | 1. La factura del usuario (lo que de verdad paga) · 2. La página oficial de precios del proveedor, consultada hoy · 3. Estimado, marcado como tal |
| Uso por cliente | Consultas de solo lectura a la base de pruebas o a un reporte que el usuario comparta: pedidos, correos, GB guardados por cuenta. Si no hay datos, pregúntale al usuario cuántos clientes grandes tiene y qué tanto más usan |
| Capacidad por servidor | Tu prueba de carga (escalón donde se rompe, con un margen del 30-50 %) |

Páginas oficiales de precios (consúltalas el día que hagas el cálculo y anota la fecha):
AWS `aws.amazon.com/pricing`, Google Cloud `cloud.google.com/pricing`, Azure `azure.microsoft.com/pricing`,
DigitalOcean `digitalocean.com/pricing`, Cloudflare R2 `developers.cloudflare.com/r2/pricing`, Hetzner `hetzner.com/cloud`,
y la página de precios del proveedor de correo, SMS o IA que use el proyecto.

Cada precio en el reporte y en la hoja lleva: **valor, unidad, fuente y fecha** (por ejemplo `0.0X USD/GB-mes · página oficial de <proveedor> · consultado 2026-11-17`).
Si un precio no lo pudiste verificar, escribe "estimado, sin verificar" al lado.

## La hoja: `carga/costo-por-cliente.csv`

Una fila por concepto. Se abre en Excel, Google Sheets o Numbers. Las celdas de total se calculan con la fórmula de arriba;
el agente llena los valores y deja las fórmulas escritas en la columna `nota` para que el usuario las pueda revisar.

```csv
concepto,tipo,unidad,precio_unitario_usd,fuente,fecha_precio,uso_cliente_normal,uso_cliente_grande,costo_normal_usd,costo_grande_usd,nota
Servidores de la app,fijo,mes,40,factura del usuario,2026-11,,,=D2/120,=D2/120,repartido entre 120 clientes
Base de datos,fijo,mes,95,factura del usuario,2026-11,,,=D3/120,=D3/120,
Correo transaccional,variable,correo,0.0004,factura: 20 USD / 50 000 correos,2026-11,125,4320,=D4*G4,=D4*H4,un correo por pedido
Almacenamiento de archivos,variable,GB-mes,<precio>,<página oficial>,<fecha>,0.1,5.6,=D5*G5,=D5*H5,
Tráfico de salida,variable,GB,<precio>,<factura o página oficial>,<fecha>,0.8,42,=D6*G6,=D6*H6,
TOTAL,,,,,,,,=SUM(I2:I6),=SUM(J2:J6),
```

(Los números de este ejemplo son ilustrativos. Usa los del proyecto.)

## Qué entregar

1. **Tabla por tipo de cliente:** normal y grande (y el más grande de todos, si se conoce): costo fijo repartido, variable y total al mes.
2. **Con la meta de crecimiento:** el mismo cálculo con el número de clientes de la meta y los escalones de servidores que dice la prueba de carga.
3. **Lectura para precios**, por plan: margen con un cliente normal y con uno grande. Si el grande deja pérdida o poco margen:
   - límites por plan (pedidos, GB, usuarios) con cobro por excedente, o
   - un plan superior para ese uso.
4. **Qué baja el costo** de los cambios propuestos (CDN baja el tráfico; caché baja el tamaño de la base; colas permiten servidores más chicos) con su estimado.

## Errores comunes

- Dividir la factura entre el número de clientes y llamarlo "costo por cliente".
- Olvidar la comisión del cobro (tarjeta, pasarela) y los impuestos al calcular margen.
- Usar precios de lista cuando el usuario tiene descuentos o créditos: manda la factura.
- Precios sin fecha: los proveedores los cambian. Un número sin fecha no se puede revisar.
