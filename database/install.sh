#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
readonly MIGRATIONS_DIR="$REPO_ROOT/database/migrations"

TARGET_DB=""
DB_HOST="${PGHOST:-}"
DB_PORT="${PGPORT:-}"
DB_USER="${PGUSER:-}"
VERIFY_ONLY=0
ALLOW_PRODUCTION=0
PRODUCTION_CONFIRM="${ITAM_PRODUCTION_CONFIRM:-}"

# 018 es una comprobación histórica y no se ejecuta. 023 se reemplaza por
# 023N, que solo es válida para una instalación nueva sin datos empresariales.
readonly MIGRATIONS=(
  "001_initial_core.sql"
  "002_integrity_rules.sql"
  "003_inventory_code_families.sql"
  "004_inventory_code_immutability.sql"
  "005_device_type_catalog.sql"
  "006_configurable_inventory_code_families.sql"
  "007_dynamic_asset_registration.sql"
  "008_asset_lifecycle_and_documents.sql"
  "009_department_dependencies.sql"
  "010_custody_returns_and_temporary_assets.sql"
  "011_backfill_worker_delivery_declaration.sql"
  "012_reconcile_department_dependency_migration.sql"
  "013_organization_acquisition_auth_and_audit.sql"
  "014_force_initial_password_change.sql"
  "015_invoice_document_storage.sql"
  "016_organization_source_code.sql"
  "017_user_pin_auth.sql"
  "019_printer_inventory_family.sql"
  "020_sim_iccid_nullable.sql"
  "021_logical_cancellation_device_disposals.sql"
  "022_offboarding_processes.sql"
  "023N_canonical_collaborator_rut_clean_install.sql"
  "024_temporal_device_custody.sql"
  "025_physical_device_verifications.sql"
  "026_configurable_stock_alerts.sql"
  "027_default_priority_stock_alerts.sql"
  "028_mobile_lines.sql"
  "029_simplify_technical_service.sql"
  "030_technical_service_work_order_review.sql"
  "031_technical_service_return_fields.sql"
  "032_technical_service_quotes.sql"
  "033_reconcile_technical_service_schema.sql"
  "034_session_activity_and_proxy_ready.sql"
  "035_read_only_user_role.sql"
  "036_correlative_technical_work_order_numbers.sql"
)

die() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Uso:
  database/install.sh --database NOMBRE [opciones]

Opciones:
  -d, --database NOMBRE       Base de destino (obligatoria).
      --host HOST             Host PostgreSQL; también puede usar PGHOST.
      --port PUERTO           Puerto PostgreSQL; también puede usar PGPORT.
      --user USUARIO          Usuario PostgreSQL; también puede usar PGUSER.
      --verify                Muestra y valida el plan sin conectarse ni ejecutar SQL.
      --allow-production      Habilita explícitamente itam_prod; requiere confirmar
                              ITAM_PRODUCTION_CONFIRM=itam_prod.
  -h, --help                  Muestra esta ayuda.

La contraseña no se recibe como argumento. Use .pgpass, PGPASSWORD temporal o el
mecanismo de autenticación configurado en PostgreSQL.
EOF
}

