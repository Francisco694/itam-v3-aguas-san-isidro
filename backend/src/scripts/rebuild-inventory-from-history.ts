import "dotenv/config";
import path from "node:path";
import readExcelFile from "read-excel-file/node";
import type { PoolClient } from "pg";
import { pool } from "../config/database";
import {
  generateInventoryCode,
  generateInventoryCodeByFamilyId
} from "../modules/inventory-codes/inventory-code.service";
import { isValidRut, normalizeRut } from "../shared/rut";

const TARGET_DATABASE = "itam_rebuild";
const SOURCE_NAME = "conciliacion_rrhh_inventario_sql.xlsx";
const SOURCE_PATH = path.resolve(__dirname, "../../../", SOURCE_NAME);
const OPERATIONAL_SOURCE_NAME = "Inventario.xlsx";
const OPERATIONAL_SOURCE_PATH = path.resolve(__dirname, "../../../", OPERATIONAL_SOURCE_NAME);
const SHEET = "Inventario SQL";
const KEY_PREFIX = "REBUILD_HISTORY_V1";
const APPLY = process.argv.includes("--apply");
const DRY_RUN = process.argv.includes("--dry-run");

type Cell = string | number | boolean | Date | null;
type SourceRow = Record<string, Cell> & { __row: number };
type SheetData = { sheet: string; data: Cell[][] };
type EvidenceState =
  | "VIGENTE_CONFIRMADA" | "HISTORICA_CONFIRMADA" | "PROBABLE_VIGENTE"
  | "PROBABLE_HISTORICA" | "PENDIENTE_IDENTIFICAR_ACTIVO"
  | "CONFLICTO_IMEI" | "CONFLICTO_SERIE" | "CONFLICTO_RUT"
  | "CONFLICTO_IDENTIDAD" | "REQUIERE_VALIDACION_FISICA";

export interface EvidencePlan {
  key: string;
  row: SourceRow;
  rutOriginal: string | null;
  rutCanonical: string | null;
  collaboratorId: string | null;
  typeName: string | null;
  description: string | null;
  identityKind: "IMEI" | "SERIAL" | "NONE";
  identity: string | null;
  deliveryDate: string | null;
  returnDate: string | null;
  state: EvidenceState;
  reason: string | null;
  confidence: "ALTA" | "MEDIA" | "BAJA";
  deviceKey: string | null;
  isCurrent: boolean;
}


interface OperationalRows {
  sims: SourceRow[];
  phones: SourceRow[];
  printers: SourceRow[];
}

interface OperationalResult {
  simsDetected: number;
  simsWithIccid: number;
  simsWithoutIccid: number;
  simsCreated: number;
  associationsCreated: number;
  ambiguousLegacyIds: string[];
  printersPending: Array<{ referenceCode: number; state: "PENDIENTE_VALIDACION" }>;
}
interface DeviceGroup {
  key: string;
  typeName: string;
  identityKind: "IMEI" | "SERIAL";
  identity: string;
  rows: EvidencePlan[];
  current: EvidencePlan | null;
  conflict: string | null;
}

const text = (value: Cell | undefined): string =>
  value == null ? "" : value instanceof Date ? value.toISOString() : String(value).trim();
const normalized = (value: Cell | undefined): string => text(value)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  .replace(/\s+/g, " ").trim();
const digits = (value: Cell | undefined): string => text(value).replace(/\D/g, "");
const dateOnly = (value: Cell | undefined): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value); if (!raw) return null;
  const parsed = new Date(raw); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};
const money = (value: Cell | undefined): number => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = text(value).replace(/[$\s.]/g, "").replace(",", ".");
  const parsed = Number(raw); return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};

export const isValidImei = (value: string): boolean => {
  if (!/^\d{15}$/.test(value) || /^0+$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < 15; index += 1) {
    let digit = Number(value[index]);
    if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
};

const extractSerial = (description: string): string | null => {
  const match = description.match(/(?:S\/N|\bSN\b|SERIAL|NUMERO\s+DE\s+SERIE|NRO\.?\s*SERIE)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{4,})/iu);
  return match?.[1]?.toUpperCase() ?? null;
};

