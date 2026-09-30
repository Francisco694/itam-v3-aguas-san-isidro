# Reconciliación de la migración 029

**Estado:** propuesta preparada para revisión; no ejecutada.

## Diagnóstico definitivo

La base `itam_dev` tiene registradas las versiones `001`–`028` y `030`–`032`. La versión `029` no está registrada, pero su archivo no puede ejecutarse directamente porque intenta crear nuevamente columnas y restricciones que fueron incorporadas por `031`.

La instalación actual presenta esta diferencia en `itam.ordenes_servicio_tecnico`:

| Elemento | Base actual | Instalación nueva después de 029–032 | Backend |
| --- | --- | --- | --- |
| `tipo_servicio` | Falta | `VARCHAR(20) NOT NULL DEFAULT 'DIAGNOSTICO'` por 029 | Lo inserta y lee |
| `accesorios_entregados` | Falta | `TEXT` por 029 | Lo inserta y lee |
| `plazo_informado` | `VARCHAR(120)` | `VARCHAR(120)` | Lo actualiza y lee |
| `estado_final` | `VARCHAR(50)` | `VARCHAR(50)` por 031 | Lo actualiza y lee |
| `observaciones_retorno` | `TEXT` | `TEXT` por 031 | Lo actualiza y lee |
| `chk_orden_servicio_estado_final` | Existe | Existe por 031 | Compatible |
| `chk_orden_servicio_tipo_servicio` | Falta | Existe por 029 | Necesaria |

El archivo `033_reconcile_technical_service_schema.sql` agrega solamente las columnas faltantes, crea la restricción faltante sin duplicar la existente y deja registrado `033` usando la estructura real de `schema_migrations`.

## Decisión sobre `DIAGNOSTICO`

La migración 029 declara `tipo_servicio NOT NULL DEFAULT 'DIAGNOSTICO'`. Aplicarla sobre una tabla con órdenes históricas convertiría automáticamente todas esas órdenes en diagnósticos, aunque el dato original no lo confirme.

La migración 033 no utiliza ese valor predeterminado y no actualiza filas antiguas. La columna queda nullable para representar explícitamente el estado “tipo histórico desconocido”. Las altas y ediciones del backend requieren uno de los cuatro valores permitidos y lo envían de forma explícita.

Esto conserva la información existente y evita una clasificación inventada. La consecuencia es intencional: una instalación reconciliada puede contener `NULL` históricos, mientras que una instalación nueva ejecutada desde 029 puede tener `DIAGNOSTICO` por el diseño histórico de esa migración.

## Tratamiento de 029

La versión `029` no debe registrarse artificialmente en `schema_migrations`. La fila ausente es una señal histórica válida: el archivo nunca fue aplicado en esa base.

La versión `033` tampoco la marca como aplicada. Por lo tanto, un futuro runner no puede limitarse a “buscar el número faltante y ejecutar el archivo”. Debe reconocer una excepción de reconciliación explícita:

1. detectar que `029` falta y que `030`–`032` ya están registradas;
2. verificar que las precondiciones estructurales de `033` son compatibles;
3. omitir `029` como migración supersedida para esa instalación, sin insertar una fila falsa;
4. aplicar `033` y registrar únicamente `033`.

Mientras no exista un runner con ese mecanismo, `033` debe ejecutarse de forma revisada y controlada sobre la copia aislada descrita abajo. No se debe ejecutar el directorio completo en orden sobre una base que ya tiene `030`–`032`.

## Validación segura

### Escenario A: copia aislada de la estructura actual

La copia no debe contener datos empresariales. Se puede conservar únicamente el historial de migraciones, porque no es información de negocio.

1. Crear un dump de estructura de `itam_dev`, sin `--data`.
2. Crear un dump separado, únicamente de `itam.schema_migrations`.
3. Restaurar ambos dumps en una base temporal nueva.
4. Verificar que la nueva base conserva la ausencia de `029`, la presencia de `030`–`032` y las columnas confirmadas en el diagnóstico.
5. Ejecutar `033` con `ON_ERROR_STOP=1`.
6. Verificar columnas, tipos, restricciones y la fila `033`.
7. Confirmar que no existe fila `029` y que no se modificaron ni eliminaron órdenes.

Ejemplo con nombres y credenciales temporales, nunca de producción:

```powershell
pg_dump --schema-only --no-owner --no-privileges --dbname=$env:SOURCE_DB > current_schema.sql
pg_dump --data-only --table=itam.schema_migrations --dbname=$env:SOURCE_DB > migration_history.sql
createdb $env:RECONCILE_DB
psql --dbname=$env:RECONCILE_DB --set=ON_ERROR_STOP=1 --file=current_schema.sql
psql --dbname=$env:RECONCILE_DB --set=ON_ERROR_STOP=1 --file=migration_history.sql
psql --dbname=$env:RECONCILE_DB --set=ON_ERROR_STOP=1 --file=database/migrations/033_reconcile_technical_service_schema.sql
```

### Escenario B: instalación vacía

