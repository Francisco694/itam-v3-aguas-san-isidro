# Gestión de accesos y credenciales de producción

**Actualizado:** 16 de octubre de 2026
**Clasificación:** interno y restringido
**Estado:** guía de entrega sin valores secretos

## Propósito

Este documento identifica las credenciales necesarias para operar y publicar ITAM en producción. Los valores reales no se almacenan en Git, en este manual, en tickets, en capturas ni en comandos.

## Inventario de accesos

| Acceso | Valores o nombres requeridos | Ubicación segura | Responsable |
| --- | --- | --- | --- |
| GitHub Actions / AWS | `AWS_HOST`, `AWS_USER`, `AWS_SSH_PRIVATE_KEY`, `AWS_KNOWN_HOSTS` | GitHub Environment `production`, sección **Secrets** | Administrador de despliegue |
| PostgreSQL productivo | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | `.env` privado del release activo en el servidor | DBA / Operaciones |
| Usuario de la aplicación | correo, contraseña y PIN cuando corresponda | Gestor de contraseñas autorizado | Administrador ITAM |
| Acceso a AWS | usuario, MFA y recuperación | IAM y gestor de contraseñas autorizado | Administrador AWS |

El workflow de CD consume exactamente los cuatro secretos de GitHub indicados en la primera fila. El backend exige las cinco variables de PostgreSQL. En la evidencia de producción se observaron `DB_NAME=itam_prod` y `DB_USER=itam_app`; deben confirmarse antes de una intervención.

## Ubicación de configuración en el servidor

El CD conserva el archivo `.env` del release anterior y lo copia al nuevo release:

```text
/opt/itam/releases/<release>/backend/.env
```

El archivo debe ser legible únicamente por el usuario que ejecuta el backend. No debe copiarse al repositorio ni incluirse en los archivos `.tar.gz` de entrega. La ruta de documentos debe usar almacenamiento persistente mediante `DOCUMENT_STORAGE_PATH`.

## Configuración de GitHub Actions

En el repositorio, abrir **Settings → Environments → production → Secrets** y comprobar que existan:

```text
AWS_HOST
AWS_USER
AWS_SSH_PRIVATE_KEY
AWS_KNOWN_HOSTS
```

No colocar la contraseña de PostgreSQL ni la contraseña de usuarios ITAM en GitHub Actions si el workflow no las necesita. El CD las obtiene del `.env` privado del servidor.

## Entrega segura de credenciales

1. Crear o localizar una entrada en el gestor de contraseñas de la organización.
2. Compartir el acceso con la persona responsable mediante el gestor, nunca por Git, correo sin cifrar, chat o captura.
3. Configurar cada secreto en su ubicación correspondiente.
4. Validar el acceso sin imprimir valores secretos en pantalla ni en logs.
5. Registrar solamente la fecha, responsable y resultado de la validación; nunca el valor de la contraseña, PIN, token o llave privada.

## Rotación y revocación

- Rotar inmediatamente una contraseña, PIN, llave SSH o secreto que haya sido expuesto.
- Después de rotar PostgreSQL, actualizar el `.env` privado y reiniciar el backend mediante el procedimiento operativo autorizado.
- Después de rotar la llave SSH, actualizar `AWS_SSH_PRIVATE_KEY` y `AWS_KNOWN_HOSTS` en el Environment `production`.
- Desactivar cuentas de personas que ya no administren el sistema y revisar el acceso MFA de AWS.
- Confirmar el health check y el inicio de sesión después de una rotación, sin registrar credenciales.

## Lista de comprobación de entrega

- [ ] El responsable de operaciones recibió acceso al gestor de contraseñas.
- [ ] Los cuatro secretos de despliegue existen en GitHub Environment `production`.
- [ ] El `.env` del release activo existe y no está dentro del repositorio.
- [ ] `DB_NAME` y `DB_USER` fueron confirmados con el DBA.
- [ ] Existe al menos un usuario `SUPER_USUARIO` activo y con cambio inicial completado.
- [ ] Las cuentas de prueba o temporales fueron desactivadas.
- [ ] Se verificó `/api/v1/health` y el acceso autenticado.
- [ ] Se registró la fecha de la última rotación sin documentar valores secretos.

## Prohibiciones

No guardar contraseñas, PIN, tokens, cookies, hashes, llaves privadas ni cadenas de conexión con contraseña en archivos versionados, documentación pública, issues, logs, capturas o mensajes de commit.
