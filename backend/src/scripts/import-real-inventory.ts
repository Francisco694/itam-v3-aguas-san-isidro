import path from "node:path";
import readExcelFile from "read-excel-file/node";
import type { PoolClient } from "pg";
import { pool } from "../config/database";
import { env } from "../config/env";
import {
  generateInventoryCode,
  generateInventoryCodeByFamilyId
} from "../modules/inventory-codes/inventory-code.service";
import { formatInventoryCode } from "../modules/inventory-codes/inventory-code";
import {
  isValidRut as validRut,
  normalizeRut as rutKey
} from "../shared/rut";

const SOURCE = "Inventario.xlsx";
const RESPONSIBLE = "Importador Inventario.xlsx";
const SHEETS = ["SIM", "Telefono", "Impresoras"] as const;
const HEADERS = {
  SIM: ["ID", "Compañía", "Cod. Serie", "Colaborador", "Estado",
    "Descripcion", "Localidad", "Numero Asociado"],
  Telefono: ["ID", "Equipo", "IMEI1", "ID_SIM", "Colaborador", "RUT",
    "Estado", "Numero asociado", "Descripcion",
    "Revision SIM post entrega", "Valor arreglo"],
  Impresoras: ["Impresora", "Oficina", "Solicitud", "Negro", "Color", "Estado"]
} as const;

type SheetName = typeof SHEETS[number];
type Cell = string | number | boolean | Date | null;
type Row = Record<string, Cell> & { __row: number };
type Severity = "CRITICAL" | "PENDING" | "WARNING";
interface Issue { severity: Severity; code: string; message: string; sheet?: SheetName; row?: number }
interface Sheet { sheet: string; data: Cell[][] }
interface DeviceType { id: string; name: string; familyId: string }
interface Context {
  database: string;
  states: Map<string, string>;
  smartphone: DeviceType | null;
  printer: DeviceType | null;
  simFamilyId: string | null;
  families: Map<string, { prefix: string; ordinal: number }>;
  existingCollaborators: Map<string, { id: string; name: string }>;
  before: { devices: number; sims: number; collaborators: number; history: number };
}
interface Analysis {
  sourcePath: string;
  rows: Record<SheetName, Row[]>;
  issues: Issue[];
  rutByName: Map<string, string>;
  collaborators: Map<string, { rut: string; name: string; locality: string | null }>;
  context: Context;
}
interface Counts {
  collaboratorsCreated: number; collaboratorsReused: number;
  smartphones: number; printers: number; sims: number;
  deviceAssignments: number; simAssignments: number; simAssociations: number;
  simAssociationsPending: number; simsWithNullIccid: number;
  historyEvents: number; deviceTypesCreated: number;
}

const txt = (value: Cell | undefined): string => {
  if (value === null || value === undefined) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
};
const norm = (value: Cell | undefined): string =>
  txt(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
const digits = (value: Cell | undefined): string => txt(value).replace(/\D/g, "");
const normalizeIccid = (value: Cell | undefined): string | null => {
  const raw = txt(value);
  if (!raw || raw === "-" || norm(raw) === "NULL") return null;
  return raw.startsWith(".") ? raw.slice(1) : raw;
};
const validPhone = (value: Cell | undefined): string | null => {
  const valueDigits = digits(value);
  return valueDigits.length >= 8 ? valueDigits : null;
};
const add = (
  issues: Issue[], severity: Severity, code: string, message: string,
  sheet?: SheetName, row?: number
): void => { issues.push({ severity, code, message, sheet, row }); };
const ref = (sheet: SheetName, row: number): string => `${sheet}, fila ${row}`;

const parseSheet = (workbook: Sheet[], name: SheetName, issues: Issue[]): Row[] => {
  const sheet = workbook.find((candidate) => candidate.sheet === name);
  if (!sheet) {
    add(issues, "CRITICAL", "MISSING_SHEET", `Falta la hoja obligatoria ${name}.`);
    return [];
  }
  const actual = (sheet.data[0] ?? []).map((cell) => txt(cell));
  const missing = HEADERS[name].filter((header) => !actual.includes(header));
  if (missing.length) {
    add(issues, "CRITICAL", "MISSING_HEADERS",
      `${name} no contiene: ${missing.join(", ")}.`);
    return [];
  }
  return sheet.data.slice(1).map((cells, index) => {
    const row: Row = { __row: index + 2 };
    actual.forEach((header, column) => { if (header) row[header] = cells[column] ?? null; });
    return row;
  }).filter((row) => actual.some((header) => header && txt(row[header])));
};

const duplicates = (
  issues: Issue[], severity: Severity, sheet: SheetName, rows: Row[], column: string,
  transform: (value: Cell | undefined) => string, code: string, label: string
): void => {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const key = transform(row[column]);
    if (key) grouped.set(key, [...(grouped.get(key) ?? []), row.__row]);
  }
  for (const rowNumbers of grouped.values()) {
    if (rowNumbers.length > 1) add(issues, severity, code,
      `${label} repetido en filas ${rowNumbers.join(", ")}; valor enmascarado.`, sheet);
  }
};

