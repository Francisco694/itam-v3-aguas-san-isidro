import assert from "node:assert/strict";
import test from "node:test";
import { ConflictError } from "../../shared/errors";
import { clasificarVerificacionFisica } from "./physical-verifications.service";
import type { DispositivoVerificacionRow } from "./physical-verifications.types";

const dispositivo = (estado = "DISPONIBLE"): DispositivoVerificacionRow => ({
  id: "1",
  estado_id: "2",
  estado_codigo: estado,
  tipo_nombre: "Notebook",
  numero_serie: "SER-001",
  imei: null,
  colaborador_id: null,
  departamento_id: null
});

test("verificación física: equipo no encontrado", () => {
  assert.equal(clasificarVerificacionFisica(dispositivo(), false, null).resultado, "NO_ENCONTRADO");
});

test("verificación física: identificador exacto verifica", () => {
  assert.equal(clasificarVerificacionFisica(dispositivo(), true, "SER-001").resultado, "VERIFICADO");
});

test("verificación física: identificador vacío o distinto requiere revisar datos", () => {
  assert.equal(clasificarVerificacionFisica(dispositivo(), true, null).resultado, "REVISAR_DATOS");
  assert.equal(clasificarVerificacionFisica(dispositivo(), true, "OTRO").resultado, "REVISAR_DATOS");
});

test("verificación física: smartphone compara exclusivamente el IMEI", () => {
  const smartphone = { ...dispositivo(), tipo_nombre: "Smartphone", imei: "359158762297938" };
  assert.equal(clasificarVerificacionFisica(smartphone, true, "359158762297938").resultado, "VERIFICADO");
  assert.equal(clasificarVerificacionFisica(smartphone, true, "SER-001").resultado, "REVISAR_DATOS");
});

test("verificación física: extraviado requiere regularización", () => {
  assert.throws(
    () => clasificarVerificacionFisica(dispositivo("EXTRAVIADO"), true, "SER-001"),
    ConflictError
  );
});

test("verificación física: asignado sin responsable requiere regularización", () => {
  assert.throws(
    () => clasificarVerificacionFisica(dispositivo("ASIGNADO"), true, "SER-001"),
    ConflictError
  );
});
