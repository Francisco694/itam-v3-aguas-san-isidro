# Versionado del Frontend

**Actualizado:** 13 de octubre de 2026
**Tipo:** referencia técnica
**Commit de referencia:** `d8cd34c63293f293b0b5bf57f3219dbb8bfe7e0c`

## Identidad técnica

| Dato | Valor | Estado |
| --- | --- | --- |
| Framework | Angular `^22.1.0` | Confirmado |
| Angular CLI y build | `^22.1.4` | Confirmado |
| TypeScript | `~6.0.2` | Confirmado |
| RxJS | `~7.8.0` | Confirmado |
| Node en CI/CD | 24 | Confirmado en workflows |
| npm declarado | `11.17.0` | Confirmado en `package.json` |
| Commit documentado | `d8cd34c63293f293b0b5bf57f3219dbb8bfe7e0c` | Confirmado |

## Rutas y componentes

Las rutas Angular están en `frontend/src/app/app.routes.ts` y cargan componentes de dashboard, departamentos, colaboradores, dispositivos, SIM, estados, tipos, familias, alertas, offboarding, servicio técnico, actas, reportes, usuarios y Mi acceso. `MainLayout` protege el área autenticada; `authGuard`, `credentialChangeGuard` y `writeGuard` controlan acceso y credenciales.

## Servicios e integración

Los servicios del frontend usan `HttpClient` y `environment.apiUrl`, que en producción apunta al prefijo `/api/v1`. Las áreas principales tienen servicios para autenticación, dispositivos, catálogo técnico, colaboradores, departamentos, SIM, líneas, actas, comprobantes, reportes, offboarding y servicio técnico. El servicio técnico descarga `GET /servicio-tecnico/:id/envio/pdf` como `blob` y permite vista previa, reimpresión y descarga.

## Funcionalidades comprobadas por código

- Login, sesión HTTP-only, cambio inicial de contraseña y PIN.
- Panel gerencial y reportes.
- Inventario, detalle, asignación, devolución, baja, recuperación e historial.
- Catálogo técnico opcional en la ficha del dispositivo: consulta, vista en navegador y reemplazo del PDF.
- SIM, líneas móviles y asociaciones.
- Verificación física con resultado y evidencia.
- Actas, comprobantes, etiquetas QR e impresión.
- Servicio técnico por etapas, cotizaciones, adjuntos, equipos temporales y retorno.
- Offboarding con control de equipos pendientes.
- Usuarios con roles `SUPER_USUARIO`, `USUARIO` y `SOLO_LECTURA`.

## Compatibilidad con backend

El frontend debe consumir los contratos en `docs/api/` y el prefijo `/api/v1`. Las validaciones visuales mejoran la experiencia, pero el backend decide autorización, unicidad, estados, sesión, auditoría y mutaciones. El perfil solo lectura se protege también en `backend/src/shared/auth.middleware.ts`.

El catálogo técnico se carga desde `dispositivo-detail.ts` mediante `CatalogoTecnicoService`. La interfaz acepta solo PDF y 10 MB como máximo; el botón de descarga independiente no forma parte de la ficha porque el visor PDF del navegador permite descargar el documento. La carga es opcional y no modifica ningún atributo operativo del dispositivo.

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
| Catálogo técnico de dispositivo | `catalogo-tecnico.service.ts` y `dispositivo-detail.ts` | Confirmado en código; carga autenticada productiva pendiente |
| Compatibilidad real con release productivo | Health público y CD `d8cd34c` correctos; no se ejecutó carga autenticada | Confirmado parcialmente |

## Pendientes

- Ejecutar build y pruebas en el entorno de esta entrega.
- Revisar visualmente el manual DOCX generado.
- Ejecutar smoke test de PDF con una orden vacía, una con varios equipos y una con texto largo.
- Confirmar que el navegador productivo cargue el mismo release que el commit auditado.