const classify = (row: SourceRow): string | null => {
  const interpreted = normalized(row.tipo_interpretado);
  if (["SMARTPHONE", "NOTEBOOK", "PC", "MONITOR", "IMPRESORA", "PERIFERICO"].includes(interpreted)) return interpreted;
  const description = normalized(row.inventario_equipos_descripcion_equipos);
  if (/SMARTPHONE|TELEFONO|CELULAR|IPHONE|MOTOROLA|SAMSUNG/.test(description)) return "SMARTPHONE";
  if (/IMPRESORA|MULTIFUNCIONAL/.test(description)) return "IMPRESORA";
  if (/NOTEBOOK|LAPTOP|PORTATIL/.test(description)) return "NOTEBOOK";
  if (/MONITOR|PANTALLA/.test(description)) return "MONITOR";
  if (/COMPUTADOR|DESKTOP|EQUIPO PC|ALL IN ONE/.test(description)) return "PC";
  return null;
};

const sensitivePattern = /(?:password|contrasena|contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a|clave|secret|token|api[_ -]?key)\s*[:=]\s*\S+/giu;
const redact = (row: SourceRow): { data: Record<string, unknown>; count: number } => {
  let count = 0;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "__row") continue;
    if (typeof value === "string" && sensitivePattern.test(value)) {
      data[key] = "[DATO SENSIBLE HISTORICO REDACTADO]";
      count += 1;
      sensitivePattern.lastIndex = 0;
    } else data[key] = value instanceof Date ? value.toISOString() : value;
  }
  return { data, count };
};

