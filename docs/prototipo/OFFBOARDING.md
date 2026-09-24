# Offboarding

**Actualizado:** 23 de septiembre de 2026
**Tipo:** funcional y operativo

## Flujo visual

1. Buscar colaborador por nombre o RUT.
2. Revisar equipos asignados y valor pendiente.
3. Abrir proceso.
4. Procesar cada activo con resultado de devolución, pendiente, extravío, robo o daño.
5. Revisar comprobantes, historial y custodias.
6. Cerrar solo cuando el proceso cumpla sus condiciones.

## Decisiones

El proceso separa la salida de la persona del cierre de cada activo. Un resultado pendiente no borra custodia ni inventa devolución. La vista muestra cantidades y valores para priorizar la revisión.

## Estado actual

La API y la vista implementan búsqueda, apertura, detalle, listado de procesos abiertos y cierre. Las reglas exactas de cada resultado están documentadas en [OFFBOARDING.md de API](../api/OFFBOARDING.md) y en [REGLAS_DE_NEGOCIO.md](../arquitectura/REGLAS_DE_NEGOCIO.md).
