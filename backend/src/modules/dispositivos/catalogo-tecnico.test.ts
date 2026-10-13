import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { ValidationError } from "../../shared/errors";
import {
  MAX_CATALOGO_TECNICO_BYTES,
  removeTechnicalCatalogFile,
  resolveTechnicalCatalogPath,
  validateTechnicalCatalogSignature
} from "./catalogo-tecnico.upload";
import type { CatalogoTecnicoAlmacenado } from "./catalogo-tecnico.types";

const testDocument = (ruta: string): CatalogoTecnicoAlmacenado => ({
  nombreOriginal: "catalogo.pdf",
  nombreAlmacenado: ruta,
  mimeType: "application/pdf",
  tamanoBytes: 12,
  ruta
});

test("catálogo técnico acepta una firma PDF y elimina una firma inválida", async () => {
  const validPath = `catalogo_tecnico_test_${randomUUID()}.pdf`;
  const invalidPath = `catalogo_tecnico_test_${randomUUID()}.pdf`;
  try {
    await writeFile(resolveTechnicalCatalogPath(validPath), Buffer.from("%PDF-1.7\n"));
    await assert.doesNotReject(
      validateTechnicalCatalogSignature(testDocument(validPath))
    );

    await writeFile(resolveTechnicalCatalogPath(invalidPath), Buffer.from("not-pdf"));
    await assert.rejects(
      validateTechnicalCatalogSignature(testDocument(invalidPath)),
      ValidationError
    );
    await assert.rejects(
      rm(resolveTechnicalCatalogPath(invalidPath)),
      { code: "ENOENT" }
    );
  } finally {
    await removeTechnicalCatalogFile(validPath);
    await removeTechnicalCatalogFile(invalidPath);
  }
});

test("catálogo técnico conserva el límite de 10 MB y bloquea traversal", () => {
  assert.equal(MAX_CATALOGO_TECNICO_BYTES, 10 * 1024 * 1024);
  assert.throws(
    () => resolveTechnicalCatalogPath("../fuera-del-almacenamiento.pdf"),
    /Ruta de catálogo técnico inválida/
  );
});
