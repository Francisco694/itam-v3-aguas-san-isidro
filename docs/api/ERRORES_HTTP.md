# Errores HTTP

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico

## Formato

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "El dispositivo ya tiene custodio."
  }
}
```

El backend no expone stack trace, SQL ni secretos al cliente. Los errores no reconocidos se registran en servidor y responden con `INTERNAL_ERROR`.

## Códigos comunes

| HTTP | Código | Cuándo aparece |
| ---: | --- | --- |
| 400 | `VALIDATION_ERROR` | Parámetros, body, enum, fecha, dinero, identificador o archivo inválido. |
| 401 | `AUTH_REQUIRED` | No existe cookie de sesión. |
| 401 | `INVALID_SESSION` | Sesión inexistente, revocada, expirada o usuario inactivo. |
| 401 | `SESSION_EXPIRED_IDLE` | La sesión superó el tiempo de inactividad. |
| 403 | `FORBIDDEN` | El rol no permite la operación. |
| 403 | `CREDENTIAL_CHANGE_REQUIRED` | Debe actualizar contraseña o PIN antes de continuar. |
| 404 | `NOT_FOUND` | El recurso, catálogo o endpoint no existe. |
| 409 | `CONFLICT` | Unicidad, custodia, estado o transición de negocio incompatible. |
| 500 | `INTERNAL_ERROR` | Error inesperado no clasificable. |
| 503 | `DATABASE_UNAVAILABLE` | Health database no puede consultar PostgreSQL. |

## Conflictos frecuentes

- IMEI, serie, ICCID, nombre, correo o código duplicado.
- Dos custodias o dos asociaciones incompatibles.
- Segunda baja de un dispositivo ya dado de baja.
- Segunda orden de servicio técnico abierta para el mismo dispositivo.
- Intento de alterar un código ITAM emitido.
- Cambio de familia después de que ya se emitieron códigos.
- Cierre de offboarding sin resolver los activos requeridos.

## Recomendación para clientes

1. Mostrar `error.message` al usuario cuando sea accionable.
2. Tratar `401` como necesidad de reautenticación o renovación.
3. Tratar `403` como falta de permiso o credencial pendiente.
4. No reintentar automáticamente un `409` sin cambiar los datos.
5. Registrar el método, ruta y código HTTP en soporte, nunca cookies ni secretos.
