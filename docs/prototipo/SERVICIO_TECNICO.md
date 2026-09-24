# Servicio técnico

**Actualizado:** 23 de septiembre de 2026
**Tipo:** funcional y visual

## Flujo visual

- **Envío:** equipo, proveedor, fecha, tipo de servicio, falla y accesorios.
- **Diagnóstico/cotización:** diagnóstico, reparación propuesta, monto, plazo, ticket y archivo.
- **Decisión:** aprobar, rechazar o dar de baja.
- **Retorno/cierre:** costo final, fecha, resultado y estado final.
- **Equipo temporal:** entrega y cierre opcionales mientras el activo principal está en servicio.

## Problemas resueltos

La bitácora registra campos de esquema que faltaban para persistir revisión y retorno, errores en mensajes HTTP y la necesidad de evitar órdenes abiertas duplicadas. Se agregaron migraciones y validaciones en el curso del proyecto; esta documentación no altera esas migraciones.

## Decisiones visuales

La ficha del dispositivo muestra el estado técnico y los costos principales. La pantalla reduce la complejidad a etapas y conserva el vínculo con la orden de trabajo y el PDF de envío.
