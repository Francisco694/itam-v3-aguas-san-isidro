import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { downloadPdf, MAX_MANUAL_BYTES, parseArgs, resolveApiUrl, validateManifest } from "./assign-device-manuals.mjs";

test("valida manifiesto y normaliza codigo ITAM", () => {
  assert.deepEqual(validateManifest([
    { codigoItam: "1001", url: "https://example.com/manual.pdf" }
  ]), [{ codigoItam: 1001, url: "https://example.com/manual.pdf" }]);
});

test("rechaza codigo duplicado y protocolos no HTTP", () => {
  assert.throws(() => validateManifest([
    { codigoItam: 1001, url: "https://example.com/a.pdf" },
    { codigoItam: 1001, url: "https://example.com/b.pdf" }
  ]), /duplicado/);
  assert.throws(() => validateManifest([
    { codigoItam: 1002, url: "file:///tmp/manual.pdf" }
  ]), /HTTP o HTTPS/);
});

test("resuelve dev por defecto y exige URL explícita para prod", () => {
  assert.equal(resolveApiUrl(parseArgs([]), {}), "http://localhost:3000/api/v1");
  assert.throws(() => resolveApiUrl({ env: "prod" }, {}), /ITAM_PROD_API_URL/);
  assert.equal(resolveApiUrl({ env: "prod" }, { ITAM_PROD_API_URL: "https://itam.example/api/v1/" }), "https://itam.example/api/v1");
});

test("mantiene el límite del backend", () => {
  assert.equal(MAX_MANUAL_BYTES, 10 * 1024 * 1024);
});

test("descarga y valida la firma de un PDF", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/pdf" });
    response.end(Buffer.from("%PDF-1.7\nmanual de prueba"));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const result = await downloadPdf(
      { codigoItam: 1001, url: `http://127.0.0.1:${address.port}/manual.pdf` },
      5_000
    );
    assert.equal(result.filename, "manual.pdf");
    assert.match(result.buffer.toString("ascii"), /^%PDF-/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
