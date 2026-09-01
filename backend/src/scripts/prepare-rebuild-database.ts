import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "pg";

const SOURCE_DATABASE = "itam_dev";
const TARGET_DATABASE = "itam_rebuild";
const MIGRATIONS_DIRECTORY = path.resolve(__dirname, "../../../database/migrations");
const PRE_023_BACKUP = "D:\\Aguas San Isidro\\backups\\itam\\itam_dev_pre_023_2026-08-31T19-23-47-962Z.dump";
const PG_RESTORE = process.env.PG_RESTORE_PATH
  ?? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe";
const execFileAsync = promisify(execFile);

const connection = (database: string): Client => new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: "-c search_path=itam,public"
});

const assertDatabase = async (client: Client, expected: string): Promise<void> => {
  const result = await client.query<{ database: string }>(
    "SELECT current_database() AS database"
  );
  if (result.rows[0]?.database !== expected) {
    throw new Error(`Conexion insegura: se esperaba ${expected}.`);
  }
};

const appliedVersions = async (client: Client): Promise<Set<string>> => {
  const exists = await client.query<{ exists: boolean }>(
    "SELECT to_regclass('itam.schema_migrations') IS NOT NULL AS exists"
  );
  if (!exists.rows[0]?.exists) return new Set();
  const rows = await client.query<{ version: string }>(
    "SELECT version FROM itam.schema_migrations ORDER BY version"
  );
  return new Set(rows.rows.map((row) => row.version));
};

const applyMigration = async (client: Client, version: string): Promise<void> => {
  const files = await fs.readdir(MIGRATIONS_DIRECTORY);
  const file = files.find((candidate) => candidate.startsWith(`${version}_`));
  if (!file) throw new Error(`No existe la migracion ${version}.`);
  const sql = await fs.readFile(path.join(MIGRATIONS_DIRECTORY, file), "utf8");
  await client.query(sql);
  console.log(`Migracion ${version} aplicada: ${file}`);
};

const tableColumns = async (client: Client, table: string): Promise<string[]> => {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema='itam'
        AND table_name=$1
        AND is_generated='NEVER'
      ORDER BY ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
};

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`;

const redactSensitiveText = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const credentialPattern = /(?:password|contrase(?:n|ÃƒÆ’Ã‚Â±)a|clave|secret|token|api[_ -]?key)\s*[:=]\s*\S+/giu;
  return credentialPattern.test(value)
    ? "[DATO SENSIBLE HISTORICO REDACTADO]"
    : value;
};

const upsertRows = async (
  source: Client,
  target: Client,
  table: string,
  transform?: (row: Record<string, unknown>) => Record<string, unknown>
): Promise<{ copied: number; redacted: number }> => {
  const sourceColumns = await tableColumns(source, table);
  const targetColumns = new Set(await tableColumns(target, table));
  const columns = sourceColumns.filter((column) => targetColumns.has(column));
  const rows = await source.query<Record<string, unknown>>(
    `SELECT ${columns.map(quoteIdentifier).join(",")}
       FROM itam.${quoteIdentifier(table)}
      ORDER BY id`
  );
  let redacted = 0;
  for (const original of rows.rows) {
    const row = transform ? transform(original) : original;
    if (row.observaciones !== original.observaciones) redacted += 1;
    const values = columns.map((column) => row[column] ?? null);
    const updates = columns
      .filter((column) => column !== "id")
      .map((column) => `${quoteIdentifier(column)}=EXCLUDED.${quoteIdentifier(column)}`)
      .join(",");
    await target.query(
      `INSERT INTO itam.${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(",")})
       OVERRIDING SYSTEM VALUE
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(",")})
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      values
    );
  }
  if (columns.includes("id")) {
    await target.query(
      `SELECT setval(pg_get_serial_sequence('itam.${table}','id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM itam.${quoteIdentifier(table)}),1),1),
        EXISTS(SELECT 1 FROM itam.${quoteIdentifier(table)}))`
    );
  }
  return { copied: rows.rowCount ?? 0, redacted };
};

