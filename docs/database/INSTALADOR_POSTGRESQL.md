# Instalador PostgreSQL de ITAM

## Alcance

`database/install.sh` prepara una base PostgreSQL 16 completamente vacía para ITAM. El instalador ejecuta 33 archivos en un orden explícito, detiene la ejecución ante cualquier error y valida el resultado final.

No modifica `itam_dev` ni `itam_prod` por defecto. No recibe contraseñas en la línea de comandos y no contiene credenciales.

## Diferencias históricas consideradas

- `018_session_idle_timeout.sql` es una comprobación histórica. No modifica el esquema, no se ejecuta y no se registra.
- `009_department_dependencies.sql` no registra su propia versión. `012_reconcile_department_dependency_migration.sql` valida su estructura y registra `009`; por eso ambos archivos se ejecutan en ese orden.
- `023_canonical_collaborator_rut.sql` depende de los colaboradores históricos con ID 1 y 392. No es reproducible en una base nueva y queda fuera del instalador.
- `023N_canonical_collaborator_rut_clean_install.sql` se utiliza únicamente en una instalación vacía. No crea colaboradores ficticios, conserva las restricciones canónicas del RUT y registra `023N`, nunca `023`.
- `029` se ejecuta antes de `030`–`032` en una instalación nueva. `033` normaliza el esquema de Servicio Técnico, elimina el `DEFAULT` y la nulabilidad obligatoria de `tipo_servicio`, y no inventa datos históricos.
- `034` crea `sesiones_usuario.ultima_actividad` y el índice parcial `idx_sesiones_usuario_actividad`, corrigiendo el defecto histórico de `018` sin modificar esa migración.

El orden final es:

```text
001–017, 019–022, 023N, 024–034
```

## Modo verificación

Desde la raíz del repositorio:

```bash
bash database/install.sh --database itam_validacion --verify
```

Este modo comprueba que estén presentes los archivos y muestra exactamente qué se ejecutaría. No abre conexión, no crea tablas y no ejecuta SQL.

## Protecciones

Antes de ejecutar una migración, el instalador:

1. exige un nombre de base explícito;
2. bloquea `itam_dev`, bases administrativas y nombres que parezcan de producción;
3. exige que la base de destino exista;
4. verifica que no contenga tablas, vistas, secuencias ni otros objetos de usuario;
5. utiliza `ON_ERROR_STOP=1` en cada llamada a `psql`;
6. valida que el resultado tenga 28 tablas, 33 registros de migraciones y no registre `018` ni `023`.

Para una ejecución futura y deliberada sobre `itam_prod`, se requiere además:

```bash
ITAM_PRODUCTION_CONFIRM=itam_prod \
bash database/install.sh \
  --database itam_prod \
  --allow-production
```

Ese comando queda documentado para una etapa posterior y no se ejecutó. La protección de base vacía continúa activa incluso con la confirmación de producción.

## Transferencia y ejecución en Ubuntu

Transferir el repositorio o, como mínimo, `database/install.sh` junto con `database/migrations/`:

```bash
scp -r database usuario@servidor:/opt/itam/
```

En Ubuntu, instalar el cliente PostgreSQL compatible con PostgreSQL 16:

```bash
sudo apt-get update
sudo apt-get install -y postgresql-client-16
```

Dar permiso de ejecución y revisar el plan:

```bash
cd /opt/itam
chmod +x database/install.sh
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=itam_admin \
bash database/install.sh --database itam_validacion --verify
```

Configurar la autenticación con `.pgpass` y permisos restrictivos. No guardar contraseñas en el repositorio ni pasarlas como argumento:

```bash
chmod 600 ~/.pgpass
```

Ejecutar después de crear una base vacía y comprobar nuevamente el plan:

```bash
createdb --host 127.0.0.1 --port 5432 --username itam_admin itam_validacion
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=itam_admin \
bash database/install.sh --database itam_validacion
```

Si PostgreSQL está en AWS Lightsail, reemplazar `PGHOST` por el host privado o público autorizado y utilizar TLS según la configuración del servidor, por ejemplo `PGSSLMODE=require`. No usar credenciales de producción en una base de validación.

## Prueba desde cero en `itam_validacion`

Los siguientes comandos son destructivos únicamente para la base temporal `itam_validacion`. No ejecutarlos con `itam_dev` o `itam_prod`.

```bash
dropdb --if-exists --host 127.0.0.1 --port 5432 --username itam_admin itam_validacion
createdb --host 127.0.0.1 --port 5432 --username itam_admin itam_validacion

PGHOST=127.0.0.1 PGPORT=5432 PGUSER=itam_admin \
bash database/install.sh --database itam_validacion --verify

PGHOST=127.0.0.1 PGPORT=5432 PGUSER=itam_admin \
bash database/install.sh --database itam_validacion

PGHOST=127.0.0.1 PGPORT=5432 PGUSER=itam_admin \
psql --dbname itam_validacion --set ON_ERROR_STOP=1 --command "\
SELECT COUNT(*) AS tablas \
FROM information_schema.tables \
WHERE table_schema = 'itam' AND table_type = 'BASE TABLE'; \
SELECT COUNT(*) AS migraciones FROM itam.schema_migrations; \
SELECT version, nombre FROM itam.schema_migrations ORDER BY version; \
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default \
FROM information_schema.columns \
WHERE table_schema = 'itam' \
  AND table_name = 'ordenes_servicio_tecnico' \
  AND column_name IN ('tipo_servicio', 'accesorios_entregados', 'estado_final') \
ORDER BY column_name;"
```

Se espera obtener 28 tablas, 33 migraciones, `023N` sin `023`, ausencia de `018`, y `sesiones_usuario.ultima_actividad` como `TIMESTAMPTZ NOT NULL DEFAULT now()` junto con su índice parcial.

## Resultado esperado y límites

Este instalador está diseñado para instalaciones nuevas. No es un actualizador de una base existente: una base con objetos será rechazada para evitar aplicar migraciones históricas sobre datos empresariales. Las actualizaciones de `itam_dev` o `itam_prod` requieren un procedimiento de reconciliación separado y revisión del historial antes de ejecutar `033`.
