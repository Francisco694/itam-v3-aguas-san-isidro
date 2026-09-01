import path from "node:path";
import readExcelFile from "read-excel-file/node";
import type { PoolClient } from "pg";
import { pool } from "../config/database";
import { env } from "../config/env";
import { formatInventoryCode } from "../modules/inventory-codes/inventory-code";
import { generateInventoryCodeByFamilyId } from "../modules/inventory-codes/inventory-code.service";
import {
  isValidRut as validRut,
  normalizeRut as rutKey
} from "../shared/rut";

const SOURCE_FILE = "conciliacion_rrhh_inventario_sql.xlsx";
const SOURCE_LABEL = "Importación conciliación RRHH + Inventario SQL";
const IMPORTER = "Importador conciliación RRHH + Inventario SQL";
const KEY_PREFIX = "RECONCILED_RRHH_INVENTORY_SQL";

type Cell = string | number | boolean | Date | null;
type Row = Record<string, Cell> & { __row: number };
type Sheet = { sheet: string; data: Cell[][] };
type Severity = "CRITICAL" | "PENDING" | "WARNING";
type Custody = "VIGENTE" | "EGRESADO" | "DEPARTMENT" | "NONE";
type Action = "NEW" | "REUSE" | "SKIP";

interface Issue { severity: Severity; code: string; message: string; assetKey?: string }
interface DeviceType { id: string; name: string; familyId: string; prefix: string; ordinal: number }
interface Device {
  id: string; code: number; typeName: string; imei: string | null; serial: string | null;
  collaboratorId: string | null; departmentId: string | null; stateId: string; stateCode: string;
}
interface Collaborator {
  rutKey: string; rut: string; name: string; cargo: string | null; locality: string | null;
  active: boolean; existingId: string | null; existingActive: boolean | null;
}
interface Sim {
  id: string; collaboratorId: string | null; deviceId: string | null;
  stateId: string; stateCode: string;
}
interface Plan {
  source: Row; inventory: Row | null; assetKey: string; importKey: string;
  action: Action; type: DeviceType | null; identifierKind: "IMEI" | "SERIAL" | "NONE";
  identifier: string | null; existing: Device | null; custody: Custody;
  collaborator: Collaborator | null; departmentId: string | null;
  deliveryDate: string | null; historicalResponsible: string | null;
  reason: string | null; checksumValid: boolean | null; sourceValue: number | null;
}
interface Counts {
  devices: number; collaborators: number; personalCustodies: number;
  departmentCustodies: number; unassignedDevices: number; history: number; actas: number;
}
interface Context {
  database: string; states: Map<string, string>; types: Map<string, DeviceType>;
  byImei: Map<string, Device[]>; bySerial: Map<string, Device[]>;
  markers: Map<string, Device>; collaborators: Map<string, { id: string; active: boolean }>;
  departments: Map<string, { id: string; name: string }[]>;
  simsByPhone: Map<string, Sim[]>; usedCodes: Set<number>; before: Counts;
}
interface Analysis {
  sourcePath: string; currentRows: Row[]; inventoryRows: Row[];
  plans: Plan[]; issues: Issue[]; context: Context;
}
interface ImportResult {
  collaboratorsCreated: number; collaboratorsReused: number;
  devicesCreated: Record<string, number>; devicesReused: number;
  assignmentsVigentes: number; assignmentsEgresados: number;
  departmentCustodies: number; simAssociated: number; historyCreated: number;
  generatedCodes: Record<string, number[]>;
}

const txt = (value: Cell | undefined): string => value == null ? ""
  : value instanceof Date ? value.toISOString() : String(value).trim();
const norm = (value: Cell | undefined): string => txt(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const digits = (value: Cell | undefined): string => txt(value).replace(/\D/g, "");
const isoDate = (value: Cell | undefined): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = txt(value); if (!raw) return null;
  const date = new Date(raw); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};
