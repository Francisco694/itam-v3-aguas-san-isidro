# API de actas y comprobantes

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional

## Actas de entrega

Base: `/api/v1/actas-entrega`. Todas las rutas requieren sesión.

### GET `/actas-entrega`

- **Propósito:** listar actas emitidas o registradas.
- **Respuesta:** `200` colección con número, destinatario, fecha, estado, responsable, observaciones y equipos.
- **Errores:** `401`, `500`.

### GET `/actas-entrega/:id`

- **Propósito:** obtener el detalle de un acta y sus activos.
- **Path:** `id` entero positivo.
- **Respuesta:** `200` acta con colaborador o departamento, recepcionante, declaración y detalle patrimonial.
- **Errores:** `400`, `404`.

### GET `/actas-entrega/:id/pdf`

- **Propósito:** generar el documento de acta.
- **Path:** `id` entero positivo.
- **Respuesta:** `200`, `application/pdf`, descarga A4 con nombre generado por el backend.
- **Errores:** `400`, `404`, `500`.

### POST `/actas-entrega`

- **Propósito:** crear un acta para uno o varios dispositivos.
- **Body:** `dispositivosCodigos` obligatorio como arreglo de enteros; uno de `colaboradorId` o `departamentoId`; `recepcionanteId` para recepción departamental; opcionales `localidad`, `observaciones`, `declaracion`. El responsable TI se toma de sesión.
- **Respuesta:** `201` acta creada con número correlativo anual.
- **Errores:** `400` por destinatario, lista o declaración inválida; `404` por persona/departamento/activo inexistente; `409` por activo ocupado, duplicado o sin condición de entrega.
- **Reglas:** un mismo activo no se repite en un acta; la declaración obligatoria y el destinatario se validan en backend; la emisión deja trazabilidad.

```json
{"colaboradorId":12,"dispositivosCodigos":[3001,3002],"localidad":"San Isidro","declaracion":"Declaro recibir los activos indicados.","observaciones":null}
```

## Comprobantes de devolución

Base: `/api/v1/comprobantes-devolucion`. Todas las rutas requieren sesión; los comprobantes se generan desde operaciones de devolución, no mediante un POST público.

### GET `/comprobantes-devolucion`

- **Propósito:** listar comprobantes.
- **Respuesta:** `200` colección con número, fecha, resultado, activo, origen y responsable.
- **Errores:** `401`, `500`.

### GET `/comprobantes-devolucion/:id`

- **Propósito:** obtener comprobante y detalle.
- **Path:** `id` entero positivo.
- **Respuesta:** `200` comprobante.
- **Errores:** `400`, `404`.

### GET `/comprobantes-devolucion/:id/pdf`

- **Propósito:** generar el PDF del comprobante.
- **Respuesta:** `200`, `application/pdf`, disposición inline.
- **Errores:** `400`, `404`, `500`.

## Numeración y trazabilidad

Actas y comprobantes usan secuencias anuales transaccionales. Un PDF es una representación del registro persistido; no reemplaza el historial del activo ni la auditoría de la operación.