const analyzeSource = (workbook: Sheet[], issues: Issue[]): Record<SheetName, Row[]> => {
  const rows = {
    SIM: parseSheet(workbook, "SIM", issues),
    Telefono: parseSheet(workbook, "Telefono", issues),
    Impresoras: parseSheet(workbook, "Impresoras", issues)
  };
  duplicates(issues, "PENDING", "SIM", rows.SIM, "ID", norm,
    "DUPLICATE_SIM_HISTORICAL_ID", "ID histórico de SIM");
  duplicates(issues, "CRITICAL", "SIM", rows.SIM, "Cod. Serie",
    (value) => normalizeIccid(value) ?? "",
    "DUPLICATE_ICCID", "ICCID");
  duplicates(issues, "CRITICAL", "SIM", rows.SIM, "Numero Asociado", digits,
    "DUPLICATE_SIM_PHONE", "Número de SIM");
  duplicates(issues, "PENDING", "Telefono", rows.Telefono, "ID", norm,
    "DUPLICATE_DEVICE_HISTORICAL_ID", "ID histórico de teléfono");
  duplicates(issues, "CRITICAL", "Telefono", rows.Telefono, "IMEI1", digits,
    "DUPLICATE_IMEI", "IMEI");
  duplicates(issues, "PENDING", "Telefono", rows.Telefono, "ID_SIM", norm,
    "DUPLICATE_DEVICE_SIM_REFERENCE", "Referencia ID_SIM");
  duplicates(issues, "CRITICAL", "Telefono", rows.Telefono, "Numero asociado", digits,
    "DUPLICATE_DEVICE_PHONE", "Número de teléfono");

  for (const row of rows.SIM) {
    const iccid = normalizeIccid(row["Cod. Serie"]);
    if (!iccid) add(issues, "PENDING", "MISSING_ICCID",
      `ICCID pendiente de completar (${ref("SIM", row.__row)}).`, "SIM", row.__row);
    else if (!/^\d+$/.test(iccid)) add(issues, "CRITICAL", "INVALID_ICCID_FORMAT",
      `ICCID contiene caracteres no permitidos (${ref("SIM", row.__row)}).`,
      "SIM", row.__row);
    else if (iccid.length < 18 || iccid.length > 22) add(issues, "CRITICAL",
      "INVALID_ICCID", `ICCID con longitud inválida (${ref("SIM", row.__row)}).`,
      "SIM", row.__row);
    const phone = digits(row["Numero Asociado"]);
    if (phone && phone.length < 8) add(issues, "PENDING", "INVALID_SIM_PHONE",
      `Número asociado inválido (${ref("SIM", row.__row)}).`, "SIM", row.__row);
  }
  for (const row of rows.Telefono) {
    if (digits(row.IMEI1).length !== 15) add(issues, "CRITICAL", "INVALID_IMEI",
      `IMEI sin 15 dígitos (${ref("Telefono", row.__row)}).`, "Telefono", row.__row);
    if (!norm(row.ID_SIM)) add(issues, "CRITICAL", "MISSING_SIM_REFERENCE",
      `Teléfono sin referencia de SIM (${ref("Telefono", row.__row)}).`,
      "Telefono", row.__row);
    if (txt(row.RUT) && !validRut(row.RUT)) add(issues, "CRITICAL", "INVALID_RUT",
      `RUT con dígito verificador inválido (${ref("Telefono", row.__row)}).`,
      "Telefono", row.__row);
  }

  const simsById = new Map<string, Row[]>();
  for (const row of rows.SIM) {
    const key = norm(row.ID);
    simsById.set(key, [...(simsById.get(key) ?? []), row]);
  }
  for (const phone of rows.Telefono) {
    const matches = simsById.get(norm(phone.ID_SIM)) ?? [];
    if (matches.length !== 1) {
      add(issues, "PENDING", "AMBIGUOUS_SIM_REFERENCE",
        `ID_SIM no resuelve exactamente una SIM (${ref("Telefono", phone.__row)}).`,
        "Telefono", phone.__row);
      continue;
    }
    const sim = matches[0]!;
    const simPhone = digits(sim["Numero Asociado"]);
    const devicePhone = digits(phone["Numero asociado"]);
    if (simPhone && devicePhone && simPhone !== devicePhone) add(issues, "PENDING",
      "PHONE_MISMATCH", `Número distinto entre teléfono y SIM (${ref("Telefono", phone.__row)}).`,
      "Telefono", phone.__row);
    if (norm(sim.Colaborador) !== norm(phone.Colaborador)) add(issues, "PENDING",
      "COLLABORATOR_MISMATCH",
      `Colaborador distinto entre teléfono y SIM (${ref("Telefono", phone.__row)}).`,
      "Telefono", phone.__row);
  }
  return rows;
};

