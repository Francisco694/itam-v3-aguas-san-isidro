# Prototipo funcional del Dashboard

**Actualizado:** 23 de septiembre de 2026
**Tipo:** funcional y visual

## Estructura actual

El Dashboard presenta:

- inventario actual y valor económico;
- disponibles, asignados, servicio técnico, extraviados y bajas;
- inventario activo por tipo;
- cantidad y proporción de equipos verificados;
- pendientes de control físico;
- inventario histórico registrado por tipo;
- inversión histórica por tipo;
- alertas configurables de reposición.

## Decisiones

El inventario histórico se separa del actual para evitar sumar activos dados de baja o extraviados al valor operacional. Los porcentajes se muestran por cantidad y, donde corresponde, por valor. La información de verificación distingue registro manual de importado y usa la última evidencia física.

## Estado actual

El Dashboard está implementado en `frontend/src/app/features/dashboard` y consume `/api/v1/dispositivos/resumen-gerencial` y `/api/v1/alertas-stock`. El contrato detallado está en [DASHBOARD.md de API](../api/DASHBOARD.md).

## Validación pendiente

Durante la última validación el frontend generó bundles, pero el build fue rechazado por el límite de estilos de `dashboard.scss`. La revisión visual de datos reales y el ajuste/aprobación del presupuesto siguen siendo tareas de producción.
