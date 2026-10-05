# Versionado del Frontend

## Identidad técnica

| Dato | Valor | Estado |
| --- | --- | --- |
| Framework | Angular `^22.1.0` | Confirmado |
| Angular CLI y build | `^22.1.4` | Confirmado |
| TypeScript | `~6.0.2` | Confirmado |
| RxJS | `~7.8.0` | Confirmado |
| Node en CI/CD | 24 | Confirmado en workflows |
| npm declarado | `11.17.0` | Confirmado en `package.json` |
| Commit documentado | `754d036f00aa24b180c3812c460a2b18bd82b1a5` | Confirmado |

## Rutas y componentes

Las rutas Angular están en `frontend/src/app/app.routes.ts` y cargan componentes de dashboard, departamentos, colaboradores, dispositivos, SIM, estados, tipos, familias, alertas, offboarding, servicio técnico, actas, reportes, usuarios y Mi acceso. `MainLayout` protege el área autenticada; `authGuard`, `credentialChangeGuard` y `writeGuard` controlan acceso y credenciales.

## Servicios e integración

Los servicios del frontend usan `HttpClient` y `environment.apiUrl`, que en producción apunta al prefijo `/api/v1`. Las áreas principales tienen servicios para autenticación, dispositivos, colaboradores, departamentos, SIM, líneas, actas, comprobantes, reportes, offboarding y servicio técnico. El servicio técnico descarga `GET /servicio-tecnico/:id/envio/pdf` como `blob` y permite vista previa, reimpresión y descarga.

## Funcionalidades comprobadas por código

- Login, sesión HTTP-only, cambio inicial de contraseña y PIN.
- Panel gerencial y reportes.
- Inventario, detalle, asignación, devolución, baja, recuperación e historial.
- SIM, líneas móviles y asociaciones.
- Verificación física con resultado y evidencia.
- Actas, comprobantes, etiquetas QR e impresión.
- Servicio técnico por etapas, cotizaciones, adjuntos, equipos temporales y retorno.
- Offboarding con control de equipos pendientes.
- Usuarios con roles `SUPER_USUARIO`, `USUARIO` y `SOLO_LECTURA`.

## Compatibilidad con backend

El frontend debe consumir los contratos en `docs/api/` y el prefijo `/api/v1`. Las validaciones visuales mejoran la experiencia, pero el backend decide autorización, unicidad, estados, sesión, auditoría y mutaciones. El perfil solo lectura se protege también en `backend/src/shared/auth.middleware.ts`.

## Compilación y pruebas

```text
npm ci
npm run build
npm test
npm start
npm run start:lan
```

El build de producción debe producir `frontend/dist/frontend/browser/index.html`. CI verifica ese archivo. La ejecución completa de build y tests para este cierre documental debe registrarse en `docs/INFORME_FINAL_DE_VALIDACION.md` con su resultado real.

## Correcciones y cambios identificables

| Cambio | Evidencia | Estado |
| --- | --- | --- |
| Ocultamiento de mutaciones para solo lectura | Templates de dispositivos, servicio técnico y `writeGuard` | Confirmado |
| Vista previa y descarga de PDF de OT | `frontend/src/app/features/servicio-tecnico/servicio-tecnico.ts` | Confirmado |
| Impresión de etiqueta con QR | `frontend/src/app/shared/components/asset-label/asset-label.ts` | Confirmado |
| Correlativo visible de OT | Método `technicalOrderNumber` y modelo de orden | Confirmado |
| Compatibilidad real con release productivo | No se ejecutó smoke test productivo | Pendiente de validar |

## Pendientes

- Ejecutar build y pruebas en el entorno de esta entrega.
- Revisar visualmente el manual DOCX generado.
- Ejecutar smoke test de PDF con una orden vacía, una con varios equipos y una con texto largo.
- Confirmar que el navegador productivo cargue el mismo release que el commit auditado.