const analyzeCollaborators = (
  rows: Record<SheetName, Row[]>, issues: Issue[]
): Pick<Analysis, "rutByName" | "collaborators"> => {
  const rutsByName = new Map<string, Set<string>>();
  const namesByRut = new Map<string, Set<string>>();
  const displayByRut = new Map<string, string>();
  const localitiesByName = new Map<string, Set<string>>();
  for (const row of rows.SIM) {
    const name = norm(row.Colaborador);
    if (name && txt(row.Localidad)) localitiesByName.set(name,
      new Set([...(localitiesByName.get(name) ?? []), txt(row.Localidad)]));
  }
  for (const row of rows.Telefono) {
    if (!txt(row.RUT) || !validRut(row.RUT)) continue;
    const rut = rutKey(row.RUT);
    const name = norm(row.Colaborador);
    rutsByName.set(name, new Set([...(rutsByName.get(name) ?? []), rut]));
    namesByRut.set(rut, new Set([...(namesByRut.get(rut) ?? []), name]));
    if (!displayByRut.has(rut)) displayByRut.set(rut, txt(row.Colaborador));
  }
  for (const [name, ruts] of rutsByName) {
    if (!name) add(issues, "CRITICAL", "MISSING_COLLABORATOR_NAME",
      "Existe un RUT válido sin nombre de colaborador.");
    if (ruts.size > 1) add(issues, "CRITICAL", "NAME_MULTIPLE_RUTS",
      "Un nombre normalizado está asociado a varios RUT; valores enmascarados.");
  }
  for (const names of namesByRut.values()) {
    if (names.size > 1) add(issues, "CRITICAL", "RUT_MULTIPLE_NAMES",
      "Un RUT está asociado a varios nombres; valores enmascarados.");
  }
  const rutByName = new Map<string, string>();
  for (const [name, ruts] of rutsByName) {
    if (ruts.size === 1) rutByName.set(name, [...ruts][0]!);
  }
  const collaborators = new Map<string, { rut: string; name: string; locality: string | null }>();
  for (const [rut, names] of namesByRut) {
    if (names.size !== 1) continue;
    const name = [...names][0]!;
    const localities = [...(localitiesByName.get(name) ?? [])];
    if (localities.length > 1) add(issues, "WARNING", "MULTIPLE_LOCALITIES",
      "Un colaborador presenta varias localidades; se conservará sin localidad.");
    collaborators.set(rut, {
      rut, name: displayByRut.get(rut)!,
      locality: localities.length === 1 ? localities[0]! : null
    });
  }
  for (const row of rows.Telefono) {
    if (txt(row.RUT)) continue;
    const inferred = rutByName.has(norm(row.Colaborador));
    add(issues, inferred ? "WARNING" : "PENDING",
      inferred ? "RUT_INFERRED_BY_EXACT_NAME" : "MISSING_RUT_UNRESOLVED",
      inferred
        ? `RUT reconciliable por nombre exacto (${ref("Telefono", row.__row)}).`
        : `Custodia pendiente por falta de RUT (${ref("Telefono", row.__row)}).`,
      "Telefono", row.__row);
  }
  for (const row of rows.SIM) {
    if (!rutByName.has(norm(row.Colaborador))) add(issues, "PENDING",
      "SIM_COLLABORATOR_WITHOUT_RUT",
      `Custodia SIM pendiente por falta de RUT (${ref("SIM", row.__row)}).`,
      "SIM", row.__row);
  }
  return { rutByName, collaborators };
};