const copyDepartments = async (source: Client, target: Client): Promise<number> => {
  const sourceColumns = await tableColumns(source, "departamentos");
  const targetColumns = new Set(await tableColumns(target, "departamentos"));
  const columns = sourceColumns.filter((column) => targetColumns.has(column));
  const rows = await source.query<Record<string, unknown>>(
    `SELECT ${columns.map(quoteIdentifier).join(",")}
       FROM itam.departamentos ORDER BY id`
  );
  const insertColumns = columns;
  for (const original of rows.rows) {
    const row: Record<string, unknown> = { ...original, dependencia_id: null };
    const values = insertColumns.map((column) => row[column] ?? null);
    const updates = insertColumns
      .filter((column) => column !== "id" && column !== "dependencia_id")
      .map((column) => `${quoteIdentifier(column)}=EXCLUDED.${quoteIdentifier(column)}`)
      .join(",");
    await target.query(
      `INSERT INTO itam.departamentos (${insertColumns.map(quoteIdentifier).join(",")})
       OVERRIDING SYSTEM VALUE
       VALUES (${insertColumns.map((_, index) => `$${index + 1}`).join(",")})
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      values
    );
  }
  for (const row of rows.rows) {
    if (row.dependencia_id != null) {
      await target.query(
        "UPDATE itam.departamentos SET dependencia_id=$2 WHERE id=$1",
        [row.id, row.dependencia_id]
      );
    }
  }
  await target.query(
    "SELECT setval(pg_get_serial_sequence('itam.departamentos','id'),(SELECT MAX(id) FROM itam.departamentos),TRUE)"
  );
  return rows.rowCount ?? 0;
};

const decodeCopyValue = (value: string): string | null => {
  if (value === "\\N") return null;
  return value.replace(/\\([bfnrtv\\])/g, (_match, escaped: string) => ({
    b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\"
  })[escaped] ?? escaped);
};

const exactDuplicate392FromBackup = async (): Promise<{
  columns: string[];
  values: Array<string | null>;
}> => {
  await fs.access(PRE_023_BACKUP);
  const { stdout } = await execFileAsync(
    PG_RESTORE,
    ["--data-only", "--table=colaboradores", "--file=-", PRE_023_BACKUP],
    { maxBuffer: 32 * 1024 * 1024, encoding: "utf8" }
  );
  const lines = stdout.split(/\r?\n/);
  const header = lines.find((line) => line.startsWith("COPY itam.colaboradores ("));
  const row = lines.find((line) => line.startsWith("392\t"));
  if (!header || !row) {
    throw new Error("No fue posible extraer exactamente el ID 392 desde el backup pre-023.");
  }
  const match = header.match(/^COPY itam\.colaboradores \((.+)\) FROM stdin;$/);
  if (!match) throw new Error("El encabezado COPY de colaboradores no es verificable.");
  const columns = match[1]!.split(",").map((column) => column.trim());
  const values = row.split("\t").map(decodeCopyValue);
  if (columns.length !== values.length) {
    throw new Error("La fila 392 no coincide con las columnas del backup.");
  }
  const record = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  const canonicalRut = String(record.rut ?? "").replace(/[^0-9Kk]/g, "").toUpperCase();
  if (record.id !== "392" || canonicalRut !== "111844739" || record.activo !== "f") {
    throw new Error("El ID 392 del backup no coincide con el duplicado esperado por la migracion 023.");
  }
  return { columns, values };
};

const insertExactDuplicate392 = async (
  source: Client,
  target: Client
): Promise<void> => {
  const master = await source.query<{ id: string; rut: string }>(
    "SELECT id,rut FROM itam.colaboradores WHERE id=1"
  );
  if (master.rows[0]?.id !== "1" || master.rows[0].rut !== "111844739") {
    throw new Error("El maestro ID 1 no coincide con la identidad consolidada esperada.");
  }
  const duplicate = await exactDuplicate392FromBackup();
  const targetColumns = new Set(await tableColumns(target, "colaboradores"));
  if (duplicate.columns.some((column) => !targetColumns.has(column))) {
    throw new Error("El esquema destino no puede preservar todas las columnas exactas del ID 392.");
  }
  await target.query(
    `INSERT INTO itam.colaboradores (${duplicate.columns.map(quoteIdentifier).join(",")})
     OVERRIDING SYSTEM VALUE
     VALUES (${duplicate.columns.map((_, index) => `$${index + 1}`).join(",")})
     ON CONFLICT (id) DO NOTHING`,
    duplicate.values
  );
};
const recordRedactions = async (target: Client, count: number): Promise<void> => {
  if (!count) return;
  await target.query(
    `INSERT INTO itam.auditoria_operaciones(
       usuario_ejecutor_id,metodo,ruta,codigo_respuesta,tipo_entidad,detalle
     ) VALUES (
       NULL,'DATA','/internal/data-rebuild/SEC-01',200,'RECONSTRUCCION',
       JSONB_BUILD_OBJECT(
         'accion','REDACTAR_DATO_SENSIBLE_HISTORICO',
         'registrosRedactados',$1,
         'valor','[DATO SENSIBLE HISTORICO REDACTADO]'
       )
     )`,
    [count]
  );
};

const main = async (): Promise<void> => {
  if (process.env.DB_NAME !== TARGET_DATABASE) {
    throw new Error(
      `Bloqueo de seguridad: DB_NAME debe ser exactamente ${TARGET_DATABASE}; no se realizo ninguna escritura.`
    );
  }
  const source = connection(SOURCE_DATABASE);
  const target = connection(process.env.DB_NAME);
  try {
    await target.connect();
    await source.connect();
    await assertDatabase(source, SOURCE_DATABASE);
    await source.query("SET default_transaction_read_only = on");
    await assertDatabase(target, TARGET_DATABASE);

    let versions = await appliedVersions(target);
    for (let version = 1; version <= 22; version += 1) {
      const key = String(version).padStart(3, "0");
      if (!versions.has(key)) await applyMigration(target, key);
    }

    versions = await appliedVersions(target);
    if (!versions.has("023")) {
      await target.query("BEGIN");
      try {
        const departments = await copyDepartments(source, target);
        const users = await upsertRows(source, target, "usuarios");
        const collaborators = await upsertRows(
          source,
          target,
          "colaboradores",
          (row) => ({
            ...row,
            observaciones: redactSensitiveText(row.observaciones)
          })
        );
        await insertExactDuplicate392(source, target);
        await target.query("COMMIT");
        console.log(JSON.stringify({ departments, users: users.copied, collaborators: collaborators.copied }));
        await applyMigration(target, "023");
        await recordRedactions(target, collaborators.redacted);
      } catch (error) {
        await target.query("ROLLBACK");
        throw error;
      }
    }

    versions = await appliedVersions(target);
    for (const version of ["024", "025", "026"]) {
      if (!versions.has(version)) await applyMigration(target, version);
    }

    const validation = await target.query<{
      collaborators: string;
      migrations: string;
      last_version: string;
    }>(`SELECT
      (SELECT COUNT(*) FROM itam.colaboradores) AS collaborators,
      (SELECT COUNT(*) FROM itam.schema_migrations) AS migrations,
      (SELECT MAX(version) FROM itam.schema_migrations) AS last_version`);
    console.log(JSON.stringify({ database: TARGET_DATABASE, ...validation.rows[0] }, null, 2));
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