const loadRows = async (): Promise<SourceRow[]> => {
  const workbook = await readExcelFile(SOURCE_PATH) as unknown as SheetData[];
  const sheet = workbook.find((candidate) => candidate.sheet === SHEET);
  if (!sheet) throw new Error(`No existe la hoja ${SHEET}.`);
  const headers = (sheet.data[0] ?? []).map(text);
  const required = ["inventario_equipos_id", "rut_normalizado", "imei_normalizado",
    "inventario_equipos_descripcion_equipos", "inventario_equipos_fecha_entrega_funcionario",
    "inventario_equipos_fecha_devolucion_empresa"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Faltan encabezados: ${missing.join(", ")}.`);
  return sheet.data.slice(1).map((cells, index) => {
    const row: SourceRow = { __row: index + 2 };
    headers.forEach((header, column) => { if (header) row[header] = cells[column] ?? null; });
    return row;
  }).filter((row) => headers.some((header) => header && text(row[header])));
};

const planEvidence = async (client: PoolClient, rows: SourceRow[]): Promise<EvidencePlan[]> => {
  const collaborators = await client.query<{ id: string; rut: string }>("SELECT id,rut FROM itam.colaboradores");
  const collaboratorByRut = new Map(collaborators.rows.map((row) => [normalizeRut(row.rut), row.id]));
  const plans: EvidencePlan[] = [];
  for (const row of rows) {
    const rutOriginal = text(row.inventario_equipos_rut_funcionario) || text(row.rut_normalizado) || null;
    const rutCanonical = rutOriginal ? normalizeRut(rutOriginal) : null;
    const rutValid = Boolean(rutCanonical && isValidRut(rutCanonical));
    const collaboratorId = rutValid ? collaboratorByRut.get(rutCanonical!) ?? null : null;
    const typeName = classify(row);
    const description = text(row.inventario_equipos_descripcion_equipos) || null;
    const rawImei = digits(row.imei_normalizado) || digits(row.inventario_equipos_imai_celular);
    const imei = isValidImei(rawImei) ? rawImei : null;
    const serial = typeName !== "SMARTPHONE" && description ? extractSerial(description) : null;
    const identityKind = imei ? "IMEI" : serial ? "SERIAL" : "NONE";
    const identity = imei ?? serial;
    const deliveryDate = dateOnly(row.inventario_equipos_fecha_entrega_funcionario);
    const returnDate = dateOnly(row.inventario_equipos_fecha_devolucion_empresa);
    let state: EvidenceState = returnDate ? "HISTORICA_CONFIRMADA" : "PROBABLE_VIGENTE";
    let reason: string | null = null;
    let confidence: EvidencePlan["confidence"] = returnDate ? "ALTA" : "MEDIA";
    if (!rutValid && rutOriginal) { state = "CONFLICTO_RUT"; reason = "RUT ausente o invalido."; confidence = "BAJA"; }
    else if (rutValid && !collaboratorId) { state = "CONFLICTO_IDENTIDAD"; reason = "RUT valido sin colaborador maestro."; confidence = "BAJA"; }
    if (!identity) { state = "PENDIENTE_IDENTIFICAR_ACTIVO"; reason = typeName === "SMARTPHONE" ? "IMEI vacio, cero o invalido." : "Serie fisica no identificable."; confidence = "BAJA"; }
    if (!typeName) { state = "REQUIERE_VALIDACION_FISICA"; reason = "Tipo de activo no determinable."; confidence = "BAJA"; }
    const deviceKey = typeName && identity ? `${identityKind}:${identity}` : null;
    plans.push({ key: `${KEY_PREFIX}:${SHEET}:${row.__row}:1`, row, rutOriginal, rutCanonical,
      collaboratorId, typeName, description, identityKind, identity, deliveryDate, returnDate,
      state, reason, confidence, deviceKey, isCurrent: false });
  }
  return plans;
};

export const resolveGroups = (plans: EvidencePlan[]): DeviceGroup[] => {
  const grouped = new Map<string, EvidencePlan[]>();
  for (const plan of plans) if (plan.deviceKey) grouped.set(plan.deviceKey, [...(grouped.get(plan.deviceKey) ?? []), plan]);
  const groups: DeviceGroup[] = [];
  for (const [key, rows] of grouped) {
    const typeNames = new Set(rows.map((row) => row.typeName!));
    const validCurrent = rows.filter((row) => !row.returnDate && row.collaboratorId)
      .sort((left, right) => (right.deliveryDate ?? "").localeCompare(left.deliveryDate ?? ""));
    let current: EvidencePlan | null = validCurrent[0] ?? null;
    let conflict: string | null = null;
    if (typeNames.size > 1) { conflict = "Un identificador aparece con tipos de activo distintos."; current = null; }
    if (current) {
      const sameDate = validCurrent.filter((row) => row.deliveryDate === current!.deliveryDate);
      if (new Set(sameDate.map((row) => row.collaboratorId)).size > 1) {
        conflict = "El identificador tiene custodios distintos en la fecha mas reciente.";
        current = null;
      }
    }
    for (const row of rows) {
      row.isCurrent = row === current;
      if (conflict) { row.state = row.identityKind === "IMEI" ? "CONFLICTO_IMEI" : "CONFLICTO_SERIE"; row.reason = conflict; row.confidence = "BAJA"; }
      else if (row === current) row.state = "PROBABLE_VIGENTE";
      else if (!row.returnDate) row.state = "PROBABLE_HISTORICA";
    }
    groups.push({ key, typeName: rows[0]!.typeName!, identityKind: rows[0]!.identityKind as "IMEI" | "SERIAL",
      identity: rows[0]!.identity!, rows, current, conflict });
  }
  const currentSmartphones = new Map<string, DeviceGroup[]>();
  for (const group of groups) {
    if (group.typeName !== "SMARTPHONE" || !group.current?.collaboratorId || group.conflict) continue;
    const key = group.current.collaboratorId;
    currentSmartphones.set(key, [...(currentSmartphones.get(key) ?? []), group]);
  }
  for (const candidateGroups of currentSmartphones.values()) {
    candidateGroups.sort((left, right) =>
      (right.current?.deliveryDate ?? "").localeCompare(left.current?.deliveryDate ?? "")
    );
    const newestDate = candidateGroups[0]?.current?.deliveryDate ?? null;
    const newest = candidateGroups.filter((group) => group.current?.deliveryDate === newestDate);
    if (newest.length > 1) {
      for (const group of newest) {
        group.conflict = "Existen varios smartphones con la misma fecha mas reciente para un colaborador.";
        if (group.current) {
          group.current.state = "CONFLICTO_IMEI";
          group.current.reason = group.conflict;
          group.current.confidence = "BAJA";
          group.current.isCurrent = false;
        }
        group.current = null;
      }
    }
    for (const group of candidateGroups.filter((group) => !newest.includes(group))) {
      if (group.current) {
        group.current.state = "PROBABLE_HISTORICA";
        group.current.reason = "Existe un smartphone posterior para el mismo colaborador.";
        group.current.isCurrent = false;
      }
      group.current = null;
    }
  }
  return groups;
};

const upsertCase = async (client: PoolClient, plan: EvidencePlan, evidenceId: string): Promise<void> => {
  if (!["PENDIENTE_IDENTIFICAR_ACTIVO", "CONFLICTO_IMEI", "CONFLICTO_SERIE", "CONFLICTO_RUT", "CONFLICTO_IDENTIDAD", "REQUIERE_VALIDACION_FISICA"].includes(plan.state)) return;
  const result = await client.query<{ id: string }>(
    `INSERT INTO itam.casos_conciliacion_inventario(
       clave_caso,tipo_conflicto,imei,serie,colaborador_id,estado,prioridad,descripcion,evidencia
     ) VALUES($1,$2,$3,$4,$5,'PENDIENTE',$6,$7,$8::JSONB)
     ON CONFLICT(clave_caso) DO UPDATE SET descripcion=EXCLUDED.descripcion,evidencia=EXCLUDED.evidencia
     RETURNING id`,
    [`${plan.key}:CASE`,plan.state,plan.identityKind === "IMEI" ? plan.identity : null,
     plan.identityKind === "SERIAL" ? plan.identity : null,plan.collaboratorId,
     plan.state.startsWith("CONFLICTO") ? "ALTA" : "MEDIA",plan.reason ?? "Requiere revision.",
     JSON.stringify({ fuente: SOURCE_NAME, hoja: SHEET, fila: plan.row.__row })]
  );
  await client.query(
    `INSERT INTO itam.casos_conciliacion_evidencias(caso_id,evidencia_id)
     VALUES($1,$2) ON CONFLICT DO NOTHING`, [result.rows[0]!.id,evidenceId]
  );
};

const insertEvidence = async (client: PoolClient, plan: EvidencePlan): Promise<{ id: string; redacted: number }> => {
  const redaction = redact(plan.row);
  const result = await client.query<{ id: string }>(
    `INSERT INTO itam.evidencias_inventario_historico(
       clave_origen,fuente,hoja,fila_origen,indice_activo,rut_original,rut_canonico,
       colaborador_id,nombre_original,tipo_activo,descripcion_original,imei_original,
       imei_normalizado,serie_original,serie_normalizada,telefono_original,fecha_entrega,
       fecha_cierre_fuente,estado_conciliacion,motivo_conflicto,nivel_confianza,datos_origen
     ) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::JSONB)
     ON CONFLICT(clave_origen) DO UPDATE SET
       colaborador_id=EXCLUDED.colaborador_id,estado_conciliacion=EXCLUDED.estado_conciliacion,
       motivo_conflicto=EXCLUDED.motivo_conflicto,nivel_confianza=EXCLUDED.nivel_confianza,
       datos_origen=EXCLUDED.datos_origen,actualizado_en=NOW()
     RETURNING id`,
    [plan.key,SOURCE_NAME,SHEET,plan.row.__row,plan.rutOriginal,plan.rutCanonical,
     plan.collaboratorId,text(plan.row.inventario_equipos_nombre_funcionario) || null,
     plan.typeName,plan.description,text(plan.row.inventario_equipos_imai_celular) || null,
     plan.identityKind === "IMEI" ? plan.identity : null,
     plan.identityKind === "SERIAL" ? plan.identity : null,
     plan.identityKind === "SERIAL" ? plan.identity : null,
     text(plan.row.inventario_equipos_numero_telefono) || null,plan.deliveryDate,plan.returnDate,
     plan.state,plan.reason,plan.confidence,JSON.stringify(redaction.data)]
  );
  await upsertCase(client, plan, result.rows[0]!.id);
  return { id: result.rows[0]!.id, redacted: redaction.count };
};

const resolveTypeAndState = async (client: PoolClient, typeName: string) => {
  const result = await client.query<{ type_id: string; family_id: string; pending_id: string; assigned_id: string }>(
    `SELECT tipo.id type_id,tipo.familia_codigo_inventario_id family_id,
       pendiente.id pending_id,asignado.id assigned_id
     FROM itam.tipos_dispositivo tipo
     JOIN itam.estados pendiente ON pendiente.tipo_entidad='DISPOSITIVO' AND pendiente.codigo='PENDIENTE_VALIDACION'
     JOIN itam.estados asignado ON asignado.tipo_entidad='DISPOSITIVO' AND asignado.codigo='ASIGNADO'
     WHERE UPPER(tipo.nombre)=UPPER($1) AND tipo.activo=TRUE`, [typeName]
  );
  if (!result.rows[0]?.family_id) throw new Error(`Tipo ${typeName} sin familia activa.`);
  return result.rows[0];
};

const findOrCreateDevice = async (client: PoolClient, group: DeviceGroup): Promise<string> => {
  const field = group.identityKind === "IMEI" ? "imei" : "numero_serie";
  const existing = await client.query<{ id: string }>(`SELECT id FROM itam.dispositivos WHERE ${field}=$1`, [group.identity]);
  if (existing.rows[0]) return existing.rows[0].id;
  const catalog = await resolveTypeAndState(client, group.typeName);
  const code = await generateInventoryCodeByFamilyId(catalog.family_id, "DISPOSITIVO", client);
  const representative = [...group.rows].sort((a,b)=>(b.deliveryDate ?? "").localeCompare(a.deliveryDate ?? ""))[0]!;
  const result = await client.query<{ id: string }>(
    `INSERT INTO itam.dispositivos(
       codigo_inventario,tipo_dispositivo_id,numero_serie,imei,localidad,observaciones,
       valor_comercial,estado_id
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [code,catalog.type_id,group.identityKind === "SERIAL" ? group.identity : null,
     group.identityKind === "IMEI" ? group.identity : null,
     text(representative.row.inventario_equipos_localidad) || null,
     "Reconstruido desde evidencia historica; requiere validacion fisica.",
     money(representative.row.inventario_equipos_valor_comercial),
     group.current && !group.conflict ? catalog.assigned_id : catalog.pending_id]
  );
  return result.rows[0]!.id;
};

