# Frontend Angular

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional

## Estructura

El frontend está en `frontend/src/app` y utiliza Angular con componentes standalone, rutas lazy y servicios inyectables. `MainLayout` contiene la navegación protegida; `authGuard` protege el área autenticada y `credentialChangeGuard` limita el acceso mientras el usuario deba actualizar sus credenciales.

## Rutas funcionales actuales

`/login`, `/dashboard`, `/departamentos`, `/colaboradores`, `/dispositivos`, `/sim`, `/estados`, `/tipos-dispositivo`, `/alertas-stock`, `/familias-codigo`, `/offboarding`, `/servicio-tecnico`, `/actas`, `/reportes`, `/administracion/usuarios` y `/mi-acceso`. La ruta comodín presenta la vista de no encontrado.

## Integración

- `environment.ts` usa `http://localhost:3000/api/v1` en desarrollo.
- `environment.production.ts` usa `/api/v1` para despliegue detrás del mismo origen.
- `proxy.lan.json` redirige `/api/v1` a `127.0.0.1:3000` para operación LAN.
- La sesión se transporta mediante la cookie `itam_session`; el frontend no administra el token como dato visible de negocio.
- Los servicios de dominio normalizan respuestas `data` y exponen observables a las vistas.

## Áreas destacadas

- Dashboard: indicadores patrimoniales, verificación, stock e histórico.
- Dispositivos: listado, alta, edición, ficha, custodia, etiquetas, SIM/línea, historial y servicio técnico.
- SIM: catálogo, asociación, asignación y trazabilidad.
- Actas y reportes: emisión y descarga de PDF.
- Offboarding: búsqueda, apertura, seguimiento y cierre.

## Estado documental

La documentación describe las rutas y componentes presentes en `frontend/src/app/app.routes.ts`. No se documentan pantallas que no tengan una ruta vigente.
