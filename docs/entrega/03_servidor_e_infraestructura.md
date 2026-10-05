# Información del Servidor e Infraestructura

> Archivo histórico conservado por compatibilidad. La fuente canónica de entrega es [`03_Informacion_del_Servidor_e_Infraestructura.md`](03_Informacion_del_Servidor_e_Infraestructura.md).

## Propósito y alcance

Este documento separa la infraestructura observada de la infraestructura solamente referenciada por el código de despliegue. No contiene credenciales, llaves ni valores de secretos.

## Identidad del release activo

| Campo | Valor seguro | Estado | Fuente |
| --- | --- | --- | --- |
| Proveedor | AWS | Confirmado | `.github/workflows/cd.yml`, ejecución CD |
| Release activo | `d98da12` | Confirmado | Captura de `htop` en servidor |
| Backend activo | `/opt/itam/releases/d98da12/backend/dist/server.js` | Confirmado | Captura de `htop` |
| Host público observado | `34.193.75.49` | Confirmado | Comando `curl https://checkip.amazonaws.com` en servidor |
| Hostname interno observado | `ip-172-26-14-137` | Confirmado | Prompt de shell mostrado en sesión |
| Sistema operativo | Ubuntu Linux, distribución exacta pendiente | Parcial | Prompt `ubuntu@...` |
| Región AWS | No observada | Pendiente de validar con Codex | Consola AWS requerida |
| Tipo de instancia | No observado | Pendiente de validar con Codex | Consola AWS requerida |

## Proceso y recursos observados

La captura de `htop` mostró un proceso Node ejecutando el backend desde el release `d98da12`. En la misma captura se observaron aproximadamente 339 MB de 910 MB de memoria usada, 93,1 MB de 2 GB de swap utilizada, carga media 0.00/0.01/0.00 y uptime aproximado de 2 días y 21 horas. Es una fotografía de la sesión y no una métrica histórica.

## Arquitectura de red esperada

```text
Navegador
  -> HTTPS terminado en Nginx
  -> frontend estático del release activo
  -> /api/v1 proxificado a 127.0.0.1:3000
  -> Node.js / Express
  -> PostgreSQL
```

El backend declara `BACKEND_HOST=127.0.0.1` por defecto y el CD verifica `http://127.0.0.1:3000/api/v1/health`. `frontend/src/environments/environment.production.ts` usa `/api/v1`, por lo que frontend y API deben publicarse bajo el mismo origen.

## Nginx

El workflow remoto referencia `/etc/nginx/sites-enabled/itam`, realiza copia de respaldo en `/var/backups/itam/` y ejecuta `nginx -t` antes de recargar. La existencia y contenido actual del archivo, `server_name`, TLS, redirecciones, `root`, `proxy_pass` y headers no fueron leídos directamente en esta sesión.

Estado: **Pendiente de validar con Codex** mediante acceso de lectura al servidor y `sudo nginx -T` o revisión equivalente.

## PM2 y servicio

El CD busca un proceso PM2 llamado `itam-backend`, obtiene su `pm_cwd`, inicia el nuevo backend con `--cwd`, espera el health check y ejecuta `pm2 save`. La captura confirmó el proceso Node del release, pero no mostró `pm2 jlist`, reinicios acumulados, archivo de logs ni la configuración de arranque persistente.

Estado de PM2 detallado: **Pendiente de validar con Codex**.

## PostgreSQL

La aplicación usa variables `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. El health check de base de datos existe en `/api/v1/health/database` y responde con nombre de base y usuario sin exponer la contraseña. El nombre productivo de la base, versión del servidor PostgreSQL, región de la base, cifrado, backups y reglas de red no fueron observados.

## Firewall, DNS y certificados

No se observaron directamente Security Groups, reglas IPv4/IPv6, DNS, certificados, Certbot, SAN, expiración ni timers de renovación. No se deben declarar como configurados a partir del mero uso de Nginx en el código.

## Fuentes y próximos datos requeridos

| Dato | Fuente observada | Estado | Próximo paso seguro |
| --- | --- | --- | --- |
| Release y proceso Node | Captura de `htop` | Confirmado | Conservar como evidencia fechada |
| IP pública | Salida de `checkip.amazonaws.com` | Confirmado | Confirmar que coincide con DNS y `AWS_HOST` |
| Nginx activo | No disponible | Pendiente | Inspección de solo lectura |
| PM2 y logs | No disponible | Pendiente | `pm2 jlist`, `pm2 logs --lines 100` sin secretos |
| Firewall y puertos | No disponible | Pendiente | Consola AWS o inventario autorizado |
| Certbot y renovación | No disponible | Pendiente | `certbot certificates` y timer, solo lectura |