const linkGroup = async (client: PoolClient, group: DeviceGroup, evidenceIds: Map<string,string>): Promise<void> => {
  const deviceId = await findOrCreateDevice(client, group);
  for (const plan of group.rows) {
    await client.query(
      `UPDATE itam.evidencias_inventario_historico SET dispositivo_id=$2 WHERE clave_origen=$1`,
      [plan.key,deviceId]
    );
    const reference = `${plan.key}:CUSTODY`;
    if (!plan.collaboratorId) continue;
    if (plan === group.current && !group.conflict) {
      await client.query(
        `INSERT INTO itam.custodias_dispositivo(
           dispositivo_id,colaborador_id,fecha_inicio,vigente,tipo_inicio,origen,
           referencia_origen,evidencia,nivel_confianza
         ) SELECT $1,$2,$3,TRUE,'RECONSTRUCCION_HISTORICA',$4,$5,$6::JSONB,$7
         WHERE NOT EXISTS(SELECT 1 FROM itam.custodias_dispositivo WHERE referencia_origen=$5)`,
        [deviceId,plan.collaboratorId,plan.deliveryDate,SOURCE_NAME,reference,
         JSON.stringify({ evidenciaId: evidenceIds.get(plan.key), fila: plan.row.__row }),plan.confidence]
      );
      await client.query(
        `UPDATE itam.dispositivos SET colaborador_id=$2,departamento_id=NULL,recibido_por_id=NULL,
           estado_id=(SELECT id FROM itam.estados WHERE tipo_entidad='DISPOSITIVO' AND codigo='ASIGNADO')
         WHERE id=$1`, [deviceId,plan.collaboratorId]
      );
    } else {
      await client.query(
        `INSERT INTO itam.custodias_dispositivo(
           dispositivo_id,colaborador_id,fecha_inicio,fecha_fin,vigente,tipo_inicio,tipo_cierre,
           fecha_cierre_real_conocida,origen,referencia_origen,evidencia,nivel_confianza,cerrado_en
         ) SELECT $1,$2,$3,$4,FALSE,'RECONSTRUCCION_HISTORICA','CONCILIACION_HISTORICA',
                  $5,$6,$7,$8::JSONB,$9,NOW()
         WHERE NOT EXISTS(SELECT 1 FROM itam.custodias_dispositivo WHERE referencia_origen=$7)`,
        [deviceId,plan.collaboratorId,plan.deliveryDate,plan.returnDate,Boolean(plan.returnDate),
         SOURCE_NAME,reference,JSON.stringify({ evidenciaId: evidenceIds.get(plan.key), fila: plan.row.__row }),plan.confidence]
      );
    }
  }
};