1. Crear otra base temporal completamente vacía.
2. Aplicar las migraciones `001` a `032` estrictamente en orden numérico, con `ON_ERROR_STOP=1`. En una instalación nueva, `029` se ejecuta antes de `030` y `031`, por lo que no existe la colisión observada en `itam_dev`.
3. Aplicar `033` como siguiente migración.
4. Validar que `schema_migrations` contiene `001`–`033`, incluida `029` en este escenario nuevo.
5. Validar que `ordenes_servicio_tecnico` contiene todas las columnas, tipos y restricciones que consulta el backend.

La migración `009` no registra su propia fila; `012` verifica su estructura y registra `009`. Ese comportamiento histórico debe conservarse durante esta prueba y no debe “corregirse” editando migraciones antiguas.

## Consultas de verificación

Ejecutar en cada base temporal después de la migración:

```sql
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'itam'
  AND table_name = 'ordenes_servicio_tecnico'
  AND column_name IN (
    'tipo_servicio', 'accesorios_entregados', 'plazo_informado',
    'estado_final', 'observaciones_retorno'
  )
ORDER BY column_name;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'itam.ordenes_servicio_tecnico'::regclass
  AND conname IN (
    'chk_orden_servicio_tipo_servicio',
    'chk_orden_servicio_estado_final'
  )
ORDER BY conname;

SELECT version, nombre, aplicado_en
FROM itam.schema_migrations
WHERE version IN ('029', '030', '031', '032', '033')
ORDER BY version;
```

En el escenario A se espera que `029` no aparezca y `033` sí. En el escenario B se espera que aparezcan las cinco versiones.

## Riesgos y pendientes

- La migración 033 falla deliberadamente si encuentra valores inválidos de `tipo_servicio`, `estado_final` o valores de `estado_final` con más de 50 caracteres; no trunca ni corrige datos silenciosamente.
- Las órdenes históricas con `tipo_servicio IS NULL` requieren una decisión funcional posterior si se necesita completar ese dato. No debe inferirse automáticamente.
- El frontend actual tipa `tipoServicio` como no nulo y su etiqueta visual usa `Diagnóstico` como fallback cuando recibe un valor vacío. Por eso la migración conserva correctamente el dato como `NULL`, pero la interfaz podría mostrar “Diagnóstico” para una orden histórica desconocida hasta que se defina una corrección de presentación. Esa corrección queda fuera de esta tarea porque no se modifica backend ni frontend.
- No existe todavía un runner oficial que gestione la excepción 029. La automatización de despliegue debe incorporar esa regla antes de usar migraciones en AWS.
- La prueba de integración del backend requiere además fixtures mínimos de dispositivos, estados, tipos y usuarios. La compatibilidad estructural no equivale por sí sola a que toda la batería de pruebas esté lista.
- Este procedimiento no utiliza `itam_dev`, `itam_prod` ni credenciales de producción y no debe ejecutarse contra ellos.

## Resultado de la validación temporal

La validación autorizada se ejecutó el 30 de septiembre de 2026 en un clúster PostgreSQL 18 temporal, aislado y eliminado al finalizar. El dump de origen incluyó únicamente DDL y la tabla `itam.schema_migrations`; no se copiaron filas de negocio.

### Escenario A: estructura actual + 033

Resultado: **correcto**.

- `033` se aplicó sin errores.
- `tipo_servicio` quedó `VARCHAR(20)`, nullable y sin default.
- `accesorios_entregados` quedó `TEXT`.
- `estado_final` quedó `VARCHAR(50)`.
- Las restricciones de tipo de servicio y estado final quedaron presentes una sola vez.
- `029` permaneció ausente y `033` fue la única nueva fila de historial.
- Las tablas de negocio restauradas quedaron sin filas; solo se restauró `schema_migrations`.

### Escenario B: base vacía

Resultado: **bloqueado por una anomalía histórica anterior a 033**.

Las migraciones `001`–`022` finalizaron. La `023` falló en una base completamente vacía porque exige los registros auditados `colaboradores.id = 1` y `id = 392`. Además, la migración inicial declara `rut` único, mientras que 023 espera temporalmente dos filas con el mismo RUT para eliminar el duplicado 392. Por tanto, la secuencia histórica no es reproducible desde cero sin fixtures y una preparación temporal específica.

En esa prueba también se confirmó que:

- `009` no registra su propia fila; `012` valida su estructura y registra `009` correctamente.
- `018` es solo una consulta de verificación y no registra una versión; no bloquea la instalación.

### Escenario B auxiliar con fixture sintético

Para aislar el comportamiento de `033`, se reinició B, se aplicaron `001`–`022`, se prepararon únicamente dos filas sintéticas para satisfacer la precondición de 023 y se ejecutaron `023`–`032` y `033`.

Resultado: **correcto para el tramo estructural, pero no equivalente a una instalación vacía**.

- `029`–`032` y `033` finalizaron correctamente.
- `033` no duplicó columnas ni restricciones; PostgreSQL solo informó avisos de columnas ya existentes.
- `estado_final`, `accesorios_entregados` y las restricciones coincidieron con el escenario A.
- La diferencia restante fue `tipo_servicio`: `NOT NULL DEFAULT 'DIAGNOSTICO'` en B, frente a nullable sin default en A.
- El historial fue distinto de forma esperada: B contiene `029`; A no contiene `029`. A conserva además el registro histórico de `018`, que la instalación nueva no crea.

