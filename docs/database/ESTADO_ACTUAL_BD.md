# Estado actual de la base de datos

**Fecha del análisis:** 29 de septiembre de 2026
**Base analizada:** `itam_dev`
**Schema:** `itam`
**Tipo:** fotografía técnica, no ejecutable

## Versionamiento

| Elemento | Estado |
| --- | --- |
| Migraciones existentes en el repositorio | `001`–`032` |
| Migraciones registradas como aplicadas | 31 |
| Migración pendiente/fuera de secuencia | `029` |
| Migraciones posteriores aplicadas | `030`–`032` |
| Registros en BD sin archivo en repositorio | Ninguno detectado |

## Observaciones técnicas

- `009` presenta una inconsistencia de registro: el archivo no registra su propia ejecución, aunque existe una fila para la versión en la base analizada.
- `018` corresponde a una verificación histórica y no a una migración estructural convencional.
- `029` quedó fuera de secuencia y no debe ejecutarse directamente.
- Faltan `tipo_servicio` y `accesorios_entregados` en `itam.ordenes_servicio_tecnico`.
- `schema_migrations` no utiliza checksum y no permite verificar automáticamente modificaciones posteriores del SQL aplicado.

Ninguna de estas observaciones se presenta como corregida. Este documento registra el estado encontrado para orientar una futura reconciliación.

## Alcance y seguridad del análisis

El estado se obtuvo mediante inspección del repositorio y consultas de lectura sobre la base local. No se modificaron datos, tablas, migraciones, backend, frontend ni configuración del proyecto.