const loadContext = async (
  rows: Record<SheetName, Row[]>,
  collaborators: Analysis["collaborators"], issues: Issue[]
): Promise<Context> => {
  const current = await pool.query<{ database: string }>(
    "SELECT current_database() database"
  );
  const database = current.rows[0]!.database;
  if (database !== "itam_dev" || env.database.name !== "itam_dev") add(issues,
    "CRITICAL", "WRONG_DATABASE", `Se exige itam_dev; conexión actual: ${database}.`);

  const stateRows = await pool.query<{ id: string; tipo_entidad: string; codigo: string }>(
    "SELECT id,tipo_entidad,codigo FROM itam.estados WHERE activo=TRUE"
  );
  const states = new Map(stateRows.rows.map((row) =>
    [`${row.tipo_entidad}:${row.codigo}`, row.id]));
  for (const key of ["DISPOSITIVO:DISPONIBLE", "DISPOSITIVO:ASIGNADO",
    "DISPOSITIVO:RETENIDO_REVISION", "SIM:DISPONIBLE", "SIM:ASIGNADA"]) {
    if (!states.has(key)) add(issues, "CRITICAL", "MISSING_REQUIRED_STATE",
      `Falta estado obligatorio ${key}; no se creará automáticamente.`);
  }

  const typeRows = await pool.query<{
    id: string; nombre: string; activo: boolean;
    familia_codigo_inventario_id: string | null; familia_activa: boolean | null;
  }>(`SELECT t.id,t.nombre,t.activo,t.familia_codigo_inventario_id,
      f.activo familia_activa FROM itam.tipos_dispositivo t
      LEFT JOIN itam.familias_codigo_inventario f ON f.id=t.familia_codigo_inventario_id
      WHERE LOWER(BTRIM(t.nombre)) IN ('smartphone','impresora')`);
  const deviceType = (name: string): DeviceType | null => {
    const row = typeRows.rows.find((candidate) => norm(candidate.nombre) === name);
    return row?.activo && row.familia_codigo_inventario_id && row.familia_activa
      ? { id: row.id, name: row.nombre, familyId: row.familia_codigo_inventario_id }
      : null;
  };
  const smartphone = deviceType("SMARTPHONE");
  const printer = deviceType("IMPRESORA");
  if (!smartphone) add(issues, "CRITICAL", "MISSING_SMARTPHONE_TYPE",
    "No existe Smartphone activo con familia de código activa.");
  if (!printer) add(issues, "CRITICAL", "MISSING_PRINTER_TYPE",
    "No existe el tipo Impresora activo con una familia de código activa.");
  const printerFamily = printer
    ? await pool.query<{ prefijo: string }>(
        "SELECT prefijo FROM itam.familias_codigo_inventario WHERE id=$1",
        [printer.familyId])
    : { rows: [] };
  if (printer && printerFamily.rows[0]?.prefijo !== "7") {
    add(issues, "CRITICAL", "INVALID_PRINTER_FAMILY",
      "El tipo Impresora no está asociado a la familia 7000 (prefijo 7).");
  }

  const familyRows = await pool.query<{
    id: string; tipo_entidad: string; prefijo: string; ultimo_ordinal: number;
  }>(`SELECT id,tipo_entidad,prefijo,ultimo_ordinal FROM itam.familias_codigo_inventario
      WHERE activo=TRUE`);
  const families = new Map(familyRows.rows.map((row) =>
    [row.id, { prefix: row.prefijo, ordinal: Number(row.ultimo_ordinal) }]));
  const simFamilyId = familyRows.rows.find((row) => row.tipo_entidad === "SIM")?.id ?? null;
  if (!simFamilyId) add(issues, "CRITICAL", "MISSING_SIM_FAMILY",
    "No existe una familia de códigos activa para SIM.");

  const ruts = [...collaborators.keys()];
  const existingRows = ruts.length ? await pool.query<{
    id: string; rut: string; nombre: string
  }>(`SELECT id,rut,nombre FROM itam.colaboradores
      WHERE UPPER(REGEXP_REPLACE(rut,'[^0-9Kk]','','g'))=ANY($1::text[])`, [ruts])
    : { rows: [] };
  const existingCollaborators = new Map(existingRows.rows.map((row) =>
    [rutKey(row.rut), { id: row.id, name: row.nombre }]));

  const imeis = rows.Telefono.map((row) => digits(row.IMEI1)).filter(Boolean);
  const iccids = rows.SIM.map((row) => normalizeIccid(row["Cod. Serie"]))
    .filter((value): value is string => Boolean(value));
  const phones = rows.SIM.map((row) => digits(row["Numero Asociado"])).filter(Boolean);
  const collision = async (table: "dispositivos" | "sim", column: string, values: string[]) =>
    values.length ? Number((await pool.query<{ total: string }>(
      `SELECT COUNT(*) total FROM itam.${table}
       WHERE REGEXP_REPLACE(${column},'\\D','','g')=ANY($1::text[])`, [values]
    )).rows[0]!.total) : 0;
  const [imeiCollisions, iccidCollisions, phoneCollisions] = await Promise.all([
    collision("dispositivos", "imei", imeis),
    collision("sim", "iccid_codigo_fabrica", iccids),
    collision("sim", "numero_asociado", phones)
  ]);
  if (imeiCollisions) add(issues, "CRITICAL", "IMEI_ALREADY_EXISTS",
    `${imeiCollisions} IMEI del archivo ya existen en itam_dev.`);
  if (iccidCollisions) add(issues, "CRITICAL", "ICCID_ALREADY_EXISTS",
    `${iccidCollisions} ICCID del archivo ya existen en itam_dev.`);
  if (phoneCollisions) add(issues, "CRITICAL", "PHONE_ALREADY_EXISTS",
    `${phoneCollisions} números del archivo ya existen en itam_dev.`);

  const countRows = await pool.query<{
    devices: string; sims: string; collaborators: string; history: string
  }>(`SELECT (SELECT COUNT(*) FROM itam.dispositivos) devices,
      (SELECT COUNT(*) FROM itam.sim) sims,
      (SELECT COUNT(*) FROM itam.colaboradores) collaborators,
      (SELECT COUNT(*) FROM itam.historial_eventos) history`);
  const count = countRows.rows[0]!;
  return { database, states, smartphone, printer, simFamilyId, families,
    existingCollaborators, before: {
      devices: Number(count.devices), sims: Number(count.sims),
      collaborators: Number(count.collaborators), history: Number(count.history)
    } };
};

const analyze = async (sourcePath: string): Promise<Analysis> => {
  const issues: Issue[] = [];
  const workbook = await readExcelFile(sourcePath) as unknown as Sheet[];
  const rows = analyzeSource(workbook, issues);
  const collaboratorInfo = analyzeCollaborators(rows, issues);
  const context = await loadContext(rows, collaboratorInfo.collaborators, issues);
  return { sourcePath, rows, issues, ...collaboratorInfo, context };
};

