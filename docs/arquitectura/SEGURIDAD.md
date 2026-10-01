# Seguridad

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y operativo

## Sesiones y credenciales

- `POST /api/v1/auth/login` y `POST /api/v1/auth/login-pin` crean la cookie HTTP-only `itam_session`.
- La cookie usa `httpOnly` y `sameSite=lax`; `secure` se determina según el
  protocolo externo real (`req.secure`). En HTTP queda desactivado y detrás de
  HTTPS queda activado automáticamente.
- La sesión expira por tiempo absoluto o por inactividad; una sesión inactiva se revoca y se audita.
- Las contraseñas y PIN se almacenan mediante hashes; la API exige contraseña de al menos 12 caracteres y PIN de exactamente 6 dígitos.
- Si la cuenta debe cambiar contraseña o PIN, el middleware restringe las rutas hasta completar el cambio.

## Autorización

Todas las rutas de negocio requieren sesión. Las rutas de administración de usuarios y actualización de alertas de stock requieren el rol `SUPER_USUARIO`. Las operaciones restantes requieren una sesión válida; las reglas de dominio se aplican dentro de cada servicio.

## Transporte y configuración

- Helmet añade cabeceras de seguridad.
- CORS no acepta `*`; producción exige un origen explícito.
- Express confía únicamente en el proxy loopback (`trust proxy=loopback`), que
  es el Nginx local. El backend escucha en `127.0.0.1` por defecto y no debe
  exponerse directamente a Internet.
- Los secretos y la conexión PostgreSQL se suministran mediante variables de entorno.
- Los documentos se sirven con controles de tipo, tamaño, disposición y `nosniff` donde corresponde.

## Auditoría y exposición de errores

Las mutaciones se registran en `auditoria_operaciones`. Los errores esperables exponen código y mensaje de negocio; los errores inesperados se registran en backend y responden con mensaje genérico.

## Límites

La aplicación no sustituye controles de infraestructura como TLS terminado por proxy, firewall, rotación de secretos, backup cifrado o permisos del sistema de archivos. Estos controles deben verificarse antes de producción.

## Esquema de sesiones

La migración histórica `018_session_idle_timeout.sql` solo comprueba la
existencia de `ultima_actividad`; no modifica el esquema. La migración
`034_session_activity_and_proxy_ready.sql` crea la columna con
`TIMESTAMPTZ NOT NULL DEFAULT now()` y el índice parcial usado por el timeout,
sin eliminar sesiones existentes. Debe aplicarse en instalaciones nuevas y
actualizaciones antes de iniciar el backend corregido.
