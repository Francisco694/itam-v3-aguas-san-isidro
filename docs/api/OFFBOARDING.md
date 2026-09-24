# API de offboarding

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional
**Base:** `/api/v1/offboarding`

Todas las rutas requieren sesión.

## GET `/offboarding`

- **Propósito:** listar procesos abiertos.
- **Respuesta:** `200` colección con colaborador, fecha, estado, equipos pendientes, valores pendiente/recuperado y usuarios.
- **Errores:** `401`, `500`.

## GET `/offboarding/buscar`

- **Propósito:** buscar colaboradores candidatos sin crear un proceso.
- **Query:** `q` obligatorio; busca por nombre o RUT según el servicio.
- **Respuesta:** `200` colección con colaborador, equipos asignados, valor asignado y `procesoAbiertoId`.
- **Errores:** `400` si falta `q`; `401`.

```http
GET /api/v1/offboarding/buscar?q=11111111-1
```

## GET `/offboarding/:id`

- **Propósito:** obtener proceso y activos pendientes.
- **Path:** `id` entero positivo.
- **Respuesta:** `200` detalle con colaborador, estado, usuarios, totales y `activosPendientes`.
- **Errores:** `400`, `404`.

## POST `/offboarding`

- **Propósito:** iniciar salida de un colaborador.
- **Body:** `colaboradorId` obligatorio; `observaciones` opcional. El usuario de inicio se toma de sesión.
- **Respuesta:** `201` proceso `ABIERTO`.
- **Errores:** `400`, `404`, `409` si el colaborador ya tiene proceso abierto o no puede iniciar el flujo.
- **Reglas:** se conserva la custodia de los activos hasta que cada resultado sea procesado.

```json
{"colaboradorId":12,"observaciones":"Salida informada por RR. HH."}
```

## POST `/offboarding/:id/cerrar`

- **Propósito:** cerrar un proceso completo.
- **Body:** ninguno; el usuario de cierre se toma de sesión.
- **Respuesta:** `200` proceso `COMPLETADO`.
- **Errores:** `400`, `404`, `409` si quedan activos pendientes o el proceso ya está cerrado.
- **Reglas:** no se permite cerrar silenciosamente activos no resueltos; el resultado de cada equipo queda en historial y puede generar comprobante.