const estimatedRange = (
  context: Context, familyId: string | null, quantity: number
): { first: number | null; last: number | null } => {
  const family = familyId ? context.families.get(familyId) : undefined;
  if (!family || quantity < 1) return { first: null, last: null };
  try {
    return {
      first: formatInventoryCode(family.prefix, family.ordinal + 1),
      last: formatInventoryCode(family.prefix, family.ordinal + quantity)
    };
  } catch {
    return { first: null, last: null };
  }
};

const printReport = (analysis: Analysis): void => {
  const count = (severity: Severity) =>
    analysis.issues.filter((item) => item.severity === severity).length;
  const criticalBySheet = (sheet: SheetName) =>
    analysis.issues.filter((item) =>
      item.severity === "CRITICAL" && item.sheet === sheet).length;
  const uniqueNames = new Set([
    ...analysis.rows.Telefono.map((row) => norm(row.Colaborador)),
    ...analysis.rows.SIM.map((row) => norm(row.Colaborador))
  ].filter(Boolean));
  const namesWithoutRut = [...uniqueNames]
    .filter((name) => !analysis.rutByName.has(name)).length;
  const simGroups = new Map<string, Row[]>();
  for (const row of analysis.rows.SIM) {
    simGroups.set(norm(row.ID), [...(simGroups.get(norm(row.ID)) ?? []), row]);
  }
  const phoneGroups = new Map<string, Row[]>();
  for (const row of analysis.rows.Telefono) {
    phoneGroups.set(norm(row.ID_SIM), [
      ...(phoneGroups.get(norm(row.ID_SIM)) ?? []), row
    ]);
  }
  const relationshipCandidates = analysis.rows.Telefono.filter((row) => {
    const key = norm(row.ID_SIM);
    const sims = simGroups.get(key) ?? [];
    const phones = phoneGroups.get(key) ?? [];
    if (sims.length !== 1 || phones.length !== 1) return false;
    const sim = sims[0]!;
    const simPhone = validPhone(sim["Numero Asociado"]);
    const devicePhone = validPhone(row["Numero asociado"]);
    return (!simPhone || !devicePhone || simPhone === devicePhone) &&
      norm(sim.Colaborador) === norm(row.Colaborador);
  }).length;
  const phoneCustodies = analysis.rows.Telefono.filter((row) =>
    (txt(row.RUT) && validRut(row.RUT)) ||
    analysis.rutByName.has(norm(row.Colaborador))).length;
  const simCustodies = analysis.rows.SIM.filter((row) =>
    analysis.rutByName.has(norm(row.Colaborador))).length;
  const localities = new Set([
    ...analysis.rows.SIM.map((row) => txt(row.Localidad)),
    ...analysis.rows.Impresoras.map((row) => txt(row.Oficina))
  ].filter(Boolean));
  const overallCritical = count("CRITICAL");
  const smartphoneFamily = analysis.context.smartphone?.familyId ?? null;
  const printerFamily = analysis.context.printer?.familyId ?? null;
  console.log(JSON.stringify({
    mode: "DRY_RUN_READ_ONLY",
    database: analysis.context.database,
    source: path.basename(analysis.sourcePath),
    ignoredSheets: ["Hoja1"],
    sheets: {
      SIM: { rows: analysis.rows.SIM.length, headers: HEADERS.SIM },
      Telefono: { rows: analysis.rows.Telefono.length, headers: HEADERS.Telefono },
      Impresoras: { rows: analysis.rows.Impresoras.length, headers: HEADERS.Impresoras }
    },
    columnMapping: {
      SIM: {
        ID: "historial.detalle.historicalCode",
        "Compañía": "sim.compania", "Cod. Serie": "sim.iccid_codigo_fabrica",
        Colaborador: "reconciliación por RUT desde Telefono",
        Estado: "historial.detalle.sourceState",
        Descripcion: "sim.observaciones", Localidad: "sim.observaciones",
        "Numero Asociado": "sim.numero_asociado"
      },
      Telefono: {
        ID: "historial.detalle.historicalCode", Equipo: "dispositivos.marca/modelo",
        IMEI1: "dispositivos.imei", ID_SIM: "relación sim.dispositivo_id",
        Colaborador: "colaboradores.nombre/custodia", RUT: "colaboradores.rut",
        Estado: "historial.detalle.sourceState",
        "Numero asociado": "validación cruzada con sim.numero_asociado",
        Descripcion: "dispositivos.observaciones",
        "Revision SIM post entrega": "dispositivos.observaciones",
        "Valor arreglo": "sin destino: no es valor_comercial"
      },
      Impresoras: {
        Impresora: "dispositivos.marca/modelo",
        Oficina: "dispositivos.localidad/ubicacion_detalle",
        Solicitud: "dispositivos.fecha_registro",
        Negro: "dispositivos.atributos_especificos.tonerNegro",
        Color: "dispositivos.atributos_especificos.tonerColor",
        Estado: "historial/observaciones y RETENIDO_REVISION"
      }
    },
    entities: {
      smartphones: {
        detected: analysis.rows.Telefono.length,
        criticalFindings: criticalBySheet("Telefono"),
        importableInBatch: overallCritical ? 0 : analysis.rows.Telefono.length
      },
      sims: {
        detected: analysis.rows.SIM.length,
        withValidIccid: analysis.rows.SIM.filter((row) =>
          Boolean(normalizeIccid(row["Cod. Serie"]))).length,
        withNullIccid: analysis.rows.SIM.filter((row) =>
          !normalizeIccid(row["Cod. Serie"])).length,
        criticalFindings: criticalBySheet("SIM"),
        importableInBatch: overallCritical ? 0 : analysis.rows.SIM.length
      },
      printers: {
        detected: analysis.rows.Impresoras.length,
        family: "7000",
        criticalFindings: criticalBySheet("Impresoras"),
        importableInBatch: overallCritical ? 0 : analysis.rows.Impresoras.length
      },
      collaborators: {
        detectedNames: uniqueNames.size, withValidRut: analysis.collaborators.size,
        withoutResolvedRut: namesWithoutRut,
        existing: analysis.context.existingCollaborators.size,
        new: analysis.collaborators.size - analysis.context.existingCollaborators.size
      }
    },
    relationships: {
      smartphoneSimCandidates: relationshipCandidates,
      smartphoneCustodiesResolvable: phoneCustodies,
      simCustodiesResolvable: simCustodies,
      departmentsAssociated: 0,
      departmentsPending: analysis.collaborators.size,
      localitiesDetected: localities.size
    },
    sourceStates: {
      SIM: [...new Set(analysis.rows.SIM.map((row) => txt(row.Estado)).filter(Boolean))],
      Telefono: [...new Set(analysis.rows.Telefono.map((row) => txt(row.Estado)).filter(Boolean))],
      Impresoras: [...new Set(analysis.rows.Impresoras.map((row) => txt(row.Estado)).filter(Boolean))]
    },
    stateMapping: {
      "SIM ACTIVO": "ASIGNADA cuando existe relación; DISPONIBLE sin relación",
      "Telefono ACTIVO": "ASIGNADO con RUT resuelto; DISPONIBLE sin custodia",
      "Telefono RECEPCIONADO": "estado fuente pendiente; estado ITAM derivado por custodia",
      "Impresora ENTREGADO/SOLICITUD": "RETENIDO_REVISION hasta reconciliar custodia"
    },
    estimatedCodes: {
      Smartphone: estimatedRange(analysis.context, smartphoneFamily,
        analysis.rows.Telefono.length),
      SIM: estimatedRange(analysis.context, analysis.context.simFamilyId,
        analysis.rows.SIM.length),
      Impresora: estimatedRange(analysis.context, printerFamily,
        analysis.rows.Impresoras.length)
    },
    before: analysis.context.before,
    issues: {
      critical: overallCritical, pending: count("PENDING"),
      warnings: count("WARNING"), detail: analysis.issues
    },
    writesPerformed: false
  }, null, 2));
};

