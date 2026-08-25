import path from "node:path";
import readExcelFile from "read-excel-file/node";
import { pool } from "../config/database";

const SHEET_NAME = "RESUMEN";
const EXPECTED_ROWS = 98;
const ROOT_CODE = "1001";
const EXTERNAL_ROOT_CODE = "1000";
const REQUIRED_HEADERS = [
  "ID UNIDAD ORGANIZACIONAL",
  "NOMBRE UNIDAD ORGANIZACIONAL",
  "Dependecia Unidad"
] as const;

interface OrganizationalUnit {
  code: string;
  name: string;
  dependencyCode: string | null;
}

const cellText = (value: unknown): string => {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  if (typeof value !== "string") return "";
  return value.trim();
};

const validateUnits = (rows: readonly (readonly unknown[])[]): OrganizationalUnit[] => {
  const headerIndex = rows.findIndex((row) =>
    REQUIRED_HEADERS.every((header) => row.includes(header))
  );
  if (headerIndex < 0) {
    throw new Error(
      `La hoja ${SHEET_NAME} no contiene exactamente las cabeceras requeridas.`
    );
  }

  const header = rows[headerIndex]!;
  const indexes = REQUIRED_HEADERS.map((name) => header.indexOf(name));
  const units = rows
    .slice(headerIndex + 1)
    .map((row) => ({
      code: cellText(row[indexes[0]!]),
      name: cellText(row[indexes[1]!]),
      dependencyCode: cellText(row[indexes[2]!]) || null
    }))
    .filter((unit) => unit.code || unit.name || unit.dependencyCode);

  if (units.length !== EXPECTED_ROWS) {
    throw new Error(
      `RESUMEN contiene ${units.length} filas organizacionales válidas; se esperaban ${EXPECTED_ROWS}.`
    );
  }

  const byCode = new Map<string, OrganizationalUnit>();
  for (const unit of units) {
    if (!unit.code) throw new Error("Existe una unidad sin ID organizacional.");
    if (!unit.name) {
      throw new Error(`La unidad ${unit.code} no tiene nombre.`);
    }
    if (byCode.has(unit.code)) {
      throw new Error(`El ID organizacional ${unit.code} está duplicado.`);
    }
    byCode.set(unit.code, unit);
  }

  const root = byCode.get(ROOT_CODE);
  if (!root || root.name !== "GERENCIA GENERAL") {
    throw new Error("No se encontró GERENCIA GENERAL con ID 1001.");
  }
  if (root.dependencyCode !== EXTERNAL_ROOT_CODE) {
    throw new Error("GERENCIA GENERAL no declara la dependencia externa 1000 esperada.");
  }
  root.dependencyCode = null;

  for (const unit of units) {
    if (unit.dependencyCode === unit.code) {
      throw new Error(`La unidad ${unit.code} se referencia a sí misma.`);
    }
    if (unit.dependencyCode && !byCode.has(unit.dependencyCode)) {
      throw new Error(
        `La dependencia ${unit.dependencyCode} de ${unit.code} no existe en RESUMEN.`
      );
    }
  }

  const state = new Map<string, "VISITING" | "VISITED">();
  const visit = (code: string): void => {
    if (state.get(code) === "VISITING") {
      throw new Error(`Se detectó un ciclo organizacional en ${code}.`);
    }
    if (state.get(code) === "VISITED") return;
    state.set(code, "VISITING");
    const dependency = byCode.get(code)!.dependencyCode;
    if (dependency) visit(dependency);
    state.set(code, "VISITED");
  };
  for (const code of byCode.keys()) visit(code);

  return units;
};

const importStructure = async (): Promise<void> => {
  const defaultPath = path.resolve(
    __dirname,
    "../../../1.-ESTRUCTURA ESSSI.xlsx"
  );
  const sourcePath = path.resolve(process.argv[2] ?? defaultPath);
  const sheets = await readExcelFile(sourcePath);
  const resumen = sheets.find((sheet) => sheet.sheet === SHEET_NAME);
  if (!resumen) {
    throw new Error(`El archivo no contiene la hoja ${SHEET_NAME}.`);
  }

  const units = validateUnits(resumen.data);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const unit of units) {
      await client.query(
        `INSERT INTO itam.departamentos (
           codigo_organizacional, nombre, activo
         ) VALUES ($1, $2, TRUE)
         ON CONFLICT (codigo_organizacional)
           WHERE codigo_organizacional IS NOT NULL
         DO UPDATE SET nombre = EXCLUDED.nombre, activo = TRUE`,
        [unit.code, unit.name]
      );
    }

    const rows = await client.query<{ id: string; codigo_organizacional: string }>(
      `SELECT id, codigo_organizacional
         FROM itam.departamentos
        WHERE codigo_organizacional = ANY($1::varchar[])`,
      [units.map((unit) => unit.code)]
    );
    const ids = new Map(
      rows.rows.map((row) => [row.codigo_organizacional, Number(row.id)])
    );
    if (ids.size !== units.length) {
      throw new Error("No fue posible resolver todas las unidades importadas.");
    }

    for (const unit of units) {
      await client.query(
        `UPDATE itam.departamentos
            SET dependencia_id = $2
          WHERE id = $1`,
        [
          ids.get(unit.code)!,
          unit.dependencyCode ? ids.get(unit.dependencyCode)! : null
        ]
      );
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({
      archivo: sourcePath,
      hoja: SHEET_NAME,
      unidades: units.length,
      dependencias: units.filter((unit) => unit.dependencyCode).length,
      raiz: ROOT_CODE
    }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

void importStructure().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "Importación fallida.");
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
