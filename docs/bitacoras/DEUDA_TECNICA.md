# Deuda técnica y bloqueadores

**Actualizado:** 13 de octubre de 2026
**Tipo:** técnico y operativo

Este archivo registra problemas conocidos que no bloquean el
desarrollo diario pero que deben resolverse antes de un despliegue
a producción o una entrega formal.

## Bloqueadores de build

- **Presupuesto de CSS en Angular:** `dashboard.scss` alcanza
  ~19.91 kB y supera el máximo configurado de 10 kB en
  `angular.json`. Esto impide que `ng build` genere el bundle de
  producción. Se debe refactorizar el SCSS o ajustar el budget
  de manera justificada.

## Base de datos y migraciones

- **Migración 029 fuera de secuencia:** La migración
  `029_simplify_technical_service.sql` figura como pendiente y
  fuera de secuencia. No debe ejecutarse sin una revisión previa
  porque migraciones posteriores ya incorporaron parte de sus
  cambios.
- **Columnas faltantes en `itam.ordenes_servicio_tecnico`:**
  El backend referencia `tipo_servicio` y `accesorios_entregados`,
  pero estas columnas no existen en la base de datos `itam_dev`
  analizada. Requiere migración correctiva o ajuste en el backend.

## Otros pendientes

- (Agregar aquí futuros hallazgos)