const history = async (
  client: PoolClient, entity: "DISPOSITIVO" | "SIM", entityId: string,
  event: string, previousState: string | null, nextState: string | null,
  detail: Record<string, unknown>
): Promise<void> => {
  await client.query(`INSERT INTO itam.historial_eventos(
      tipo_entidad,dispositivo_id,sim_id,tipo_evento,estado_anterior_id,
      estado_nuevo_id,responsable,observaciones,detalle,usuario_ejecutor_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NULL)`, [
    entity, entity === "DISPOSITIVO" ? entityId : null,
    entity === "SIM" ? entityId : null, event, previousState, nextState,
    RESPONSIBLE, `Origen: ${SOURCE}.`, JSON.stringify({ source: SOURCE, ...detail })
  ]);
};

const createDevice = async (
  client: PoolClient, type: DeviceType, stateId: string,
  data: { brand: string | null; model: string | null; imei?: string | null;
    locality?: string | null; location?: string | null; observations: string;
    attributes?: Record<string, string | number | null>; date?: string;
    historical?: string; sourceState: string },
  counts: Counts
): Promise<{ id: string; code: number }> => {
  const code = await generateInventoryCodeByFamilyId(type.familyId, "DISPOSITIVO", client);
  const result = await client.query<{ id: string }>(`
    INSERT INTO itam.dispositivos(
      codigo_inventario,tipo_dispositivo_id,marca,modelo,numero_serie,imei,
      estado_id,localidad,ubicacion_detalle,observaciones,atributos_especificos,
      valor_comercial,fecha_registro)
    VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10::jsonb,0,
      COALESCE($11::date,CURRENT_DATE)) RETURNING id`, [
    code, type.id, data.brand, data.model, data.imei ?? null, stateId,
    data.locality ?? null, data.location ?? null, data.observations,
    JSON.stringify(data.attributes ?? {}), data.date ?? null
  ]);
  await history(client, "DISPOSITIVO", result.rows[0]!.id,
    "ALTA_DISPOSITIVO", null, stateId, {
      historicalCode: data.historical ?? null, sourceState: data.sourceState,
      generatedInventoryCode: code, deviceType: type.name
    });
  counts.historyEvents += 1;
  return { id: result.rows[0]!.id, code };
};