## Cambio aplicado para una solución coherente

La prueba demostró que la versión anterior de 033 no dejaba un esquema final idéntico entre instalaciones nuevas y existentes. Se aplicó a 033, después de crear la columna, el siguiente cambio:

```sql
ALTER TABLE ordenes_servicio_tecnico
    ALTER COLUMN tipo_servicio DROP DEFAULT,
    ALTER COLUMN tipo_servicio DROP NOT NULL;
```

Este cambio no actualiza filas, conserva cualquier valor existente y hace que ambos escenarios representen tipos históricos desconocidos como `NULL`. También mantiene el catálogo de valores permitidos mediante la restricción. Aún falta repetir la validación en PostgreSQL 16.

La diferencia de historial no debe eliminarse: `029` se conserva registrado solo en instalaciones donde realmente se ejecutó, y `018` debe tratarse como una comprobación histórica. La coherencia buscada es estructural y semántica, no una falsificación del historial.

## Estrategia definitiva de instalación y actualización

### Instalación nueva

Una base vacía no puede ejecutar literalmente toda la secuencia histórica porque 023 es una conciliación de datos empresariales ya existentes. El instalador debe usar un plan explícito por perfil:

1. Ejecutar las migraciones estructurales y las migraciones de catálogo en orden.
2. Tratar 011 como backfill vacío, porque no modifica filas cuando no existen actas.
3. Omitir 023 como conciliación histórica no aplicable a una base nueva, sin registrar falsamente `023` como ejecutada.
4. Crear mediante una migración de instalación nueva, todavía pendiente de preparar, el estado final canónico del RUT (`TEXT`, `CHECK` y `UNIQUE`) que 023 deja en una base existente.
5. Ejecutar 029 antes de 030–032 y luego 033. 033 eliminará el default y `NOT NULL` de `tipo_servicio`, sin modificar valores.
6. Registrar solo las migraciones realmente ejecutadas y las excepciones explícitas del plan de instalación.

No se deben crear colaboradores ficticios para hacer pasar 023 en producción. Los fixtures usados durante la validación solo reproducen precondiciones en bases temporales.

### Actualización de una base existente

El actualizador debe inspeccionar `schema_migrations` y la estructura antes de ejecutar cualquier archivo:

1. Si 023 ya está registrada y la estructura canónica del RUT es válida, no se repite.
2. Si 029 falta pero 030–032 están registradas y las columnas de servicio técnico coinciden con el diagnóstico, 029 se omite como excepción histórica explícita y no se registra artificialmente.
3. Se ejecuta 033 para reconciliar las columnas faltantes y normalizar `tipo_servicio` sin tocar datos.
4. Si 029 falta y tampoco están 030–032, el caso no se resuelve automáticamente: requiere revisión del estado de la base.
5. Se valida el esquema y el historial antes de permitir el despliegue de la aplicación.

### Dependencias de datos posteriores a 023

La revisión de 024–032 no encontró otra dependencia de IDs empresariales concretos:

- 024 agrega catálogo y tablas vacías; requiere que existan las tablas estructurales anteriores.
- 025 crea verificaciones físicas y normaliza únicamente filas existentes.
- 026 crea configuraciones para los tipos de dispositivo disponibles; en una instalación nueva usa los catálogos creados por 005–007.
- 027 activa prioridades por nombre (`SMARTPHONE` y `NOTEBOOK`), sin IDs fijos.
- 028 copia y transforma SIM existentes; en una base nueva las tablas quedan vacías.
- 029–032 son cambios estructurales de Servicio Técnico.

La única dependencia empresarial rígida identificada en este tramo es 023, con los colaboradores 1 y 392 y el RUT auditado.

## PostgreSQL 16

La validación temporal anterior se realizó en PostgreSQL 18.4. En este entorno solo está instalada esa versión; no están disponibles PostgreSQL 16, Docker ni WSL. Por ello todavía no se puede afirmar que la migración corregida haya sido validada con la misma versión de AWS.

Después de modificar 033, se ejecutó una prueba de humo adicional en PostgreSQL 18.4 con dos estructuras mínimas aisladas: una equivalente a la base existente y otra equivalente a 029–032. Ambas terminaron con `tipo_servicio VARCHAR(20)`, nullable, sin default y con la misma restricción explícita `IS NULL OR ...`; ambas registraron solo `033` como nueva versión. Esta prueba confirma la sintaxis y la normalización de 033, pero no sustituye la validación completa en PostgreSQL 16.

La prueba pendiente debe repetir ambos escenarios en PostgreSQL 16:

- copia estructural sin datos de negocio más `schema_migrations` para la base existente;
- instalación nueva con un perfil explícito que no ejecute 023 como backfill empresarial;
- aplicación de 033 corregida;
- comparación de nulabilidad, defaults, tipos, restricciones e historial.
