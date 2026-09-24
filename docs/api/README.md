# API ITAM

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico

## Base

La API se publica bajo `/api/v1`. En desarrollo el frontend apunta a `http://localhost:3000/api/v1`; en producción usa `/api/v1` detrás del mismo origen. Todas las rutas, salvo health y autenticación pública, requieren la cookie de sesión `itam_session`.

## Formatos comunes

Respuesta individual:

```json
{ "success": true, "data": {} }
```

Respuesta de colección:

```json
{ "success": true, "count": 0, "data": [] }
```

Respuesta de error:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Mensaje de negocio" }
}
```

## Documentos por dominio

| Dominio | Documento |
| --- | --- |
| Sesión y health | [AUTH.md](AUTH.md) |
| Dispositivos, historial y verificación | [DISPOSITIVOS.md](DISPOSITIVOS.md) |
| Personas y conciliación | [COLABORADORES.md](COLABORADORES.md) |
| Organización | [DEPARTAMENTOS.md](DEPARTAMENTOS.md) |
| SIM y líneas | [SIM_LINEAS.md](SIM_LINEAS.md) |
| Actas y comprobantes | [ACTAS_ENTREGA.md](ACTAS_ENTREGA.md) |
| Servicio técnico | [SERVICIO_TECNICO.md](SERVICIO_TECNICO.md) |
| Offboarding | [OFFBOARDING.md](OFFBOARDING.md) |
| Dashboard, stock y reportes | [DASHBOARD.md](DASHBOARD.md) |
| Errores y códigos HTTP | [ERRORES_HTTP.md](ERRORES_HTTP.md) |

## Catálogos y administración

Estos endpoints también existen en `backend/src` y se mantienen en este índice para evitar que el catálogo real quede fuera de la documentación:

| Método | Ruta | Permiso | Propósito |
| --- | --- | --- | --- |
| GET | `/estados` | Sesión | Lista estados; acepta `tipoEntidad=DISPOSITIVO\|SIM`. |
| GET | `/familias-codigo` | Sesión | Lista familias y configuración de códigos. |
| GET | `/familias-codigo/prefijo-sugerido` | Sesión | Sugiere un prefijo libre. |
| GET | `/familias-codigo/:id` | Sesión | Obtiene una familia. |
| POST | `/familias-codigo` | Sesión | Crea una familia. |
| PATCH | `/familias-codigo/:id` | Sesión | Edita o desactiva una familia. |
| GET | `/tipos-dispositivo` | Sesión | Lista tipos y configuración de formulario. |
| GET | `/tipos-dispositivo/:id` | Sesión | Obtiene un tipo. |
| POST | `/tipos-dispositivo` | Sesión | Crea un tipo. |
| PATCH | `/tipos-dispositivo/:id` | Sesión | Edita o desactiva un tipo. |
| GET | `/facturas-adquisicion` | Sesión | Lista facturas de adquisición. |
| GET | `/facturas-adquisicion/:id` | Sesión | Obtiene una factura. |
| GET | `/facturas-adquisicion/:id/documento` | Sesión | Descarga el documento adjunto. |
| POST | `/facturas-adquisicion` | Sesión | Crea factura, con multipart opcional. |
| PATCH | `/facturas-adquisicion/:id` | Sesión | Actualiza factura, con multipart opcional. |
| GET | `/usuarios` | `SUPER_USUARIO` | Lista usuarios. |
| POST | `/usuarios` | `SUPER_USUARIO` | Crea usuario. |
| PATCH | `/usuarios/:id` | `SUPER_USUARIO` | Actualiza usuario. |

En estas rutas se aplican las reglas de validación compartidas y las respuestas de [ERRORES_HTTP.md](ERRORES_HTTP.md). Las formas exactas de multipart se mantienen en los controladores de `facturas-adquisicion`.

## Convenciones de autenticación

```http
Cookie: itam_session=<sesión emitida por login>
Content-Type: application/json
```

El nombre visible del usuario se toma de la sesión autenticada en mutaciones sensibles; no se debe confiar en un nombre enviado por el cliente cuando el controlador usa `authenticatedActorName`.