const parseOperationalSheet = (
  workbook: SheetData[],
  sheetName: string
): SourceRow[] => {
  const sheet = workbook.find((candidate) => candidate.sheet === sheetName);
  if (!sheet) throw new Error(`No existe la hoja ${sheetName} en ${OPERATIONAL_SOURCE_NAME}.`);
  const headers = (sheet.data[0] ?? []).map(text);
  return sheet.data.slice(1).map((cells, index) => {
    const row: SourceRow = { __row: index + 2 };
    headers.forEach((header, column) => { if (header) row[header] = cells[column] ?? null; });
    return row;
  }).filter((row) => headers.some((header) => header && text(row[header])));
};

const loadOperationalRows = async (): Promise<OperationalRows> => {
  const workbook = await readExcelFile(OPERATIONAL_SOURCE_PATH) as unknown as SheetData[];
  return {
    sims: parseOperationalSheet(workbook, "SIM"),
    phones: parseOperationalSheet(workbook, "Telefono"),
    printers: parseOperationalSheet(workbook, "Impresoras")
  };
};

export const normalizeIccid = (value: Cell | undefined): string | null => {
  const raw = text(value);
  if (!raw || raw === "-") return null;
  const withoutExcelDot = raw.startsWith(".") ? raw.slice(1) : raw;
  return /^\d{18,22}$/.test(withoutExcelDot) ? withoutExcelDot : null;
};

