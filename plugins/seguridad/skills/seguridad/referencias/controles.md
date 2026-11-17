# Controles SOC 2 · ISO 27001 · ISO 27701 por tipo de hallazgo

Usa esta tabla para marcar cada hallazgo y para el reporte `auditoria`.
Solo cubre la parte **técnica** que se ve en el código. Una auditoría también revisa políticas,
personas, proveedores y oficinas; eso nunca se puede dar por cumplido desde aquí.

- **ISO/IEC 27001:2022**, Anexo A. Los números `8.x` son controles tecnológicos y los `5.x` son organizacionales.
- **SOC 2**: Criterios de Servicios de Confianza (Common Criteria, `CC`).
- **ISO/IEC 27701**: privacidad de datos personales. La numeración cambia entre ediciones (2019 y 2025).
  Cita el **tema** y pide al usuario que confirme el número en su edición. Nunca inventes un número.

| Hallazgo | ISO 27001:2022 | SOC 2 | ISO 27701 (tema) |
|---|---|---|---|
| Un cliente ve o cambia datos de otro (fuga entre cuentas) | 8.3 Restricción de acceso a la información · 5.15 Control de acceso | CC6.1 | Datos personales separados por cliente |
| Un usuario hace acciones de un rol que no tiene | 8.2 Derechos de acceso privilegiado · 5.18 Derechos de acceso | CC6.3 | — |
| Login débil, sin límite de intentos, sesión insegura | 8.5 Autenticación segura · 5.17 Información de autenticación | CC6.1 | — |
| Claves o tokens escritos en el código | 8.24 Uso de criptografía · 8.4 Acceso al código fuente · 5.17 | CC6.1 | — |
| Datos sin cifrar en tránsito (sin HTTPS, cookies sin `Secure`) | 8.24 Uso de criptografía · 8.20 Seguridad de redes | CC6.7 | Protección de datos personales en tránsito |
| Inyección SQL, XSS, redirección abierta, archivos sin validar | 8.28 Codificación segura · 8.26 Requisitos de seguridad de aplicaciones | CC6.6 · CC8.1 | — |
| Dependencias con vulnerabilidades conocidas | 8.8 Gestión de vulnerabilidades técnicas | CC7.1 | — |
| Webhook sin firma o procesado dos veces | 8.26 Requisitos de seguridad de aplicaciones · 8.28 | CC6.6 | — |
| Enlace público adivinable, que no caduca o que muestra datos personales | 8.3 · 8.12 Prevención de fuga de datos · 8.11 Enmascaramiento de datos | CC6.1 · CC6.7 | Minimizar los datos personales expuestos |
| Encabezados de seguridad o CORS mal configurados | 8.9 Gestión de la configuración | CC6.6 | — |
| No hay bitácora de quién cambió qué | 8.15 Registro (logging) · 8.16 Monitoreo | CC7.2 | Registro de acceso a datos personales |
| Al borrar un cliente quedan sus datos | 8.10 Eliminación de información | C1.2 | Borrado de datos personales al terminar el tratamiento |
| Datos reales de clientes en pruebas o en el repositorio | 8.33 Información de prueba · 8.31 Separación de ambientes | CC6.1 | Datos personales fuera de producción |
| No hay pruebas de seguridad en el flujo de cambios | 8.29 Pruebas de seguridad en desarrollo · 8.25 Ciclo de desarrollo seguro | CC8.1 | — |

## Reporte `auditoria`: qué puede decir y qué no

Para cada control técnico de la tabla, pon uno de estos estados con su evidencia:

- **Cumple**: hay código o una prueba que lo demuestra. Cita el archivo y la prueba.
- **Incompleto**: se cumple en una parte y en otra no. Di dónde.
- **No cumple**: hay un hallazgo comprobado. Enlázalo.
- **No se puede ver desde el código**: depende de la infraestructura o de un proceso.

Siempre termina con la lista **Lo que falta fuera del código**, porque una auditoría lo va a pedir:
políticas escritas, análisis de riesgos, capacitación, gestión de proveedores, respaldos y su restauración
probada, plan de respuesta a incidentes, revisión periódica de accesos, controles físicos.

Nunca escribas "cumples SOC 2" ni "cumples ISO 27001". Eso solo lo puede decir un auditor.
Escribe: "estos controles técnicos tienen evidencia; la certificación requiere además…".
