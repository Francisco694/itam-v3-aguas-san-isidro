# Seguridad

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y operativo

## Sesiones y credenciales

- `POST /api/v1/auth/login` y `POST /api/v1/auth/login-pin` crean la cookie HTTP-only `itam_session`.
- La cookie es `secure` en producción y usa `sameSite=lax`.
- La sesión expira por tiempo absoluto o por inactividad; una sesión inactiva se revoca y se audita.
- Las contraseñas y PIN se almacenan mediante hashes; la API exige contraseña de al menos 12 caracteres y PIN de exactamente 6 dígitos.
- Si la cuenta debe cambiar contraseña o PIN, el middleware restringe las rutas hasta completar el cambio.

## Autorización

Todas las rutas de negocio requieren sesión. Las rutas de administración de usuarios y actualización de alertas de stock requieren el rol `SUPER_USUARIO`. Las operaciones restantes requieren una sesión válida; las reglas de dominio se aplican dentro de cada servicio.

## Transporte y configuración

- Helmet añade cabeceras de seguridad.
- CORS no acepta `*`; producción exige un origen explícito.
- Los secretos y la conexión PostgreSQL se suministran mediante variables de entorno.
- Los documentos se sirven con controles de tipo, tamaño, disposición y `nosniff` donde corresponde.

## Auditoría y exposición de errores

Las mutaciones se registran en `auditoria_operaciones`. Los errores esperables exponen código y mensaje de negocio; los errores inesperados se registran en backend y responden con mensaje genérico.

## Límites

La aplicación no sustituye controles de infraestructura como TLS terminado por proxy, firewall, rotación de secretos, backup cifrado o permisos del sistema de archivos. Estos controles deben verificarse antes de producción.
