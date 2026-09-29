# Base de datos

**Actualizado:** 29 de septiembre de 2026
**Tipo:** técnico

## Motor y esquema

ITAM utiliza PostgreSQL. Las tablas de negocio se encuentran en el esquema `itam`; `schema_migrations` registra la secuencia aplicada. La aplicación conecta mediante `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.

## Migraciones

Las migraciones están en `database/migrations`. La secuencia vigente llega a `032_technical_service_quotes.sql` e incluye, entre otros, catálogo de tipos, familias de códigos, ciclo patrimonial, custodias temporales, verificación física, alertas de stock, líneas móviles, offboarding y cotizaciones.

## Versionamiento y estado de migraciones

El repositorio contiene migraciones SQL numeradas desde `001` hasta `032`. En la base `itam_dev`, dentro del esquema `itam`, el estado analizado es el siguiente:

- `001`–`028`: registradas como aplicadas.
- `029`: pendiente y fuera de secuencia.
- `030`–`032`: registradas como aplicadas después de la `029`.
- Total registrado actualmente en la base: 31 migraciones.
- No existen migraciones registradas en la base que no estén presentes en el repositorio.

La migración `029_simplify_technical_service.sql` no debe ejecutarse directamente sin una revisión específica. Migraciones posteriores ya incorporaron parte de sus cambios y la ejecución directa podría intentar crear columnas o restricciones que ya existen.

Este estado no representa un problema resuelto. Debe tratarse como deuda técnica y reconciliación pendiente. El detalle y la evidencia se mantienen en [Estado de migraciones](../database/ESTADO_MIGRACIONES.md) y [Estado actual de la base](../database/ESTADO_ACTUAL_BD.md).

## Estructura real de `schema_migrations`

La tabla actual `itam.schema_migrations` contiene las columnas:

| Columna | Uso actual |
| --- | --- |
| `version` | Versión textual registrada, por ejemplo `001`. |
| `nombre` | Nombre lógico de la migración. |
| `aplicado_en` | Fecha y hora de registro de aplicación. |

La tabla permite conocer qué versiones fueron registradas y cuándo. Actualmente no posee una columna `filename` separada ni un `checksum` del contenido SQL. Por ello no permite detectar automáticamente si un archivo de migración aplicado fue modificado después de su ejecución.

## Limitaciones actuales del control de migraciones

- No existe un runner oficial para ordenar, validar y ejecutar migraciones.
- No se almacenan checksums SHA-256.
- La trazabilidad entre el registro y el nombre físico del archivo es parcial.
- El historial contiene una versión fuera de secuencia (`029`).
- Las migraciones `009` y `018` presentan características históricas atípicas documentadas aparte.
- La base y el repositorio pueden parecer alineados por número, pero actualmente no existe una validación automática de contenido.

Estas limitaciones están documentadas y no se corrigen en esta etapa. No se modifica `schema_migrations`, no se agregan checksums y no se ejecutan migraciones como parte de esta actualización documental.

## Diferencias actuales detectadas entre backend y esquema

El backend referencia los campos `tipo_servicio` y `accesorios_entregados` en el flujo de servicio técnico. En la base `itam_dev` analizada, dichas columnas no existen actualmente en `itam.ordenes_servicio_tecnico`.

Esto queda registrado como pendiente de reconciliación. En esta etapa no se agregan columnas, no se modifica el backend y no se crea una nueva migración.

## Entidades principales

| Área | Tablas o conceptos |
| --- | --- |
| Organización | `departamentos`, `colaboradores` |
| Catálogo | `estados`, `tipos_dispositivo`, `familias_codigo_inventario` |
| Inventario | `dispositivos`, `sim`, `lineas_moviles` |
| Trazabilidad | `historial_eventos`, `custodias_dispositivo`, `verificaciones_fisicas_dispositivo` |
| Operación | `ordenes_servicio_tecnico`, `entregas_temporales_servicio`, `procesos_offboarding` |
| Documentos | `facturas_adquisicion`, `actas_entrega`, `actas_entrega_detalle`, `comprobantes_devolucion`, archivos de cotización |
| Seguridad | `usuarios`, `sesiones_usuario`, `auditoria_operaciones` |
| Configuración | `configuraciones_alerta_stock`, secuencias de actas y comprobantes |

## Integridad destacada

- `codigo_inventario` es único e inmutable.
- IMEI, número de serie, ICCID, número de acta y número de comprobante tienen unicidad según su dominio.
- Un dispositivo no puede tener más de una custodia vigente.
- Una orden técnica abierta y una entrega temporal abierta se protegen con índices únicos parciales.
- Los valores comerciales y montos no pueden ser negativos.
- Las relaciones usan claves foráneas y restricciones `CHECK`.
- El JSON de atributos específicos se valida contra la configuración del tipo de dispositivo.

## Documentos y respaldos

Los metadatos se guardan en PostgreSQL y el binario se conserva en la ruta configurada. Antes de una migración o despliegue se debe realizar y verificar un backup PostgreSQL según el checklist de producción.
