# Estado de migraciones

**Actualizado:** 30 de septiembre de 2026
**Base analizada:** `itam_dev`
**Esquema:** `itam`
**Tipo:** estado técnico e histórico

## Resumen

El repositorio contiene migraciones SQL numeradas desde `001` hasta `032`. La base analizada registra 31 migraciones aplicadas. La versión `029` no está registrada como aplicada, pero las versiones `030`, `031` y `032` sí aparecen registradas posteriormente.

| Rango/Versión | Estado | Observación |
| --- | --- | --- |
| `001`–`028` | `APPLIED` | Registradas como aplicadas en `itam.schema_migrations`. |
| `029` | `OUT_OF_SEQUENCE` | Pendiente; existen migraciones posteriores registradas. Requiere revisión antes de ejecutar. |
| `030`–`032` | `APPLIED` | Registradas como aplicadas después de la `029`. |

No existen registros en la base para versiones que no tengan un archivo correspondiente en el repositorio.

## Migración 009

El archivo `009_department_dependencies.sql` existe en el repositorio, pero no contiene un registro propio en `schema_migrations`. La base analizada sí contiene una fila para la versión `009`, por lo que el registro actual existe, pero la forma en que se produjo no puede demostrarse únicamente desde el archivo.

Esta inconsistencia no debe corregirse retrospectivamente sin análisis de la historia y de la base. El archivo se conserva sin modificaciones.

## Migración 018

El archivo `018_session_idle_timeout.sql` contiene una consulta de verificación sobre `sesiones_usuario.ultima_actividad`. No modifica el esquema ni representa una migración estructural convencional.

Se mantiene como artefacto histórico. La base analizada registra la versión `018`, pero el contenido del archivo debe considerarse una comprobación histórica (`HISTORICAL CHECK`), no una referencia de cambio estructural.

## Migración 029

La migración `029_simplify_technical_service.sql` quedó fuera de secuencia. Migraciones posteriores incorporaron parte de los cambios que intenta realizar. En el esquema actual:

- algunas columnas que `029` intenta crear ya existen;
- la restricción relacionada con el estado final ya existe;
- las columnas `tipo_servicio` y `accesorios_entregados` siguen faltando.

Por estas razones, `029` no debe ejecutarse directamente. Su ejecución requiere una reconciliación futura mediante una nueva migración, sin modificar ni borrar el historial anterior.

## Diferencias actuales entre backend y esquema

El backend referencia los campos:

- `tipo_servicio`;
- `accesorios_entregados`.

Ambos campos no existen actualmente en `itam.ordenes_servicio_tecnico` de `itam_dev`. Esta diferencia queda como pendiente de reconciliación. No se agregan columnas ni se modifica el backend en esta etapa.

## Recomendación de reconciliación futura

La migración correctiva preparada para esta reconciliación es:

```text
033_reconcile_technical_service_schema.sql
```

Su objetivo sería:

- agregar únicamente las columnas realmente faltantes;
- evitar recrear columnas o restricciones ya existentes;
- reconciliar la diferencia dejada por `029`;
- mantener intacta la historia anterior.

El archivo está preparado. Se validó únicamente en bases temporales aisladas; no se ejecutó sobre `itam_dev`, `itam_prod` ni AWS.

## Alcance de esta documentación

En esta etapa no se creó un runner, no se modificó `schema_migrations` de una base original, no se agregaron checksums y no se modificaron migraciones históricas. La validación temporal quedó documentada en [RECONCILIACION_029.md](RECONCILIACION_029.md).

## Actualización posterior: migración 033 preparada

La migración `033_reconcile_technical_service_schema.sql` ya está preparada en el repositorio y fue ejecutada únicamente en bases temporales. Agrega las columnas faltantes, conserva `NULL` para los tipos históricos desconocidos, evita duplicar restricciones y registra solo la versión `033`.

La versión `029` permanece deliberadamente sin registrar. La estrategia para validarla en copias aisladas y el tratamiento que deberá implementar un futuro runner están documentados en [RECONCILIACION_029.md](RECONCILIACION_029.md). La recomendación anterior de crear `033` debe entenderse como completada en forma de archivo preparado, no como una migración ejecutada.