const importAll = async (analysis: Analysis): Promise<Counts> => {
  const critical = analysis.issues.filter((item) => item.severity === "CRITICAL");
  if (critical.length) throw new Error(
    `Importación bloqueada por ${critical.length} conflictos críticos.`);
  const counts: Counts = {
    collaboratorsCreated: 0, collaboratorsReused: 0, smartphones: 0,
    printers: 0, sims: 0, deviceAssignments: 0, simAssignments: 0,
    simAssociations: 0, simAssociationsPending: 0, simsWithNullIccid: 0,
    historyEvents: 0, deviceTypesCreated: 0
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const collaboratorIds = new Map<string, string>();
    for (const [key, collaborator] of analysis.collaborators) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [`colaborador-rut:${key}`]
      );
      const current = await client.query<{ id: string }>(
        `SELECT id FROM itam.colaboradores
         WHERE UPPER(REGEXP_REPLACE(BTRIM(rut),'[^0-9Kk]','','g'))=$1
         ORDER BY id LIMIT 1`,
        [key]
      );
      const existing = current.rows[0];
      if (existing) {
        collaboratorIds.set(key, existing.id);
        counts.collaboratorsReused += 1;
      } else {
        const result = await client.query<{ id: string }>(`
          INSERT INTO itam.colaboradores(
            rut,nombre,cargo,departamento_id,localidad,activo,observaciones)
          VALUES($1,$2,NULL,NULL,$3,TRUE,$4) RETURNING id`, [
          collaborator.rut, collaborator.name, collaborator.locality,
          `Importado desde ${SOURCE}; departamento pendiente de reconciliación.`
        ]);
        collaboratorIds.set(key, result.rows[0]!.id);
        counts.collaboratorsCreated += 1;
      }
    }

    const available = analysis.context.states.get("DISPOSITIVO:DISPONIBLE")!;
    const assigned = analysis.context.states.get("DISPOSITIVO:ASIGNADO")!;
    const review = analysis.context.states.get("DISPOSITIVO:RETENIDO_REVISION")!;
    const simAvailable = analysis.context.states.get("SIM:DISPONIBLE")!;
    const simAssigned = analysis.context.states.get("SIM:ASIGNADA")!;
    const smartphone = analysis.context.smartphone!;
    const printer = analysis.context.printer!;
    const simGroups = new Map<string, Row[]>();
    for (const row of analysis.rows.SIM) {
      const key = norm(row.ID);
      simGroups.set(key, [...(simGroups.get(key) ?? []), row]);
    }
    const phoneGroups = new Map<string, Row[]>();
    for (const row of analysis.rows.Telefono) {
      const key = norm(row.ID_SIM);
      phoneGroups.set(key, [...(phoneGroups.get(key) ?? []), row]);
    }
    const safeAssociationKeys = new Set<string>();
    for (const [key, phones] of phoneGroups) {
      const sims = simGroups.get(key) ?? [];
      if (phones.length !== 1 || sims.length !== 1) continue;
      const phone = phones[0]!;
      const sim = sims[0]!;
      const simPhone = validPhone(sim["Numero Asociado"]);
      const devicePhone = validPhone(phone["Numero asociado"]);
      if (simPhone && devicePhone && simPhone !== devicePhone) continue;
      if (norm(sim.Colaborador) !== norm(phone.Colaborador)) continue;
      safeAssociationKeys.add(key);
    }
    const devicesBySimHistoricalId = new Map<string, { id: string; code: number }>();

    for (const row of analysis.rows.Telefono) {
      const equipment = txt(row.Equipo);
      const key = norm(row.Equipo);
      const brand = key.startsWith("GALAXY ") ? "Samsung"
        : key.startsWith("MOTO ") ? "Motorola" : null;
      const notes = [txt(row.Descripcion), txt(row["Revision SIM post entrega"])]
        .filter(Boolean).join(" | ");
      const device = await createDevice(client, smartphone, available, {
        brand, model: equipment || null, imei: digits(row.IMEI1),
        observations: `Fuente ${SOURCE}${notes ? `: ${notes}` : "."}`,
        historical: txt(row.ID), sourceState: txt(row.Estado)
      }, counts);
      const simHistoricalId = norm(row.ID_SIM);
      if (safeAssociationKeys.has(simHistoricalId)) {
        devicesBySimHistoricalId.set(simHistoricalId, device);
      }
      counts.smartphones += 1;
      const resolvedRut = txt(row.RUT) && validRut(row.RUT)
        ? rutKey(row.RUT) : analysis.rutByName.get(norm(row.Colaborador));
      const collaboratorId = resolvedRut ? collaboratorIds.get(resolvedRut) : undefined;
      if (collaboratorId) {
        await client.query(
          "UPDATE itam.dispositivos SET colaborador_id=$2,estado_id=$3 WHERE id=$1",
          [device.id, collaboratorId, assigned]);
        await history(client, "DISPOSITIVO", device.id, "ASIGNAR_COLABORADOR",
          available, assigned, { collaboratorId, sourceState: txt(row.Estado) });
        counts.deviceAssignments += 1;
        counts.historyEvents += 1;
      }
    }

    for (const row of analysis.rows.Impresoras) {
      const parts = txt(row.Impresora).split(/\s+/);
      await createDevice(client, printer, review, {
        brand: parts.shift() || null, model: parts.join(" ") || null,
        locality: txt(row.Oficina) || null, location: txt(row.Oficina) || null,
        observations: `Fuente ${SOURCE}; estado fuente ${txt(row.Estado)}; custodia pendiente.`,
        attributes: {
          tonerNegro: typeof row.Negro === "number" ? row.Negro : null,
          tonerColor: typeof row.Color === "number" ? row.Color : null
        }, date: txt(row.Solicitud) || undefined, sourceState: txt(row.Estado)
      }, counts);
      counts.printers += 1;
    }

    for (const row of analysis.rows.SIM) {
      const code = await generateInventoryCode("SIM", null, client);
      const iccid = normalizeIccid(row["Cod. Serie"]);
      const sourceDescription = txt(row.Descripcion);
      const locality = txt(row.Localidad);
      const observations = [
        `Fuente ${SOURCE}.`,
        sourceDescription || null,
        `Localidad ${locality || "no informada"}.`,
        iccid ? null : "ICCID pendiente de completar."
      ].filter((value): value is string => Boolean(value)).join(" ");
      const inserted = await client.query<{ id: string }>(`
        INSERT INTO itam.sim(
          codigo_inventario,iccid_codigo_fabrica,numero_asociado,compania,
          estado_id,colaborador_id,dispositivo_id,observaciones)
        VALUES($1,$2,$3,$4,$5,NULL,NULL,$6) RETURNING id`, [
        code, iccid, validPhone(row["Numero Asociado"]),
        txt(row["Compañía"]) || null, simAvailable,
        observations
      ]);
      const simId = inserted.rows[0]!.id;
      await history(client, "SIM", simId, "ALTA_SIM", null, simAvailable, {
        historicalCode: txt(row.ID), sourceState: txt(row.Estado),
        generatedInventoryCode: code
      });
      counts.sims += 1;
      if (!iccid) counts.simsWithNullIccid += 1;
      counts.historyEvents += 1;

      const resolvedRut = analysis.rutByName.get(norm(row.Colaborador));
      const collaboratorId = resolvedRut ? collaboratorIds.get(resolvedRut) : undefined;
      if (collaboratorId) {
        await client.query(
          "UPDATE itam.sim SET colaborador_id=$2,estado_id=$3 WHERE id=$1",
          [simId, collaboratorId, simAssigned]);
        await history(client, "SIM", simId, "ASIGNAR_COLABORADOR",
          simAvailable, simAssigned, { collaboratorId });
        counts.simAssignments += 1;
        counts.historyEvents += 1;
      }
      const device = devicesBySimHistoricalId.get(norm(row.ID));
      if (device) {
        await client.query(
          "UPDATE itam.sim SET dispositivo_id=$2,estado_id=$3 WHERE id=$1",
          [simId, device.id, simAssigned]);
        await history(client, "SIM", simId, "ASOCIAR_DISPOSITIVO",
          collaboratorId ? simAssigned : simAvailable, simAssigned,
          { deviceId: device.id, deviceInventoryCode: device.code });
        counts.simAssociations += 1;
        counts.historyEvents += 1;
      } else if (phoneGroups.has(norm(row.ID))) {
        counts.simAssociationsPending += 1;
      }
    }
    await client.query("COMMIT");
    return counts;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const main = async (): Promise<void> => {
  const dryRun = process.argv.includes("--dry-run");
  const explicit = process.argv.find((argument) => argument.toLowerCase().endsWith(".xlsx"));
  const sourcePath = path.resolve(explicit ?? path.resolve(__dirname, "../../../Inventario.xlsx"));
  const analysis = await analyze(sourcePath);
  printReport(analysis);
  const critical = analysis.issues.filter((item) => item.severity === "CRITICAL").length;
  if (dryRun) {
    if (critical) process.exitCode = 2;
    return;
  }
  if (critical) throw new Error(
    `Importación no ejecutada: existen ${critical} conflictos críticos.`);
  const counts = await importAll(analysis);
  const after = await pool.query(
    `SELECT (SELECT COUNT(*) FROM itam.dispositivos) devices,
      (SELECT COUNT(*) FROM itam.sim) sims,
      (SELECT COUNT(*) FROM itam.colaboradores) collaborators,
      (SELECT COUNT(*) FROM itam.historial_eventos) history`
  );
  console.log(JSON.stringify({
    mode: "IMPORT_COMMITTED", counts, totals: after.rows[0]
  }, null, 2));
};

void main().catch((error) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : "Importación fallida.",
    writesCommitted: false
  }));
  process.exitCode = 1;
}).finally(async () => {
  await pool.end().catch(() => undefined);
});
