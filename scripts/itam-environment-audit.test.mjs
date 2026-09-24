import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import {
  buildLineWithoutOwnerQuery,
  classifyTraceabilityCount,
  detectFrontendConfig,
  extractMeaningfulSecretName,
  failureEvidence,
  findPlaywrightModule,
  isMeaningfulSecretLine,
  migrationSequenceInfo,
  redact,
  resolveBackendPort,
  summarizeFailureOutput
} from "./itam-environment-audit.mjs";

test("usa PORT=3000 desde la configuracion y no fija 3100", async () => {
  assert.equal(resolveBackendPort({ PORT: "3000" }), 3000);
  assert.notEqual(resolveBackendPort({ PORT: "3000" }), 3100);
  const source = await fs.readFile(new URL("./itam-environment-audit.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /3100/);
  assert.doesNotMatch(source, /BACKEND_PORT_NOT_3100/);
});

test("detecta frontend HTTPS y puerto desde el script real", () => {
  const config = detectFrontendConfig({
    scripts: { start: "ng serve", "start:lan:https": "ng serve --ssl --host 0.0.0.0 --port 4200" }
  }, {}, "192.168.1.25");
  assert.equal(config.url, "https://192.168.1.25:4200");
  assert.equal(config.protocol, "https");
  assert.equal(config.port, 4200);
});

test("solo considera asignaciones plausibles como secretos", () => {
  assert.equal(isMeaningfulSecretLine('const required = ["DB_PASSWORD"];'), false);
  assert.equal(isMeaningfulSecretLine("process.env.JWT_SECRET"), false);
  assert.equal(isMeaningfulSecretLine("regex que contiene DB_PASSWORD"), false);
  assert.equal(isMeaningfulSecretLine("backend/.env.example: DB_PASSWORD=placeholder"), false);
  assert.equal(extractMeaningfulSecretName("DB_PASSWORD=valorRealSeguro"), "DB_PASSWORD");
  assert.equal(extractMeaningfulSecretName('"JWT_SECRET": "valorRealSeguro"'), "JWT_SECRET");
});

test("la evidencia de secretos no expone valores", () => {
  const redacted = redact("DB_PASSWORD=valorRealSeguro");
  assert.doesNotMatch(redacted, /valorRealSeguro/);
  assert.match(redacted, /REDACTED/);
});

test("solo revisa lineas ACTIVA sin propietario", () => {
  const query = buildLineWithoutOwnerQuery();
  assert.match(query, /estado = 'ACTIVA'/);
  assert.doesNotMatch(query, /DADA_BAJA|PENDIENTE_REPOSICION|<>/);
});

test("un evento inexistente es INFO y no MEDIUM", () => {
  assert.equal(classifyTraceabilityCount(0), "INFO");
  assert.equal(classifyTraceabilityCount(2), "OK");
});

test("detecta migracion inferior pendiente con posteriores aplicadas", () => {
  const result = migrationSequenceInfo(
    [{ version: "029", file: "029_simplify_technical_service.sql" }, { version: "032", file: "032_last.sql" }],
    ["028", "030", "031", "032"]
  );
  assert.deepEqual(result.outOfSequence[0].laterApplied, ["030", "031", "032"]);
});

test("conserva el final relevante de un fallo de build", () => {
  const output = summarizeFailureOutput([
    ...Array.from({ length: 180 }, (_, index) => `line ${index}`),
    "ERROR final de Angular",
    "budget exceeded",
    "failed"
  ].join("\n"));
  assert.match(output, /ERROR final de Angular/);
  assert.match(output, /budget exceeded/);
  assert.match(output, /failed/);
  const reportEvidence = failureEvidence(output);
  assert.match(reportEvidence, /failed/);
});

test("la ausencia de Playwright no rompe la deteccion visual", async () => {
  await assert.doesNotReject(async () => {
    const module = await findPlaywrightModule();
    assert.ok(module === null || module.chromium || module.default?.chromium);
  });
});
