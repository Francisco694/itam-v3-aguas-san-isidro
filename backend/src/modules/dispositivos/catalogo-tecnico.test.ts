import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { ValidationError } from "../../shared/errors";
import {
  MAX_CATALOGO_TECNICO_BYTES,
  MAX_CATALOGO_TECNICO_FILES,
  catalogosTecnicosFromUpload,
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

test("catÃ¡logo tÃ©cnico transforma varios archivos adjuntos", () => {
  const documents = catalogosTecnicosFromUpload({
    archivos: [
      { originalname: "manual.pdf", filename: "manual-a.pdf", size: 12 },
      { originalname: "ficha técnica.pdf", filename: "manual-b.pdf", size: 14 }
    ] as Express.Multer.File[]
  });

  assert.deepEqual(documents.map((document) => document.nombreOriginal), [
    "manual.pdf",
    "ficha técnica.pdf"
  ]);
  assert.deepEqual(documents.map((document) => document.ruta), [
    "manual-a.pdf",
    "manual-b.pdf"
  ]);
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
  assert.equal(MAX_CATALOGO_TECNICO_FILES, 10);
  assert.throws(
    () => resolveTechnicalCatalogPath("../fuera-del-almacenamiento.pdf"),
    /Ruta de catálogo técnico inválida/
  );
});
