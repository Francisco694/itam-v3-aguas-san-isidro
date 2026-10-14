# Gestión Segura de Accesos y Llaves

> Archivo histórico conservado por compatibilidad. Su contenido de seguridad se mantiene en `docs/arquitectura/SEGURIDAD.md`; la arquitectura vigente está resumida en el documento 08.

## Propósito

Este documento registra los controles de acceso observados sin mostrar contraseñas, PIN, hashes, tokens, cookies, llaves privadas ni valores de secretos.

## Roles de aplicación

| Identificador | Capacidades confirmadas |
| --- | --- |
| `SUPER_USUARIO` | Acceso a administración de usuarios y actualización de alertas de stock; además de las operaciones permitidas por el dominio |
| `USUARIO` | Operación autenticada de los módulos de negocio según reglas de cada servicio |
| `SOLO_LECTURA` | Consultas; el backend bloquea toda mutación distinta de `GET`, `HEAD` y `OPTIONS` |

La administración de usuarios está protegida por `requireRole("SUPER_USUARIO")`. La migración 035 amplía la restricción de roles en la tabla `itam.usuarios` para aceptar `SOLO_LECTURA`.

## Autenticación y sesiones

- Login por contraseña: `POST /api/v1/auth/login`.
- Login por PIN: `POST /api/v1/auth/login-pin`.
- Consulta de sesión: `GET /api/v1/auth/me`.
- Cambio de contraseña: `POST /api/v1/auth/change-password`.
- Cambio de PIN: `POST /api/v1/auth/change-pin`.
- Cierre: `POST /api/v1/auth/logout`.

La sesión se identifica con la cookie HTTP-only `itam_session`. El código utiliza `sameSite=lax`; el atributo `secure` depende del protocolo externo detectado por Express. La sesión se revoca por inactividad o expiración absoluta. Las contraseñas y PIN se almacenan como hashes; el documento de seguridad del repositorio indica contraseña mínima de 12 caracteres y PIN de seis dígitos.

## Accesos de despliegue

En la configuración de GitHub Actions se observaron los siguientes nombres de secretos. Sus valores no se incluyen:

- `AWS_HOST`.
- `AWS_USER`.
- `AWS_SSH_PRIVATE_KEY`.
- `AWS_KNOWN_HOSTS`.

Durante la puesta en producción se agregó `AWS_KNOWN_HOSTS` y se actualizó `AWS_HOST` con la IP pública observada `34.193.75.49`. El contenido de la llave privada y de la huella no se leyó ni se copia en este documento.

El job crea temporalmente `~/.ssh/itam_deploy_key` y `~/.ssh/known_hosts` en el runner, usa `scp` y `ssh`, y no conserva esas llaves dentro del release.

## Cuentas y acceso al servidor

La sesión mostró un prompt con usuario `ubuntu` y hostname interno `ip-172-26-14-137`. No se observaron grupos, `sudoers`, `authorized_keys`, MFA, origen permitido, bastion host ni reglas de firewall.

Estado: **Pendiente de validar con Codex** mediante revisión de solo lectura y sin copiar material sensible.

## Procedimiento recomendado de alta y baja

1. Solicitar responsable, alcance y fecha de expiración.
2. Crear la cuenta con el rol mínimo necesario.
3. Exigir cambio inicial de contraseña y PIN cuando corresponda.
4. Verificar que la sesión y las rutas visibles coincidan con el rol.
5. Revisar auditoría de mutaciones.
6. Desactivar la cuenta al término de la necesidad.
7. Revocar sesiones activas y llaves asociadas.
8. Rotar secretos de despliegue si una llave o cuenta pudo quedar expuesta.

## Hallazgos de seguridad

| Hallazgo | Clasificación | Acción |
| --- | --- | --- |
| Valores de secretos no expuestos en los documentos | Confirmado | Mantener la práctica |
| `AWS_KNOWN_HOSTS` fue necesario para conexión SSH | Confirmado | Mantenerlo como secreto protegido |
| MFA de GitHub/AWS no observado | Pendiente | Validar con administrador |
| Restricciones de SSH del servidor no observadas | Pendiente | Revisar `sshd_config`, grupos y origen |
| Rotación periódica de llaves no documentada | Riesgo | Definir periodicidad y responsable |