const money = (value: Cell | undefined): number | null => {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  const raw = txt(value).replace(/[$\s]/g, ""); if (!raw) return null;
  const normalized = /^[0-9]{1,3}(\.[0-9]{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw.replace(/,/g, "");
  const parsed = Number(normalized); return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
const issue = (list: Issue[], severity: Severity, code: string, message: string, assetKey?: string): void => {
  list.push({ severity, code, message, assetKey });
};

const parseSheet = (workbook: Sheet[], name: string, required: string[], issues: Issue[]): Row[] => {
  const sheet = workbook.find((candidate) => candidate.sheet === name);
  if (!sheet) { issue(issues, "CRITICAL", "MISSING_SHEET", `Falta la hoja ${name}.`); return []; }
  const headers = (sheet.data[0] ?? []).map(txt);
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) {
    issue(issues, "CRITICAL", "MISSING_HEADERS", `${name} no contiene: ${missing.join(", ")}.`);
    return [];
  }
  return sheet.data.slice(1).map((cells, index) => {
    const row: Row = { __row: index + 2 };
    headers.forEach((header, column) => { if (header) row[header] = cells[column] ?? null; });
    return row;
  }).filter((row) => headers.some((header) => header && txt(row[header])));
};

const extractSerials = (description: string): string[] => {
  const expression = /(?:S\/N|\bSN\b|SERIAL|N[ÚU]MERO\s+DE\s+SERIE|NUEMERO\s+SERIE|NRO\.?\s*SERIE)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{4,})/giu;
  return [...description.matchAll(expression)].map((match) => match[1]!.toUpperCase())
    .filter((value, index, all) => all.indexOf(value) === index);
};

const classify = (row: Row): { type: string | null; reason: string | null } => {
  if (norm(row.tipo_dispositivo) === "SMARTPHONE") return { type: "SMARTPHONE", reason: null };
  const description = norm(row.descripcion_equipo);
  if (/\b(TABLET|IPAD)\b/.test(description)) return { type: null, reason: "Tablet no existe en el catálogo actual." };
  if (/\b(SMARTPHONE|TELEFONO|CELULAR|IPHONE|MOTOROLA|SAMSUNG)\b/.test(description)) {
    return { type: null, reason: "Posible teléfono sin IMEI estructurado." };
  }
  if (/\b(IMPRESORA|MULTIFUNCIONAL)\b/.test(description)) return { type: "IMPRESORA", reason: null };
  if (/ALL IN ONE|\bAIO\b|COMPUTADOR DE ESCRITORIO|COMPUTADOR ESCRITORIO|EQUIPO PC|\bDESKTOP\b/.test(description)) {
    return { type: "PC", reason: null };
  }
  if (/\b(NOTEBOOK|LAPTOP|PORTATIL)\b|\bHP (240|250|14-|15)/.test(description)) return { type: "NOTEBOOK", reason: null };
  if (/^(SE ENTREGA )?(1 )?(MONITOR|PANTALLA)\b/.test(description) && !/COMPUTADOR|NOTEBOOK|PC/.test(description)) {
    return { type: "MONITOR", reason: null };
  }
  const peripheral = ["MOUSE", "TECLADO", "WEBCAM", "DOCKING STATION", "DOCK", "HUB USB", "CARGADOR", "ADAPTADOR", "CABLE"]
    .find((name) => description === name || description.startsWith(`${name} `));
  if (peripheral && !/COMPUTADOR|NOTEBOOK|PC|MONITOR|PANTALLA/.test(description)) {
    return { type: peripheral === "DOCK" ? "DOCKING STATION" : peripheral, reason: null };
  }
  return { type: null, reason: "La descripción no determina un tipo oficial inequívoco." };
};

const mapDevice = (row: {
  id: string; code: number; type_name: string; imei: string | null; serial: string | null;
  collaborator_id: string | null; department_id: string | null; state_id: string; state_code: string;
}): Device => ({ id: row.id, code: Number(row.code), typeName: row.type_name,
  imei: row.imei, serial: row.serial, collaboratorId: row.collaborator_id,
  departmentId: row.department_id, stateId: row.state_id, stateCode: row.state_code });

const loadContext = async (issues: Issue[]): Promise<Context> => {
  const current = await pool.query<{ database: string }>("SELECT current_database() database");
  const database = current.rows[0]!.database;
  if (database !== "itam_dev" || env.database.name !== "itam_dev") {
    issue(issues, "CRITICAL", "WRONG_DATABASE", `Se exige itam_dev; conexión actual: ${database}.`);
  }
  const stateRows = await pool.query<{ id: string; tipo_entidad: string; codigo: string }>(
    "SELECT id,tipo_entidad,codigo FROM itam.estados WHERE activo=TRUE"
  );
  const states = new Map(stateRows.rows.map((row) => [`${row.tipo_entidad}:${row.codigo}`, row.id]));
  for (const key of ["DISPOSITIVO:DISPONIBLE", "DISPOSITIVO:ASIGNADO", "DISPOSITIVO:RETENIDO_REVISION", "SIM:ASIGNADA"]) {
    if (!states.has(key)) issue(issues, "CRITICAL", "MISSING_STATE", `Falta el estado ${key}.`);
  }
  const typeRows = await pool.query<{
    id: string; nombre: string; family_id: string | null; prefijo: string | null; ordinal: number | null;
  }>(`SELECT t.id,t.nombre,t.familia_codigo_inventario_id family_id,f.prefijo,
      f.ultimo_ordinal ordinal FROM itam.tipos_dispositivo t
    LEFT JOIN itam.familias_codigo_inventario f
      ON f.id=t.familia_codigo_inventario_id AND f.activo=TRUE WHERE t.activo=TRUE`);
  const types = new Map<string, DeviceType>();
  for (const row of typeRows.rows) if (row.family_id && row.prefijo && row.ordinal !== null) {
    types.set(norm(row.nombre), { id: row.id, name: row.nombre, familyId: row.family_id,
      prefix: row.prefijo, ordinal: Number(row.ordinal) });
  }
  for (const name of ["SMARTPHONE", "NOTEBOOK", "PC", "MONITOR", "IMPRESORA"]) {
    if (!types.has(name)) issue(issues, "CRITICAL", "MISSING_DEVICE_TYPE", `Falta ${name} con familia activa.`);
  }

  const deviceRows = await pool.query<{
    id: string; code: number; type_name: string; imei: string | null; serial: string | null;
    collaborator_id: string | null; department_id: string | null; state_id: string; state_code: string;
  }>(`SELECT d.id,d.codigo_inventario code,t.nombre type_name,d.imei,d.numero_serie serial,
      d.colaborador_id,d.departamento_id,d.estado_id state_id,e.codigo state_code
    FROM itam.dispositivos d JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id
    JOIN itam.estados e ON e.id=d.estado_id`);
  const byImei = new Map<string, Device[]>(), bySerial = new Map<string, Device[]>();
  const usedCodes = new Set<number>(), byId = new Map<string, Device>();
  for (const row of deviceRows.rows) {
    const device = mapDevice(row); byId.set(device.id, device); usedCodes.add(device.code);
    const imei = digits(device.imei ?? undefined), serial = norm(device.serial ?? undefined);
    if (imei) byImei.set(imei, [...(byImei.get(imei) ?? []), device]);
    if (serial) bySerial.set(serial, [...(bySerial.get(serial) ?? []), device]);
  }
  const markerRows = await pool.query<{ import_key: string; device_id: string }>(
    `SELECT detalle->>'importKey' import_key,dispositivo_id device_id FROM itam.historial_eventos
     WHERE detalle->>'importKey' LIKE $1 AND dispositivo_id IS NOT NULL`, [`${KEY_PREFIX}:%`]
  );
  const markers = new Map<string, Device>();
  for (const marker of markerRows.rows) {
    const device = byId.get(marker.device_id);
    if (!device) { issue(issues, "CRITICAL", "ORPHAN_IMPORT_MARKER", "Clave de importación huérfana."); continue; }
    const previous = markers.get(marker.import_key);
    if (previous && previous.id !== device.id) issue(issues, "CRITICAL", "DUPLICATE_IMPORT_MARKER",
      "Una clave de importación apunta a más de un dispositivo.");
    markers.set(marker.import_key, device);
  }
  const collaboratorRows = await pool.query<{ id: string; rut: string; activo: boolean }>(
    "SELECT id,rut,activo FROM itam.colaboradores"
  );
  const collaborators = new Map(collaboratorRows.rows.map((row) =>
    [rutKey(row.rut), { id: row.id, active: row.activo }]));
  const departmentRows = await pool.query<{ id: string; nombre: string }>(
    "SELECT id,nombre FROM itam.departamentos WHERE activo=TRUE"
  );
  const departments = new Map<string, { id: string; name: string }[]>();
  for (const row of departmentRows.rows) {
    const key = norm(row.nombre);
    departments.set(key, [...(departments.get(key) ?? []), { id: row.id, name: row.nombre }]);
  }
  const simRows = await pool.query<{
    id: string; phone: string | null; collaborator_id: string | null; device_id: string | null;
    state_id: string; state_code: string;
  }>(`SELECT s.id,s.numero_asociado phone,s.colaborador_id,s.dispositivo_id device_id,
      s.estado_id state_id,e.codigo state_code FROM itam.sim s JOIN itam.estados e ON e.id=s.estado_id`);
  const simsByPhone = new Map<string, Sim[]>();
  for (const row of simRows.rows) {
    const phone = digits(row.phone ?? undefined); if (!phone) continue;
    const sim: Sim = { id: row.id, collaboratorId: row.collaborator_id,
      deviceId: row.device_id, stateId: row.state_id, stateCode: row.state_code };
    simsByPhone.set(phone, [...(simsByPhone.get(phone) ?? []), sim]);
  }
  const countResult = await pool.query<Record<keyof Counts, string>>(`SELECT
    (SELECT COUNT(*) FROM itam.dispositivos) devices,
    (SELECT COUNT(*) FROM itam.colaboradores) collaborators,
    (SELECT COUNT(*) FROM itam.dispositivos WHERE colaborador_id IS NOT NULL) "personalCustodies",
    (SELECT COUNT(*) FROM itam.dispositivos WHERE departamento_id IS NOT NULL) "departmentCustodies",
    (SELECT COUNT(*) FROM itam.dispositivos WHERE colaborador_id IS NULL AND departamento_id IS NULL) "unassignedDevices",
    (SELECT COUNT(*) FROM itam.historial_eventos) history,
    (SELECT COUNT(*) FROM itam.actas_entrega) actas`);
  const c = countResult.rows[0]!;
  const before: Counts = { devices: Number(c.devices), collaborators: Number(c.collaborators),
    personalCustodies: Number(c.personalCustodies), departmentCustodies: Number(c.departmentCustodies),
    unassignedDevices: Number(c.unassignedDevices), history: Number(c.history), actas: Number(c.actas) };
  return { database, states, types, byImei, bySerial, markers, collaborators,
    departments, simsByPhone, usedCodes, before };
};

const collaboratorCandidates = (rows: Row[], context: Context, issues: Issue[]): Map<string, Collaborator> => {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    if (!validRut(row.rut_normalizado) || norm(row.rut_valido) !== "SI") continue;
    const labor = norm(row.estado_laboral_rrhh), reconciliation = norm(row.resultado_conciliacion);
    const eligible = labor === "VIGENTE" && reconciliation === "COINCIDENCIA VIGENTE"
      || labor === "EGRESADO" && reconciliation === "EQUIPO ASIGNADO A PERSONA EGRESADA";
    if (!eligible) continue;
    const key = rutKey(row.rut_normalizado);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const result = new Map<string, Collaborator>();
  for (const [key, candidates] of grouped) {
    const names = [...new Set(candidates.map((row) => txt(row.nombre_rrhh)).filter(Boolean))];
    if (names.length !== 1) {
      issue(issues, "PENDING", "COLLABORATOR_NAME_CONFLICT",
        "Un RUT elegible tiene nombres RRHH inconsistentes."); continue;
    }
    const active = candidates.some((row) => norm(row.estado_laboral_rrhh) === "VIGENTE");
    const existing = context.collaborators.get(key), first = candidates[0]!;
    result.set(key, { rutKey: key, rut: key, name: names[0]!,
      cargo: txt(first.cargo_inventario) || null, locality: txt(first.localidad_inventario) || null,
      active, existingId: existing?.id ?? null, existingActive: existing?.active ?? null });
  }
  return result;
};

const analyze = async (sourcePath: string): Promise<Analysis> => {
  const issues: Issue[] = [], workbook = await readExcelFile(sourcePath) as unknown as Sheet[];
  const currentRows = parseSheet(workbook, "Asignaciones actuales", [
    "asset_key", "inventario_id", "tipo_dispositivo", "identificador_unico", "descripcion_equipo", "imei_original",
    "rut_normalizado", "rut_valido", "estado_laboral_rrhh", "nombre_rrhh",
    "resultado_conciliacion", "fecha_entrega", "fecha_devolucion",
    "clasificacion_sin_rut", "departamento_unidad_propuesta"
  ], issues);
  const inventoryRows = parseSheet(workbook, "Inventario SQL", [
    "inventario_equipos_id", "inventario_equipos_valor_comercial",
    "inventario_equipo_encargado_entrega", "imei_normalizado", "imei_checksum_valido"
  ], issues);
  const context = await loadContext(issues), collaborators = collaboratorCandidates(currentRows, context, issues);
  const inventoryById = new Map(inventoryRows.map((row) => [txt(row.inventario_equipos_id), row]));
  const assetKeys = new Set<string>(), imeiCounts = new Map<string, number>(), serialCounts = new Map<string, number>();
  for (const row of currentRows) {
    const assetKey = txt(row.asset_key);
    if (!assetKey || assetKeys.has(assetKey)) issue(issues, "CRITICAL", "DUPLICATE_ASSET_KEY",
      "asset_key vacío o duplicado en la fuente.");
    assetKeys.add(assetKey);
    const inventory = inventoryById.get(txt(row.inventario_id));
    const imei = digits(inventory?.imei_normalizado) || digits(row.identificador_unico) || digits(row.imei_original);
    if (imei) imeiCounts.set(imei, (imeiCounts.get(imei) ?? 0) + 1);
    for (const serial of extractSerials(txt(row.descripcion_equipo))) {
      serialCounts.set(serial, (serialCounts.get(serial) ?? 0) + 1);
    }
  }
  const plans: Plan[] = [];
  for (const source of currentRows) {
    const assetKey = txt(source.asset_key), importKey = `${KEY_PREFIX}:${assetKey}`;
    const inventory = inventoryById.get(txt(source.inventario_id)) ?? null;
    const classification = classify(source), type = classification.type ? context.types.get(classification.type) ?? null : null;
    let identifierKind: Plan["identifierKind"] = "NONE", identifier: string | null = null;
    let reason = classification.reason, checksumValid: boolean | null = null;
    if (classification.type === "SMARTPHONE") {
      const imei = digits(inventory?.imei_normalizado) || digits(source.identificador_unico) || digits(source.imei_original);
      if (imei.length === 15 && imeiCounts.get(imei) === 1) {
        identifierKind = "IMEI"; identifier = imei;
        checksumValid = norm(inventory?.imei_checksum_valido) === "SI";
        if (!checksumValid) issue(issues, "WARNING", "IMEI_CHECKSUM_PENDING",
          "IMEI con checksum pendiente de validación.", assetKey);
      } else reason = imei.length !== 15 ? "Smartphone sin IMEI de 15 dígitos."
        : "IMEI repetido dentro de la fuente conciliada.";
    } else if (type) {
      const serials = extractSerials(txt(source.descripcion_equipo));
      if (serials.length === 1 && serialCounts.get(serials[0]!) === 1) {
        identifierKind = "SERIAL"; identifier = serials[0]!;
      } else reason = serials.length > 1 ? "La descripción contiene más de una serie."
        : serials.length === 1 ? "La serie se repite en la fuente conciliada."
          : "Número de serie pendiente; inventario_id es solo referencia histórica.";
    }
    let action: Action = "SKIP", existing = context.markers.get(importKey) ?? null;
    if (type && identifier) {
      const matches = identifierKind === "IMEI" ? context.byImei.get(identifier) ?? []
        : context.bySerial.get(identifier) ?? [];
      if (existing) action = "REUSE";
      else if (!matches.length) action = "NEW";
      else if (matches.length === 1 && norm(matches[0]!.typeName) === norm(type.name)) {
        existing = matches[0]!; action = "REUSE";
      } else {
        reason = matches.length > 1 ? "Identificador duplicado en ITAM."
          : "Identificador existente con tipo de activo incompatible.";
        issue(issues, "PENDING", "IDENTIFIER_CONFLICT", reason, assetKey);
      }
      if (existing && norm(existing.typeName) !== norm(type.name)) {
        action = "SKIP"; reason = "Clave previa asociada a un tipo incompatible.";
        issue(issues, "CRITICAL", "IMPORT_KEY_TYPE_CONFLICT", reason, assetKey);
      }
    }
    if (action === "SKIP") issue(issues, "PENDING", "ASSET_MANUAL_REVIEW",
      reason ?? "Activo no importable automáticamente.", assetKey);

    let custody: Custody = "NONE", collaborator: Collaborator | null = null;
    let departmentId: string | null = null;
    const labor = norm(source.estado_laboral_rrhh), reconciliation = norm(source.resultado_conciliacion);
    if (action !== "SKIP" && validRut(source.rut_normalizado) && norm(source.rut_valido) === "SI") {
      const candidate = collaborators.get(rutKey(source.rut_normalizado)) ?? null;
      if (candidate && labor === "VIGENTE" && reconciliation === "COINCIDENCIA VIGENTE") {
        if (candidate.existingId && candidate.existingActive === false) issue(issues, "PENDING",
          "INACTIVE_VIGENTE_CONFLICT", "Vigente RRHH está inactivo en ITAM; custodia omitida.", assetKey);
        else { custody = "VIGENTE"; collaborator = candidate; }
      } else if (candidate && labor === "EGRESADO" && reconciliation === "EQUIPO ASIGNADO A PERSONA EGRESADA") {
        custody = "EGRESADO"; collaborator = candidate;
      }
    } else if (action !== "SKIP" && norm(source.clasificacion_sin_rut) === "DEPARTAMENTO / GRUPO") {
      const matches = context.departments.get(norm(source.departamento_unidad_propuesta)) ?? [];
      if (matches.length === 1) { custody = "DEPARTMENT"; departmentId = matches[0]!.id; }
      else issue(issues, "PENDING", "AMBIGUOUS_DEPARTMENT",
        "Propuesta sin coincidencia exacta única en catálogo oficial.", assetKey);
    }
    const deliveryDate = isoDate(source.fecha_entrega), returnDate = isoDate(source.fecha_devolucion);
    if (returnDate) {
      custody = "NONE"; collaborator = null; departmentId = null;
      issue(issues, returnDate && deliveryDate && returnDate < deliveryDate ? "PENDING" : "WARNING",
        returnDate && deliveryDate && returnDate < deliveryDate ? "INVALID_DATE_ORDER" : "RETURNED_SOURCE_ROW",
        "Fila con devolución: no se establece custodia actual.", assetKey);
    }
    if (existing && custody !== "NONE") {
      const targetCollaborator = collaborator?.existingId ?? null;
      const terminal = ["DADO_BAJA", "EXTRAVIADO"].includes(existing.stateCode);
      const personalConflict = custody !== "DEPARTMENT" &&
        (Boolean(existing.departmentId) || Boolean(existing.collaboratorId && existing.collaboratorId !== targetCollaborator));
      const departmentConflict = custody === "DEPARTMENT" &&
        (Boolean(existing.collaboratorId) || Boolean(existing.departmentId && existing.departmentId !== departmentId));
      if (terminal || personalConflict || departmentConflict) {
        custody = "NONE"; collaborator = null; departmentId = null;
        issue(issues, "PENDING", "EXISTING_CUSTODY_CONFLICT",
          "El activo existente tiene estado terminal o una custodia distinta; no se sobrescribirá.", assetKey);
      }
    }
    plans.push({ source, inventory, assetKey, importKey, action, type, identifierKind,
      identifier, existing, custody, collaborator, departmentId, deliveryDate,
      historicalResponsible: txt(inventory?.inventario_equipo_encargado_entrega) || null,
      reason, checksumValid, sourceValue: money(inventory?.inventario_equipos_valor_comercial) });
  }
  return { sourcePath, currentRows, inventoryRows, plans, issues, context };
};

const estimatedCodes = (type: DeviceType, quantity: number, used: Set<number>): number[] => {
  const occupied = new Set(used), codes: number[] = []; let ordinal = type.ordinal;
  while (codes.length < quantity) {
    const code = formatInventoryCode(type.prefix, ++ordinal);
    if (!occupied.has(code)) { occupied.add(code); codes.push(code); }
  }
  return codes;
};

const report = (analysis: Analysis): Record<string, unknown> => {
  const { plans, context } = analysis, safe = plans.filter((plan) => plan.action !== "SKIP");
  const newPeople = new Map<string, Collaborator>(), reusedPeople = new Map<string, Collaborator>();
  for (const plan of safe) if (plan.collaborator) {
    (plan.collaborator.existingId ? reusedPeople : newPeople).set(plan.collaborator.rutKey, plan.collaborator);
  }
  const newByType: Record<string, number> = {};
  for (const plan of plans.filter((item) => item.action === "NEW")) {
    newByType[plan.type!.name] = (newByType[plan.type!.name] ?? 0) + 1;
  }
  const codeEstimate: Record<string, unknown> = {};
  for (const [name, quantity] of Object.entries(newByType)) {
    const type = context.types.get(norm(name))!, codes = estimatedCodes(type, quantity, context.usedCodes);
    codeEstimate[name] = { quantity, first: codes[0], last: codes.at(-1) };
  }
  const uniqueSim = safe.filter((plan) => {
    const phone = digits(plan.source.telefono_normalizado);
    return phone && (context.simsByPhone.get(phone) ?? []).length === 1;
  }).length;
  const issueCounts = analysis.issues.reduce<Record<string, number>>((acc, current) => {
    acc[current.code] = (acc[current.code] ?? 0) + 1; return acc;
  }, {});
  const skippedBySourceType = plans.filter((plan) => plan.action === "SKIP")
    .reduce<Record<string, number>>((acc, plan) => {
      const key = txt(plan.source.tipo_dispositivo) || "Sin tipo";
      acc[key] = (acc[key] ?? 0) + 1; return acc;
    }, {});
  const skippedByReason = plans.filter((plan) => plan.action === "SKIP")
    .reduce<Record<string, number>>((acc, plan) => {
      const key = plan.reason ?? "Revisión manual";
      acc[key] = (acc[key] ?? 0) + 1; return acc;
    }, {});
  return {
    mode: "DRY_RUN", database: context.database, source: analysis.sourcePath,
    sheetsUsed: ["Asignaciones actuales", "Inventario SQL"], totalProposedRows: plans.length,
    devices: { new: plans.filter((p) => p.action === "NEW").length,
      existingReused: plans.filter((p) => p.action === "REUSE").length,
      skippedManualReview: plans.filter((p) => p.action === "SKIP").length,
      skippedBySourceType, skippedByReason, newByType },
    collaborators: { new: newPeople.size, existing: reusedPeople.size },
    assignments: { vigente: safe.filter((p) => p.custody === "VIGENTE").length,
      egresado: safe.filter((p) => p.custody === "EGRESADO").length,
      departments: safe.filter((p) => p.custody === "DEPARTMENT").length,
      withoutCustody: safe.filter((p) => p.custody === "NONE").length },
    withoutCustodyReasons: {
      rutNotFound: safe.filter((p) => norm(p.source.resultado_conciliacion) === "RUT NO ENCONTRADO EN RRHH").length,
      personWithoutRut: safe.filter((p) => norm(p.source.clasificacion_sin_rut) === "PERSONA SIN RUT").length,
      ambiguousDepartment: safe.filter((p) => norm(p.source.clasificacion_sin_rut) === "DEPARTAMENTO / GRUPO" && p.custody === "NONE").length,
      unsupportedType: plans.filter((p) => p.action === "SKIP" && !p.type).length,
      insufficientIdentifier: plans.filter((p) => p.action === "SKIP" && p.type && !p.identifier).length },
    historicalActas: { correctlyRepresentable: 0,
      notRepresentableByCurrentSchema: safe.filter((p) => ["VIGENTE", "EGRESADO"].includes(p.custody)).length,
      restriction: "actas_entrega exige numero_acta y responsable_ti; no admite FIRMADA ni documento histórico no digitalizado. No se crearán actas." },
    duplicates: { avoided: plans.filter((p) => p.action === "REUSE").length,
      imeiConflicts: analysis.issues.filter((i) => i.code.includes("IMEI") && i.severity !== "WARNING").length,
      serialConflicts: analysis.issues.filter((i) => i.code === "IDENTIFIER_CONFLICT" && i.assetKey?.startsWith("INV-")).length },
    sim: { uniquePhoneMatches: uniqueSim, notMatchedOrAmbiguous: safe.length - uniqueSim,
      note: "No se crean SIM ni se modifica ICCID; teléfono es evidencia secundaria." },
    estimatedInventoryCodes: codeEstimate, before: context.before,
    cases: { critical: analysis.issues.filter((i) => i.severity === "CRITICAL").length,
      pending: analysis.issues.filter((i) => i.severity === "PENDING").length,
      warnings: analysis.issues.filter((i) => i.severity === "WARNING").length },
    issueBreakdown: Object.entries(issueCounts).sort((a, b) => b[1] - a[1]),
    writesPerformed: false, sequencesConsumed: false, actasCreated: false
  };
};

const deviceHistory = async (
  client: PoolClient, deviceId: string, event: string, previous: string | null,
  next: string | null, detail: Record<string, unknown>, date: string | null
): Promise<boolean> => {
  const key = String(detail.importKey ?? "");
  const exists = await client.query(
    `SELECT 1 FROM itam.historial_eventos WHERE dispositivo_id=$1
     AND detalle->>'importKey'=$2 LIMIT 1`, [deviceId, key]
  );
  if (exists.rowCount) return false;
  await client.query(`INSERT INTO itam.historial_eventos(
      tipo_entidad,dispositivo_id,sim_id,tipo_evento,estado_anterior_id,estado_nuevo_id,
      responsable,observaciones,detalle,fecha_evento,usuario_ejecutor_id)
    VALUES('DISPOSITIVO',$1,NULL,$2,$3,$4,$5,$6,$7::jsonb,
      COALESCE($8::date + TIME '12:00',NOW()),NULL)`, [
    deviceId, event, previous, next, IMPORTER, `Origen: ${SOURCE_LABEL}.`,
    JSON.stringify(detail), date
  ]);
  return true;
};

const simHistory = async (
  client: PoolClient, simId: string, previous: string, next: string,
  detail: Record<string, unknown>
): Promise<boolean> => {
  const key = String(detail.importKey ?? "");
  const exists = await client.query(
    `SELECT 1 FROM itam.historial_eventos WHERE sim_id=$1
     AND detalle->>'importKey'=$2 LIMIT 1`, [simId, key]
  );
  if (exists.rowCount) return false;
  await client.query(`INSERT INTO itam.historial_eventos(
      tipo_entidad,dispositivo_id,sim_id,tipo_evento,estado_anterior_id,estado_nuevo_id,
      responsable,observaciones,detalle,usuario_ejecutor_id)
    VALUES('SIM',NULL,$1,'ASOCIAR_DISPOSITIVO',$2,$3,$4,$5,$6::jsonb,NULL)`, [
    simId, previous, next, IMPORTER, `Origen: ${SOURCE_LABEL}.`, JSON.stringify(detail)
  ]);
  return true;
};

const createOrReuseCollaborator = async (
  client: PoolClient, candidate: Collaborator
): Promise<{ id: string; created: boolean }> => {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [`colaborador-rut:${candidate.rutKey}`]
  );
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM itam.colaboradores
     WHERE UPPER(REGEXP_REPLACE(BTRIM(rut),'[^0-9Kk]','','g'))=$1
     ORDER BY id LIMIT 1`, [candidate.rutKey]
  );
  if (existing.rows[0]) return { id: existing.rows[0].id, created: false };
  const inserted = await client.query<{ id: string }>(`INSERT INTO itam.colaboradores(
      rut,nombre,cargo,departamento_id,localidad,activo,observaciones)
    VALUES($1,$2,$3,NULL,$4,$5,$6) RETURNING id`, [
    candidate.rut, candidate.name, candidate.cargo, candidate.locality, candidate.active,
    `${SOURCE_LABEL}. ${candidate.active ? "Colaborador vigente conciliado." :
      "Colaborador egresado; pendiente de validación/recuperación mediante Offboarding."}`
  ]);
  return { id: inserted.rows[0]!.id, created: true };
};

const findDeviceByMarker = async (client: PoolClient, importKey: string): Promise<Device | null> => {
  const found = await client.query<{
    id: string; code: number; type_name: string; imei: string | null; serial: string | null;
    collaborator_id: string | null; department_id: string | null; state_id: string; state_code: string;
  }>(`SELECT d.id,d.codigo_inventario code,t.nombre type_name,d.imei,d.numero_serie serial,
      d.colaborador_id,d.departamento_id,d.estado_id state_id,e.codigo state_code
    FROM itam.historial_eventos h JOIN itam.dispositivos d ON d.id=h.dispositivo_id
    JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id
    JOIN itam.estados e ON e.id=d.estado_id WHERE h.detalle->>'importKey'=$1 LIMIT 1`, [importKey]);
  return found.rows[0] ? mapDevice(found.rows[0]) : null;
};

const createDevice = async (
  client: PoolClient, plan: Plan, initialState: string
): Promise<Device> => {
  const physicalColumn = plan.identifierKind === "IMEI" ? "imei" : "numero_serie";
  const collision = await client.query(
    `SELECT 1 FROM itam.dispositivos WHERE UPPER(BTRIM(${physicalColumn}))=UPPER(BTRIM($1)) LIMIT 1`,
    [plan.identifier]
  );
  if (collision.rowCount) throw new Error(
    `Colisión concurrente de identificador físico para ${plan.assetKey}; transacción revertida.`
  );
  const code = await generateInventoryCodeByFamilyId(plan.type!.familyId, "DISPOSITIVO", client);
  const description = txt(plan.source.descripcion_equipo);
  const brand = ["SAMSUNG", "MOTOROLA", "APPLE", "HP", "LENOVO", "DELL", "ACER", "ASUS", "AOC", "HUAWEI"]
    .find((candidate) => norm(description).includes(candidate)) ?? null;
  const notes = [SOURCE_LABEL, `Referencia histórica: ${plan.assetKey}.`,
    description ? `Descripción fuente: ${description}.` : null,
    plan.identifierKind === "SERIAL" ? null : "Número de serie pendiente de validación.",
    plan.checksumValid === false ? "IMEI pendiente de validación de checksum." : null,
    plan.custody === "NONE" ? "Custodia pendiente de validación manual." : null
  ].filter((value): value is string => Boolean(value)).join(" ");
  const inserted = await client.query<{ id: string }>(`INSERT INTO itam.dispositivos(
      codigo_inventario,tipo_dispositivo_id,marca,modelo,numero_serie,imei,estado_id,
      localidad,ubicacion_detalle,observaciones,atributos_especificos,valor_comercial,fecha_registro)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,'{}'::jsonb,$10,CURRENT_DATE) RETURNING id`, [
    code, plan.type!.id, brand,
    norm(plan.type!.name) === "SMARTPHONE" ? description.slice(0, 150) || null : null,
    plan.identifierKind === "SERIAL" ? plan.identifier : null,
    plan.identifierKind === "IMEI" ? plan.identifier : null,
    initialState, txt(plan.source.localidad_inventario) || null, notes, plan.sourceValue ?? 0
  ]);
  return { id: inserted.rows[0]!.id, code, typeName: plan.type!.name,
    imei: plan.identifierKind === "IMEI" ? plan.identifier : null,
    serial: plan.identifierKind === "SERIAL" ? plan.identifier : null,
    collaboratorId: null, departmentId: null, stateId: initialState,
    stateCode: plan.custody === "NONE" ? "RETENIDO_REVISION" : "DISPONIBLE" };
};

const importPlans = async (analysis: Analysis): Promise<ImportResult> => {
  const critical = analysis.issues.filter((current) => current.severity === "CRITICAL");
  if (critical.length) throw new Error(`Importación bloqueada por ${critical.length} casos críticos.`);
  const result: ImportResult = { collaboratorsCreated: 0, collaboratorsReused: 0,
    devicesCreated: {}, devicesReused: 0, assignmentsVigentes: 0, assignmentsEgresados: 0,
    departmentCustodies: 0, simAssociated: 0, historyCreated: 0, generatedCodes: {} };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const collaboratorIds = new Map<string, string>(), candidates = new Map<string, Collaborator>();
    for (const plan of analysis.plans.filter((item) => item.action !== "SKIP")) {
      if (plan.collaborator) candidates.set(plan.collaborator.rutKey, plan.collaborator);
    }
    for (const candidate of candidates.values()) {
      const resolved = await createOrReuseCollaborator(client, candidate);
      collaboratorIds.set(candidate.rutKey, resolved.id);
      if (resolved.created) result.collaboratorsCreated += 1; else result.collaboratorsReused += 1;
    }
    const available = analysis.context.states.get("DISPOSITIVO:DISPONIBLE")!;
    const assigned = analysis.context.states.get("DISPOSITIVO:ASIGNADO")!;
    const review = analysis.context.states.get("DISPOSITIVO:RETENIDO_REVISION")!;
    const simAssigned = analysis.context.states.get("SIM:ASIGNADA")!;

    for (const plan of analysis.plans.filter((item) => item.action !== "SKIP")) {
      let device = plan.existing ?? await findDeviceByMarker(client, plan.importKey);
      if (!device) {
        device = await createDevice(client, plan, plan.custody === "NONE" ? review : available);
        result.devicesCreated[plan.type!.name] = (result.devicesCreated[plan.type!.name] ?? 0) + 1;
        (result.generatedCodes[plan.type!.name] ??= []).push(device.code);
        if (await deviceHistory(client, device.id, "IMPORTAR_DISPOSITIVO", null, device.stateId, {
          importKey: plan.importKey, source: SOURCE_LABEL, sourceAssetKey: plan.assetKey,
          sourceInventoryId: txt(plan.source.inventario_id), generatedInventoryCode: device.code,
          physicalIdentifierKind: plan.identifierKind
        }, null)) result.historyCreated += 1;
      } else {
        result.devicesReused += 1;
        if (await deviceHistory(client, device.id, "CONCILIAR_DISPOSITIVO_EXISTENTE",
          device.stateId, device.stateId, { importKey: plan.importKey, source: SOURCE_LABEL,
            sourceAssetKey: plan.assetKey, sourceInventoryId: txt(plan.source.inventario_id),
            existingInventoryCode: device.code, physicalIdentifierKind: plan.identifierKind }, null)) {
          result.historyCreated += 1;
        }
      }

      const targetCollaborator = plan.custody === "VIGENTE" && plan.collaborator
        ? collaboratorIds.get(plan.collaborator.rutKey) ?? null : null;
      const historicalCollaborator = plan.custody === "EGRESADO" && plan.collaborator
        ? collaboratorIds.get(plan.collaborator.rutKey) ?? null : null;
      const targetDepartment = plan.custody === "DEPARTMENT" ? plan.departmentId : null;
      const sameCustody = targetCollaborator ? device.collaboratorId === targetCollaborator && !device.departmentId
        : targetDepartment ? device.departmentId === targetDepartment && !device.collaboratorId : false;
      const custodyFree = !device.collaboratorId && !device.departmentId;
      const terminal = ["DADO_BAJA", "EXTRAVIADO"].includes(device.stateCode);
      if (historicalCollaborator) {
        const detail = {
          importKey: `${plan.importKey}:HISTORICAL_CUSTODY`, source: SOURCE_LABEL,
          sourceAssetKey: plan.assetKey, custodyKind: "EGRESADO",
          collaboratorId: historicalCollaborator,
          historicalDeliveryDate: plan.deliveryDate,
          note: "Custodia historica importada sin crear una asignacion vigente a un colaborador inactivo."
        };
        if (await deviceHistory(client, device.id, "IMPORTAR_CUSTODIA_HISTORICA",
          device.stateId, device.stateId, detail, plan.deliveryDate)) result.historyCreated += 1;
        if (await deviceHistory(client, device.id, "CIERRE_CUSTODIA_CONCILIACION",
          device.stateId, device.stateId, { ...detail,
            importKey: `${plan.importKey}:HISTORICAL_CUSTODY:CLOSE`,
            motivo: "COLABORADOR_EGRESADO"
          }, null)) result.historyCreated += 1;
        result.assignmentsEgresados += 1;
      }
      if ((targetCollaborator || targetDepartment) && !terminal && (sameCustody || custodyFree)) {
        if (custodyFree) await client.query(`UPDATE itam.dispositivos SET colaborador_id=$2,
            departamento_id=$3,recibido_por_id=NULL,estado_id=$4 WHERE id=$1`,
          [device.id, targetCollaborator, targetDepartment, assigned]);
        const event = sameCustody ? "IMPORTAR_CUSTODIA_HISTORICA"
          : targetCollaborator ? "ASIGNAR_COLABORADOR" : "ASIGNAR_DEPARTAMENTO";
        if (await deviceHistory(client, device.id, event, device.stateId,
          custodyFree ? assigned : device.stateId, {
            importKey: `${plan.importKey}:CUSTODY`, source: SOURCE_LABEL,
            sourceAssetKey: plan.assetKey, custodyKind: plan.custody,
            collaboratorId: targetCollaborator, departmentId: targetDepartment,
            historicalDeliveryDate: plan.deliveryDate,
            historicalResponsible: plan.historicalResponsible,
            historicalActaDeclaredSigned: Boolean(targetCollaborator),
            digitalDocumentAvailable: false,
            note: plan.custody === "EGRESADO"
              ? "Asignación histórica importada. Colaborador figura como EGRESADO en RRHH. Pendiente de validación/recuperación mediante Offboarding."
              : "Acta de Entrega preexistente declarada como firmada según inventario conciliado. Documento histórico no digitalizado durante la importación."
          }, plan.deliveryDate)) result.historyCreated += 1;
        if (plan.custody === "VIGENTE") result.assignmentsVigentes += 1;
        else result.departmentCustodies += 1;
      }

      const phone = digits(plan.source.telefono_normalizado);
      const sims = phone ? analysis.context.simsByPhone.get(phone) ?? [] : [];
      if (sims.length === 1 && norm(plan.type!.name) === "SMARTPHONE") {
        const sim = sims[0]!, collaboratorCompatible = !sim.collaboratorId || !targetCollaborator
          || sim.collaboratorId === targetCollaborator;
        const stateCompatible = !["DADA_BAJA", "EXTRAVIADA"].includes(sim.stateCode);
        if (collaboratorCompatible && stateCompatible && (!sim.deviceId || sim.deviceId === device.id)) {
          if (!sim.deviceId) await client.query(
            "UPDATE itam.sim SET dispositivo_id=$2,estado_id=$3 WHERE id=$1", [sim.id, device.id, simAssigned]
          );
          if (await simHistory(client, sim.id, sim.stateId, sim.deviceId ? sim.stateId : simAssigned, {
            importKey: `${plan.importKey}:SIM:${sim.id}`, source: SOURCE_LABEL,
            deviceId: device.id, deviceInventoryCode: device.code,
            evidence: "Coincidencia única exacta por número; ICCID no modificado."
          })) result.historyCreated += 1;
          result.simAssociated += 1;
        }
      }
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK"); throw error;
  } finally { client.release(); }
};

const databaseCounts = async (): Promise<Counts> => {
  const result = await pool.query<Record<keyof Counts, string>>(`SELECT
    (SELECT COUNT(*) FROM itam.dispositivos) devices,
    (SELECT COUNT(*) FROM itam.colaboradores) collaborators,
    (SELECT COUNT(*) FROM itam.dispositivos WHERE colaborador_id IS NOT NULL) "personalCustodies",
    (SELECT COUNT(*) FROM itam.dispositivos WHERE departamento_id IS NOT NULL) "departmentCustodies",
    (SELECT COUNT(*) FROM itam.dispositivos WHERE colaborador_id IS NULL AND departamento_id IS NULL) "unassignedDevices",
    (SELECT COUNT(*) FROM itam.historial_eventos) history,
    (SELECT COUNT(*) FROM itam.actas_entrega) actas`);
  const c = result.rows[0]!;
  return { devices: Number(c.devices), collaborators: Number(c.collaborators),
    personalCustodies: Number(c.personalCustodies), departmentCustodies: Number(c.departmentCustodies),
    unassignedDevices: Number(c.unassignedDevices), history: Number(c.history), actas: Number(c.actas) };
};

const main = async (): Promise<void> => {
  const dryRun = process.argv.includes("--dry-run");
  const explicit = process.argv.find((argument) => argument.toLowerCase().endsWith(".xlsx"));
  const sourcePath = path.resolve(explicit ?? path.resolve(__dirname, `../../../${SOURCE_FILE}`));
  const analysis = await analyze(sourcePath);
  console.log(JSON.stringify(report(analysis), null, 2));
  if (dryRun) {
    if (analysis.issues.some((current) => current.severity === "CRITICAL")) process.exitCode = 2;
    return;
  }
  const result = await importPlans(analysis);
  console.log(JSON.stringify({ mode: "IMPORT_COMMITTED", result,
    before: analysis.context.before, after: await databaseCounts() }, null, 2));
};

void main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : "Importación fallida.",
    writesCommitted: false }));
  process.exitCode = 1;
}).finally(async () => { await pool.end().catch(() => undefined); });
