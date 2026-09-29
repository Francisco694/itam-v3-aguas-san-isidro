# Cómo crear una migración

Esta guía aplica a futuras modificaciones estructurales de PostgreSQL en ITAM.

1. Revisar los archivos existentes en `database/migrations`.
2. Revisar las filas actuales de `itam.schema_migrations`.
3. Identificar la última versión realmente aplicada.
4. Crear una nueva migración con el siguiente número disponible y un nombre descriptivo.
5. Nunca modificar una migración ya aplicada.
6. Probar la migración en un entorno de desarrollo.
7. Hacer y verificar un backup antes de aplicarla en producción.
8. Validar dependencias, columnas, restricciones, índices y datos existentes.
9. Documentar el propósito, el impacto y cualquier decisión de compatibilidad.
10. Revisar migraciones fuera de secuencia antes de aplicar nuevas migraciones.

## Convención de nombres

Usar el formato:

```text
NNN_descripcion_corta.sql
```

El número debe ser único y seguir la secuencia histórica. La migración debe ser explícita sobre los objetos que crea o modifica y debe considerar si existen instalaciones parcialmente actualizadas.

## Advertencia vigente

Actualmente existe una anomalía histórica en la migración `029`. Antes de ejecutar nuevas migraciones que afecten servicio técnico, revisar [ESTADO_MIGRACIONES.md](ESTADO_MIGRACIONES.md).

No ejecutar `029_simplify_technical_service.sql` directamente hasta definir y revisar una estrategia de reconciliación.

## Antes de producción

- confirmar el estado de la base objetivo;
- revisar dependencias con el backend;
- ejecutar un backup PostgreSQL verificable;
- probar el SQL en una base equivalente;
- registrar la versión y el resultado de la aplicación;
- conservar la migración en el repositorio sin renombrarla ni editarla después de aplicarla.

Esta guía documenta el proceso esperado. En esta etapa todavía no existe un runner oficial que automatice estas validaciones.