const operationalPreview = (rows: OperationalRows): OperationalResult => {
  const legacyIds = new Map<string, number>();
  for (const row of rows.sims) {
    const id = text(row.ID);
    legacyIds.set(id, (legacyIds.get(id) ?? 0) + 1);
  }
  return {
    simsDetected: rows.sims.length,
    simsWithIccid: rows.sims.filter((row) => normalizeIccid(row["Cod. Serie"])).length,
    simsWithoutIccid: rows.sims.filter((row) => !normalizeIccid(row["Cod. Serie"])).length,
    simsCreated: 0,
    associationsCreated: 0,
    ambiguousLegacyIds: [...legacyIds].filter(([, count]) => count > 1).map(([id]) => id),
    printersPending: rows.printers.map((_, index) => ({
      referenceCode: 7001 + index,
      state: "PENDIENTE_VALIDACION"
    }))
  };
};

const stagePrinters = async (
  client: PoolClient,
  rows: SourceRow[]
): Promise<void> => {
  for (const [index, row] of rows.entries()) {
    const referenceCode = 7001 + index;
    const key = `${KEY_PREFIX}:${OPERATIONAL_SOURCE_NAME}:Impresoras:${row.__row}`;
    const redaction = redact(row);
    const evidence = await client.query<{ id: string }>(
      `INSERT INTO itam.evidencias_inventario_historico(
         clave_origen,fuente,hoja,fila_origen,indice_activo,tipo_activo,
         descripcion_original,estado_conciliacion,motivo_conflicto,
         nivel_confianza,datos_origen
       ) VALUES($1,$2,'Impresoras',$3,1,'IMPRESORA',$4,
                'PENDIENTE_IDENTIFICAR_ACTIVO',$5,'BAJA',$6::JSONB)
       ON CONFLICT(clave_origen) DO UPDATE SET
         estado_conciliacion=EXCLUDED.estado_conciliacion,
         motivo_conflicto=EXCLUDED.motivo_conflicto,
         datos_origen=EXCLUDED.datos_origen,actualizado_en=NOW()
       RETURNING id`,
      [key,OPERATIONAL_SOURCE_NAME,row.__row,text(row.Impresora) || null,
       `Referencia historica ${referenceCode}: impresora sin serie fisica; no se creo dispositivo.`,
       JSON.stringify({ ...redaction.data, referenciaCodigoHistorico: referenceCode })]
    );
    const reconciliation = await client.query<{ id: string }>(
      `INSERT INTO itam.casos_conciliacion_inventario(
         clave_caso,tipo_conflicto,estado,prioridad,descripcion,evidencia
       ) VALUES($1,'PENDIENTE_VALIDACION_IMPRESORA','PENDIENTE','ALTA',$2,$3::JSONB)
       ON CONFLICT(clave_caso) DO UPDATE SET descripcion=EXCLUDED.descripcion,evidencia=EXCLUDED.evidencia
       RETURNING id`,
      [`${key}:CASE`,
       `Validar fisicamente la impresora referenciada como ${referenceCode} antes de crear el activo.`,
       JSON.stringify({ fuente: OPERATIONAL_SOURCE_NAME, hoja: "Impresoras", fila: row.__row })]
    );
    await client.query(
      `INSERT INTO itam.casos_conciliacion_evidencias(caso_id,evidencia_id)
       VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [reconciliation.rows[0]!.id,evidence.rows[0]!.id]
    );
  }
};

const applyOperationalSims = async (
  client: PoolClient,
  rows: OperationalRows
): Promise<OperationalResult> => {
  const result = operationalPreview(rows);
  const state = await client.query<{ available_id: string; assigned_id: string }>(
    `SELECT disponible.id available_id,asignada.id assigned_id
     FROM itam.estados disponible
     CROSS JOIN itam.estados asignada
     WHERE disponible.tipo_entidad='SIM' AND disponible.codigo='DISPONIBLE'
       AND asignada.tipo_entidad='SIM' AND asignada.codigo='ASIGNADA'`
  );
  if (!state.rows[0]) throw new Error("Faltan estados DISPONIBLE/ASIGNADA para SIM.");
  const simByLegacyId = new Map<string, string[]>();
  for (const row of rows.sims) {
    const marker = `${KEY_PREFIX}:SIM:${row.__row}`;
    const iccid = normalizeIccid(row["Cod. Serie"]);
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM itam.sim
       WHERE observaciones LIKE $1 OR ($2::TEXT IS NOT NULL AND iccid_codigo_fabrica=$2)
       ORDER BY id LIMIT 1`, [`%${marker}%`,iccid]
    );
    let simId = existing.rows[0]?.id ?? null;
    if (!simId) {
      const code = await generateInventoryCode("SIM", null, client);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO itam.sim(
           codigo_inventario,iccid_codigo_fabrica,numero_asociado,compania,
           estado_id,observaciones
         ) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [code,iccid,text(row["Numero Asociado"]) === "-" ? null : text(row["Numero Asociado"]) || null,
         text(row["CompaÃ±Ã­a"]) || null,state.rows[0]!.available_id,
         `${marker}. ${iccid ? "ICCID preservado desde fuente." : "ICCID pendiente de completar."}`]
      );
      simId = inserted.rows[0]!.id;
      result.simsCreated += 1;
    }
    const legacyId = text(row.ID);
    simByLegacyId.set(legacyId, [...(simByLegacyId.get(legacyId) ?? []), simId]);
  }
  const phoneCounts = new Map<string, number>();
  for (const phone of rows.phones) {
    const id = text(phone.ID_SIM);
    phoneCounts.set(id, (phoneCounts.get(id) ?? 0) + 1);
  }
  for (const phone of rows.phones) {
    const legacyId = text(phone.ID_SIM);
    const simIds = simByLegacyId.get(legacyId) ?? [];
    const imeiRaw = text(phone.IMEI1);
    const imei = isValidImei(imeiRaw.startsWith(".") ? imeiRaw.slice(1) : imeiRaw) ? (imeiRaw.startsWith(".") ? imeiRaw.slice(1) : imeiRaw) : null;
    if (!imei || simIds.length !== 1 || phoneCounts.get(legacyId) !== 1 || normalized(phone.Estado) !== "ACTIVO") continue;
    const device = await client.query<{ id: string }>("SELECT id FROM itam.dispositivos WHERE imei=$1", [imei]);
    if (!device.rows[0]) continue;
    const conflict = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM itam.asociaciones_sim_dispositivo
         WHERE vigente=TRUE AND (sim_id=$1 OR dispositivo_id=$2)
       ) exists`, [simIds[0],device.rows[0].id]
    );
    if (conflict.rows[0]?.exists) continue;
    await client.query(
      `INSERT INTO itam.asociaciones_sim_dispositivo(
         sim_id,dispositivo_id,fecha_inicio,vigente,origen,referencia_origen,
         evidencia,nivel_confianza
       ) VALUES($1,$2,NOW(),TRUE,$3,$4,$5::JSONB,'ALTA')`,
      [simIds[0],device.rows[0].id,OPERATIONAL_SOURCE_NAME,
       `${KEY_PREFIX}:PHONE_SIM:${phone.__row}`,
       JSON.stringify({ hoja: "Telefono", fila: phone.__row, legacyId })]
    );
    await client.query(
      `UPDATE itam.sim SET dispositivo_id=$2,estado_id=$3 WHERE id=$1`,
      [simIds[0],device.rows[0].id,state.rows[0]!.assigned_id]
    );
    result.associationsCreated += 1;
  }
  await stagePrinters(client, rows.printers);
  return result;
};

const report = (plans: EvidencePlan[], groups: DeviceGroup[], operational: OperationalResult, redactions = 0) => {
  const byState = Object.fromEntries([...new Set(plans.map((p)=>p.state))].sort()
    .map((state)=>[state,plans.filter((p)=>p.state===state).length]));
  const findRut = (rut: string) => plans.filter((plan)=>plan.rutCanonical===rut)
    .map((plan)=>({ fila: plan.row.__row, tipo: plan.typeName, identidad: plan.identity,
      fecha: plan.deliveryDate, estado: plan.state, actual: plan.isCurrent }));
  return {
    database: TARGET_DATABASE, mode: APPLY ? "apply" : "dry-run", source: SOURCE_NAME,
    evidenceRows: plans.length, physicalDeviceGroups: groups.length,
    currentCustodiesPlanned: groups.filter((g)=>g.current && !g.conflict).length,
    conflicts: groups.filter((g)=>g.conflict).length, byState, redactions,
    controls: {
      claudiaFuentesAlegria: findRut("127926786"),
      segundoSergioTapiaMariqueo: findRut("111844739"),
      alexMarquezMardones: findRut("109853542")
    },
    printersWithoutPhysicalIdentity: plans.filter((p)=>p.typeName==="IMPRESORA" && !p.identity).length,
    operational
  };
};

const main = async (): Promise<void> => {
  if (APPLY === DRY_RUN) throw new Error("Use exactamente --dry-run o --apply.");
  if (process.env.DB_NAME !== TARGET_DATABASE) {
    throw new Error(`Bloqueo absoluto: DB_NAME debe ser ${TARGET_DATABASE}. No se realizo ninguna escritura.`);
  }
  const client = await pool.connect();
  try {
    const current = await client.query<{ database: string }>("SELECT current_database() database");
    if (current.rows[0]?.database !== TARGET_DATABASE) throw new Error("Conexion distinta de itam_rebuild.");
    const rows = await loadRows();
    const operationalRows = await loadOperationalRows();
    const plans = await planEvidence(client, rows);
    const groups = resolveGroups(plans);
    if (!APPLY) { console.log(JSON.stringify(report(plans, groups, operationalPreview(operationalRows)), null, 2)); return; }
    await client.query("BEGIN");
    try {
      const evidenceIds = new Map<string,string>();
      let redactions = 0;
      for (const plan of plans) {
        const inserted = await insertEvidence(client, plan);
        evidenceIds.set(plan.key, inserted.id); redactions += inserted.redacted;
      }
      for (const group of groups) await linkGroup(client, group, evidenceIds);
      const operationalResult = await applyOperationalSims(client, operationalRows);
      if (redactions) {
        await client.query(
          `INSERT INTO itam.auditoria_operaciones(metodo,ruta,codigo_respuesta,tipo_entidad,detalle)
           VALUES('DATA','/internal/rebuild/SEC-01',200,'RECONSTRUCCION',$1::JSONB)`,
          [JSON.stringify({ accion: "REDACTAR_DATO_SENSIBLE_HISTORICO", registrosRedactados: redactions })]
        );
      }
      await client.query("COMMIT");
      console.log(JSON.stringify(report(plans, groups, operationalResult, redactions), null, 2));
    } catch (error) { await client.query("ROLLBACK"); throw error; }
  } finally { client.release(); await pool.end(); }
};

if (require.main === module) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}