while (($# > 0)); do
  case "$1" in
    -d|--database)
      (($# >= 2)) || die "Falta el nombre después de $1"
      TARGET_DB="$2"
      shift 2
      ;;
    --host)
      (($# >= 2)) || die "Falta el host después de $1"
      DB_HOST="$2"
      shift 2
      ;;
    --port)
      (($# >= 2)) || die "Falta el puerto después de $1"
      DB_PORT="$2"
      shift 2
      ;;
    --user)
      (($# >= 2)) || die "Falta el usuario después de $1"
      DB_USER="$2"
      shift 2
      ;;
    --verify)
      VERIFY_ONLY=1
      shift
      ;;
    --allow-production)
      ALLOW_PRODUCTION=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Argumento no reconocido: $1"
      ;;
  esac
done

[[ -n "$TARGET_DB" ]] || die "Debe indicar --database. Use --help para ver el uso."

case "${TARGET_DB,,}" in
  postgres|template0|template1)
    die "La base de destino no puede ser una base administrativa o plantilla: $TARGET_DB"
    ;;
  itam_dev)
    die "Ejecución bloqueada contra itam_dev"
    ;;
  itam_prod|itam_production|prod|production|*production*)
    if ((ALLOW_PRODUCTION == 0)); then
      die "La base parece de producción. Use --allow-production y una confirmación explícita."
    fi
    [[ "$TARGET_DB" == "itam_prod" ]] || die "--allow-production solo habilita explícitamente itam_prod"
    [[ "$PRODUCTION_CONFIRM" == "itam_prod" ]] || die "Para itam_prod establezca ITAM_PRODUCTION_CONFIRM=itam_prod"
    ;;
esac

for migration in "${MIGRATIONS[@]}"; do
  [[ -f "$MIGRATIONS_DIR/$migration" ]] || die "No existe la migración: $MIGRATIONS_DIR/$migration"
done

printf 'Plan de instalación PostgreSQL ITAM\n'
printf 'Base destino: %s\n' "$TARGET_DB"
printf 'Migración 018: omitida (comprobación histórica, no registra versión)\n'
printf 'Migración 023: omitida; se ejecuta 023N para instalación nueva\n'
printf 'Archivos que se ejecutarán (%d):\n' "${#MIGRATIONS[@]}"
for migration in "${MIGRATIONS[@]}"; do
  printf '  - %s\n' "$migration"
done

if ((VERIFY_ONLY == 1)); then
  printf 'Modo verificación: no se abrió conexión y no se ejecutó SQL.\n'
  exit 0
fi

command -v psql >/dev/null 2>&1 || die "No se encontró psql en PATH"

PSQL_ARGS=(--no-psqlrc --set=ON_ERROR_STOP=1)
[[ -n "$DB_HOST" ]] && PSQL_ARGS+=(--host "$DB_HOST")
[[ -n "$DB_PORT" ]] && PSQL_ARGS+=(--port "$DB_PORT")
[[ -n "$DB_USER" ]] && PSQL_ARGS+=(--username "$DB_USER")

printf 'Comprobando que la base exista...\n'
db_exists="$(psql "${PSQL_ARGS[@]}" --dbname=postgres --set=target_db="$TARGET_DB" -Atqc "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'target_db');")"
[[ "$db_exists" == "t" ]] || die "La base $TARGET_DB no existe. Créela previamente y vuelva a ejecutar."

printf 'Comprobando que la base esté vacía...\n'
object_count="$(psql "${PSQL_ARGS[@]}" --dbname="$TARGET_DB" -Atqc "
SELECT COUNT(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S');")"
[[ "$object_count" == "0" ]] || die "La base $TARGET_DB no está vacía: contiene $object_count objetos. No se ejecutará ninguna migración."

printf 'Ejecutando migraciones...\n'
for migration in "${MIGRATIONS[@]}"; do
  printf '  -> %s\n' "$migration"
  psql "${PSQL_ARGS[@]}" --dbname="$TARGET_DB" --file="$MIGRATIONS_DIR/$migration"
done

printf 'Validando resultado final...\n'
table_count="$(psql "${PSQL_ARGS[@]}" --dbname="$TARGET_DB" -Atqc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'itam' AND table_type = 'BASE TABLE';")"
[[ "$table_count" == "28" ]] || die "Se esperaban 28 tablas en itam y se encontraron $table_count"

migration_count="$(psql "${PSQL_ARGS[@]}" --dbname="$TARGET_DB" -Atqc "SELECT COUNT(*) FROM itam.schema_migrations;")"
[[ "$migration_count" == "35" ]] || die "Se esperaban 35 registros de migraciones y se encontraron $migration_count"

invalid_history="$(psql "${PSQL_ARGS[@]}" --dbname="$TARGET_DB" -Atqc "
SELECT COUNT(*)
FROM itam.schema_migrations
WHERE version IN ('018', '023')
   OR version = '023N' AND nombre <> 'canonical_collaborator_rut_clean_install';")"
[[ "$invalid_history" == "0" ]] || die "El historial final contiene una versión no permitida para instalación nueva"

printf 'Instalación completada correctamente en %s.\n' "$TARGET_DB"
