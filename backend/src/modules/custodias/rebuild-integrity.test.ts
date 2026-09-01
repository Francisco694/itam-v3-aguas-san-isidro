import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  isValidImei,
  normalizeIccid,
  resolveGroups,
  type EvidencePlan
} from "../../scripts/rebuild-inventory-from-history";

const plan = (overrides: Partial<EvidencePlan>): EvidencePlan => ({
  key: "source:2",
  row: { __row: 2 },
  rutOriginal: "12.792.678-6",
  rutCanonical: "127926786",
  collaboratorId: "10",
  typeName: "SMARTPHONE",
  description: "Samsung",
  identityKind: "IMEI",
  identity: "490154203237518",
  deliveryDate: "2024-01-01",
  returnDate: null,
  state: "PROBABLE_VIGENTE",
  reason: null,
  confidence: "MEDIA",
  deviceKey: "IMEI:490154203237518",
  isCurrent: false,
  ...overrides
});

const migration = (name: string): string => fs.readFileSync(
  path.resolve(process.cwd(), "../database/migrations", name),
  "utf8"
);

test("ICCID conserva todos los digitos y admite ausencia", () => {
  assert.equal(normalizeIccid(".8956032255752545860"), "8956032255752545860");
  assert.equal(normalizeIccid("8956032255752546900"), "8956032255752546900");
  assert.equal(normalizeIccid("-"), null);
  assert.equal(normalizeIccid(null), null);
});
test("IMEI cero o checksum invalido nunca identifica un activo", () => {
  assert.equal(isValidImei("000000000000000"), false);
  assert.equal(isValidImei("123456789012345"), false);
  assert.equal(isValidImei("490154203237518"), true);
});

test("cronologia conserva un solo smartphone vigente por colaborador", () => {
  const oldPhone = plan({ key: "claudia-old", identity: "356938035643809",
    deviceKey: "IMEI:356938035643809", deliveryDate: "2021-01-01" });
  const currentPhone = plan({ key: "claudia-current", identity: "490154203237518",
    deviceKey: "IMEI:490154203237518", deliveryDate: "2024-01-01" });
  const groups = resolveGroups([oldPhone, currentPhone]);
  assert.equal(groups.filter((group) => group.current).length, 1);
  assert.equal(groups.find((group) => group.current)?.identity, "490154203237518");
  assert.equal(oldPhone.state, "PROBABLE_HISTORICA");
});

test("un IMEI con custodios simultaneos queda en conflicto", () => {
  const left = plan({ key: "left", collaboratorId: "10" });
  const right = plan({ key: "right", collaboratorId: "11" });
  const [group] = resolveGroups([left, right]);
  assert.equal(group?.current, null);
  assert.match(group?.conflict ?? "", /custodios distintos/i);
  assert.equal(left.state, "CONFLICTO_IMEI");
});

test("024 garantiza XOR y una sola custodia vigente", () => {
  const sql = migration("024_temporal_device_custody.sql");
  assert.match(sql, /chk_custodia_un_custodio/);
  assert.match(sql, /CREATE UNIQUE INDEX uq_custodia_vigente_dispositivo/);
  assert.match(sql, /WHERE vigente = TRUE/);
  assert.match(sql, /CONCILIACION_HISTORICA/);
});

test("025 admite evidencia sin dispositivo y conserva origen idempotente", () => {
  const sql = migration("025_historical_inventory_evidence.sql");
  assert.match(sql, /dispositivo_id BIGINT,/);
  assert.doesNotMatch(sql, /dispositivo_id BIGINT NOT NULL/);
  assert.match(sql, /CONSTRAINT uq_evidencia_clave_origen UNIQUE \(clave_origen\)/);
  assert.match(sql, /datos_origen JSONB NOT NULL/);
});

test("026 limita custodia y asociacion SIM vigentes", () => {
  const sql = migration("026_temporal_sim_custody.sql");
  assert.match(sql, /uq_custodia_vigente_sim/);
  assert.match(sql, /uq_asociacion_vigente_por_sim/);
  assert.match(sql, /uq_asociacion_vigente_por_dispositivo/);
});

test("preparacion e importacion tienen bloqueo absoluto contra itam_dev", () => {
  const prepare = fs.readFileSync(path.resolve(process.cwd(), "src/scripts/prepare-rebuild-database.ts"), "utf8");
  const importer = fs.readFileSync(path.resolve(process.cwd(), "src/scripts/rebuild-inventory-from-history.ts"), "utf8");
  assert.match(prepare, /process\.env\.DB_NAME !== TARGET_DATABASE/);
  assert.match(prepare, /itam_dev_pre_023_2026-08-31T19-23-47-962Z\.dump/);
  assert.doesNotMatch(prepare, /auditoria_operaciones.*ID 392/is);
  assert.match(importer, /process\.env\.DB_NAME !== TARGET_DATABASE/);
  assert.match(importer, /ON CONFLICT\(clave_origen\)/);
});

test("reasignacion y devolucion usan cierres semanticos distintos", () => {
  const service = fs.readFileSync(path.resolve(process.cwd(), "src/modules/dispositivos/dispositivos.service.ts"), "utf8");
  assert.match(service, /tipoCierre: "REASIGNACION"/);
  assert.match(service, /tipoCierre: origen === "OFFBOARDING" \? "OFFBOARDING" : "DEVOLUCION"/);
  assert.match(service, /tipoCierre: "EXTRAVIO"/);
  assert.match(service, /tipoCierre: "BAJA"/);
});