# API de Dashboard, stock y reportes

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional

## GET `/api/v1/dispositivos/resumen-gerencial`

- **Propósito:** indicadores ejecutivos.
- **Permisos:** sesión.
- **Respuesta:** inventario actual y valor total; disponibles, asignados, servicio técnico, extraviados y bajas; inventario activo por tipo; equipos verificados, pendientes y valor verificado; inventario histórico registrado por tipo e inversión histórica.
- **Errores:** `401`, `500`.
- **Reglas:** activo operacional y histórico se calculan por separado; la distribución por tipo incluye cantidad, proporción y valor según el indicador.

## GET `/api/v1/alertas-stock`

- **Propósito:** listar tipos cuyo stock disponible está bajo el umbral.
- **Permisos:** sesión.
- **Respuesta:** `200` colección con tipo, cantidad disponible, mínimo, alerta activa y datos de configuración.
- **Errores:** `401`, `500`.

## PATCH `/api/v1/alertas-stock/:tipoId`

- **Propósito:** configurar alerta de reposición de un tipo.
- **Permisos:** `SUPER_USUARIO`.
- **Path:** `tipoId` entero positivo.
- **Body:** `minimoDisponible` entero no negativo y `alertaActiva` booleanos, ambos obligatorios.
- **Respuesta:** `200` configuración actualizada.
- **Errores:** `400`, `403`, `404`, `409` si la configuración no es aplicable.
- **Reglas:** el disponible se calcula con estado `DISPONIBLE`; el umbral cero puede ser válido.

```json
{"minimoDisponible":3,"alertaActiva":true}
```

## GET `/api/v1/reportes/inventario`

- **Propósito:** obtener reporte de inventario para un rango.
- **Query:** `desde` y `hasta` obligatorios, formato `YYYY-MM-DD`, con `desde <= hasta`.
- **Permisos:** sesión.
- **Respuesta:** `200` resumen y detalle del inventario del período.
- **Errores:** `400 VALIDATION_ERROR` por rango inválido; `401`, `500`.

## GET `/api/v1/reportes/inventario/pdf`

- **Propósito:** generar el reporte de inventario en PDF.
- **Query:** igual que el endpoint JSON.
- **Respuesta:** `200`, `application/pdf`, descarga.
- **Errores:** `400`, `401`, `500`.

## Lectura funcional del Dashboard

El Dashboard no representa solo filas actuales: separa activos operacionales, control físico e histórico registrado. Los estados extraviado y dado de baja se muestran en sus propios indicadores; el valor histórico se calcula desde los registros históricos, no se suma al inventario activo.
