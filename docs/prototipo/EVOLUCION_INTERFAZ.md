# Evolución de la interfaz

**Actualizado:** 23 de septiembre de 2026
**Tipo:** funcional y visual

## Evolución observada

1. Se pasó de vistas centradas en formularios a flujos operativos de inventario y custodia.
2. Se separaron equipos actuales e históricos para evitar que una asignación antigua parezca vigente.
3. Se incorporaron QR, vista previa e impresión por lote para conectar registro digital y etiqueta física.
4. Se separó smartphone, SIM y línea telefónica en la interfaz.
5. Se agregó verificación física explícita para no confundir una alta/importación con una revisión real.
6. Servicio técnico se organizó por etapas: envío, diagnóstico/cotización, decisión y retorno.
7. El Dashboard pasó a mostrar valor, control físico, inventario activo por tipo e histórico económico.

## Decisiones visuales

- Acciones críticas se muestran junto al estado y no escondidas en navegación secundaria.
- Los identificadores físicos aparecen junto al código ITAM.
- Los conflictos de serie/IMEI muestran el activo existente y su enlace.
- Las pantallas usan estados vacíos, errores y confirmaciones para no sugerir que una operación se guardó cuando no hubo confirmación del backend.
- Las vistas se adaptan a pantallas pequeñas mediante tarjetas, columnas responsivas y acciones agrupadas.

## Problemas y solución

La bitácora registra problemas de refresco de líneas, textos ambiguos, inconsistencias entre historial y situación actual, y validaciones que podían parecer exitosas antes de confirmar el API. La solución fue separar responsabilidades, hacer explícitos los estados y recargar la ficha después de operaciones críticas.
