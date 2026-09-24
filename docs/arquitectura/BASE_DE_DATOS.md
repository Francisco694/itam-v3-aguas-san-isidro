# Base de datos

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico

## Motor y esquema

ITAM utiliza PostgreSQL. Las tablas de negocio se encuentran en el esquema `itam`; `schema_migrations` registra la secuencia aplicada. La aplicación conecta mediante `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.

## Migraciones

Las migraciones están en `database/migrations`. La secuencia vigente llega a `032_technical_service_quotes.sql` e incluye, entre otros, catálogo de tipos, familias de códigos, ciclo patrimonial, custodias temporales, verificación física, alertas de stock, líneas móviles, offboarding y cotizaciones.

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
