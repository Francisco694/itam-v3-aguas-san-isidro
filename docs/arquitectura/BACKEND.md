# Backend Express

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico

## Entrada de la aplicación

`backend/src/app.ts` configura CORS con origen explícito, Helmet, JSON, autenticación global para `/api/v1` salvo health, auditoría de mutaciones, módulos de rutas y manejadores finales de endpoint no encontrado y error.

## Módulos registrados

`auth`, `estados`, `departamentos`, `colaboradores`, `dispositivos`, `sim`, `familias-codigo`, `tipos-dispositivo`, `servicio-tecnico`, `actas-entrega`, `comprobantes-devolucion`, `reportes`, `facturas-adquisicion`, `usuarios`, `offboarding` y `alertas-stock`.

## Respuestas

Los controladores usan `sendItem` para respuestas individuales (`success` y `data`) y `sendCollection` para colecciones (`success`, `count` y `data`). Los PDF se envían como binario con `Content-Type: application/pdf`.

## Validación y errores

La validación compartida comprueba enteros positivos, textos, booleanos, enumeraciones, dinero y objetos JSON. Los errores de negocio se expresan como `AppError`; las violaciones de unicidad, clave foránea y restricciones de PostgreSQL se traducen a errores HTTP de dominio. Los errores no reconocidos se registran en servidor y responden con `INTERNAL_ERROR` sin exponer detalles internos.

## Persistencia

Los repositorios usan `pg` con consultas parametrizadas. Las operaciones que actualizan activo, custodia, estado, historial o documentos se realizan mediante servicios y transacciones cuando el flujo lo requiere. El esquema vigente se mantiene mediante `database/migrations/001` a `032`.

## Auditoría

Las mutaciones distintas de `GET`, `HEAD` y `OPTIONS` se registran al finalizar la respuesta en `itam.auditoria_operaciones`, incluyendo usuario, método, ruta, estado HTTP y contexto de query.
