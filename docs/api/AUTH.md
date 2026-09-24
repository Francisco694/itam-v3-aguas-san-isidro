# Autenticación, sesiones y health

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico

Base: `/api/v1`. `POST /auth/login` y `POST /auth/login-pin` son públicos. Health es público. Las demás rutas de esta página requieren una sesión válida.

## POST `/auth/login`

- **Propósito:** iniciar sesión con correo y contraseña.
- **Permisos:** público.
- **Parámetros:** ninguno.
- **Body:** `{ "email": "usuario@aguassan.isidro", "password": "al menos 12 caracteres" }`.
- **Respuesta:** `200`, `data` con el usuario autenticado; además emite cookie HTTP-only `itam_session`.
- **Errores:** `400 VALIDATION_ERROR` por body, correo o contraseña inválida; `401` por credenciales no válidas o cuenta bloqueada.
- **Reglas:** la contraseña se valida en backend; los intentos fallidos pueden activar el bloqueo temporal.

```http
POST /api/v1/auth/login
Content-Type: application/json

{"email":"ti@aguassan.isidro","password":"************"}
```

```json
{"success":true,"data":{"id":"1","nombre":"Usuario TI","email":"ti@aguassan.isidro","rol":"USUARIO"}}
```

## POST `/auth/login-pin`

- **Propósito:** iniciar sesión con correo y PIN.
- **Permisos:** público.
- **Body:** `{ "email": "...", "pin": "123456" }`.
- **Respuesta:** `200` con usuario y cookie `itam_session`.
- **Errores:** `400 VALIDATION_ERROR` si el PIN no tiene exactamente 6 dígitos; `401` por credenciales inválidas o bloqueo.
- **Reglas:** el PIN se compara con su hash; no se acepta como contraseña alternativa en otras rutas.

## GET `/auth/me`

- **Propósito:** devolver el usuario de la sesión actual.
- **Permisos:** sesión.
- **Parámetros/body:** ninguno.
- **Respuesta:** `200` con `id`, `nombre`, `email`, `cargo`, `rol`, `debeCambiarPassword` y `debeCambiarPin`.
- **Errores:** `401 AUTH_REQUIRED`, `INVALID_SESSION` o `SESSION_EXPIRED_IDLE`.

## POST `/auth/refresh-session`

- **Propósito:** actualizar actividad de una sesión vigente.
- **Permisos:** sesión.
- **Respuesta:** `200` con `idleTimeoutMinutes` e `idleWarningMinutes`.
- **Errores:** `401` si no existe, expiró o fue revocada.
- **Reglas:** no extiende una sesión revocada ni supera la expiración absoluta.

## POST `/auth/change-password`

- **Propósito:** cambiar la contraseña propia.
- **Permisos:** sesión; se permite durante la restricción de cambio obligatorio.
- **Body:** `{ "currentPassword": "...", "newPassword": "mínimo 12 caracteres" }`.
- **Respuesta:** `204` sin body.
- **Errores:** `400 VALIDATION_ERROR`, `401` por sesión o contraseña actual inválida, `409` si la política de credenciales lo impide.

## POST `/auth/change-pin`

- **Propósito:** cambiar el PIN propio.
- **Permisos:** sesión; se permite durante la restricción de cambio obligatorio.
- **Body:** `{ "currentPin": "123456", "newPin": "654321" }`.
- **Respuesta:** `204` sin body.
- **Errores:** `400 VALIDATION_ERROR` si no son seis dígitos; `401` por sesión o PIN actual inválido.

## POST `/auth/logout`

- **Propósito:** revocar la sesión actual y limpiar la cookie.
- **Permisos:** sesión.
- **Respuesta:** `204` sin body.
- **Errores:** `401` si no hay sesión válida.

## GET `/health`

- **Propósito:** comprobar que Express responde.
- **Permisos:** público.
- **Respuesta:** `200` con `success`, `service`, `status` y `timestamp`.

```json
{"success":true,"service":"ITAM API","status":"OK","timestamp":"2026-09-23T12:00:00.000Z"}
```

## GET `/health/database`

- **Propósito:** comprobar conexión y usuario de PostgreSQL.
- **Permisos:** público.
- **Respuesta:** `200` con `database`, `user` y `databaseTime`.
- **Errores:** `503 DATABASE_UNAVAILABLE` si la consulta falla.

## Auditoría de sesión

Las mutaciones se auditan al terminar la respuesta. La sesión expirada por inactividad produce `SESSION_EXPIRED_IDLE` y deja evidencia de revocación.
