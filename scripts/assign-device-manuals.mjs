#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const MAX_MANUAL_BYTES = 10 * 1024 * 1024;
const DEFAULT_DEV_API_URL = "http://localhost:3000/api/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

const usage = () => `
Uso:
  node scripts/assign-device-manuals.mjs --env dev --manifest scripts/device-manuals.example.json --dry-run
  node scripts/assign-device-manuals.mjs --env prod --api-url https://itam.example/api/v1 --manifest manuals.json

Opciones:
  --env dev|prod       Entorno objetivo. Por defecto: dev.
  --api-url URL        Sobrescribe la URL de la API.
  --manifest FILE      JSON con codigoItam y url. Obligatorio.
  --replace             Reemplaza un manual existente. Por defecto, lo omite.
  --dry-run             Descarga y valida, pero no inicia sesión ni sube archivos.
  --email EMAIL         Usuario; también puede usar ITAM_EMAIL.
  --password PASSWORD   Clave; también puede usar ITAM_PASSWORD.
  --pin PIN             PIN de seis dígitos; también puede usar ITAM_PIN.
  --timeout-ms N        Timeout por petición. Por defecto: 30000.
  --help                Muestra esta ayuda.
`;

const valueAfter = (argv, index, option) => {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requiere un valor.`);
  }
  return value;
};

export const parseArgs = (argv) => {
  const options = {
    env: "dev",
    apiUrl: undefined,
    manifest: undefined,
    replace: false,
    dryRun: false,
    email: process.env.ITAM_EMAIL,
    password: process.env.ITAM_PASSWORD,
    pin: process.env.ITAM_PIN,
    timeoutMs: DEFAULT_TIMEOUT_MS
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--replace") {
      options.replace = true;
      continue;
    }
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (argument === "--env") {
      options.env = valueAfter(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--api-url") {
      options.apiUrl = valueAfter(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--manifest") {
      options.manifest = valueAfter(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--email") {
      options.email = valueAfter(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--password") {
      options.password = valueAfter(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--pin") {
      options.pin = valueAfter(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--timeout-ms") {
      options.timeoutMs = Number(valueAfter(argv, index, argument));
      index += 1;
      continue;
    }
    throw new Error(`Opción desconocida: ${argument}`);
  }

  return options;
};

const normalizeApiUrl = (value) => value.replace(/\/+$/, "");

export const resolveApiUrl = (options, env = process.env) => {
  if (options.apiUrl) return normalizeApiUrl(options.apiUrl);
  if (options.env !== "dev" && options.env !== "prod") {
    throw new Error("--env debe ser dev o prod.");
  }
  const configured = env[options.env === "prod" ? "ITAM_PROD_API_URL" : "ITAM_DEV_API_URL"];
  if (configured) return normalizeApiUrl(configured);
  if (options.env === "dev") return DEFAULT_DEV_API_URL;
  throw new Error("Para producción configure ITAM_PROD_API_URL o use --api-url explícitamente.");
};

export const validateManifest = (value) => {
  const entries = Array.isArray(value) ? value : value?.manuales;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("El manifiesto debe ser un arreglo no vacío de manuales.");
  }

  const seen = new Set();
  return entries.map((entry, index) => {
    const codigoItam = Number(entry?.codigoItam);
    const url = typeof entry?.url === "string" ? entry.url.trim() : "";
    if (!Number.isSafeInteger(codigoItam) || codigoItam <= 0) {
      throw new Error(`Manifiesto #${index + 1}: codigoItam debe ser entero positivo.`);
    }
    if (seen.has(codigoItam)) {
      throw new Error(`Manifiesto: codigoItam duplicado ${codigoItam}.`);
    }
    seen.add(codigoItam);
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Manifiesto #${index + 1}: URL inválida.`);
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Manifiesto #${index + 1}: la URL debe usar HTTP o HTTPS.`);
    }
    return { codigoItam, url };
  });
};

const responseError = async (response) => {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.error?.message || body?.message || "";
  } catch {
    detail = (await response.text().catch(() => "")).slice(0, 200);
  }
  return `${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`;
};

const request = async (url, init, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timeout después de ${timeoutMs} ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const sessionCookieFrom = (response) => {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  const session = values
    .map((value) => value.split(";", 1)[0])
    .find((value) => value.startsWith("itam_session="));
  if (!session) throw new Error("El login no devolvió la cookie itam_session.");
  return session;
};

export const login = async (apiUrl, options) => {
  if (!options.email) throw new Error("Falta --email o ITAM_EMAIL.");
  const usePin = Boolean(options.pin);
  if (!usePin && !options.password) {
    throw new Error("Falta --password/ITAM_PASSWORD o --pin/ITAM_PIN.");
  }
  if (usePin && !/^\d{6}$/.test(options.pin)) {
    throw new Error("El PIN debe tener exactamente 6 dígitos.");
  }
  const response = await request(
    `${apiUrl}/auth/${usePin ? "login-pin" : "login"}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(usePin
        ? { email: options.email, pin: options.pin }
        : { email: options.email, password: options.password })
    },
    options.timeoutMs
  );
  if (!response.ok) throw new Error(`Login fallido: ${await responseError(response)}`);
  return sessionCookieFrom(response);
};

const readLimitedBody = async (response, maxBytes) => {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`El manual supera el máximo de ${maxBytes / 1024 / 1024} MB.`);
  }
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error(`El manual supera el máximo de ${maxBytes / 1024 / 1024} MB.`);
    }
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`El manual supera el máximo de ${maxBytes / 1024 / 1024} MB.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
};

const filenameFromUrl = (url, codigoItam) => {
  const lastSegment = decodeURIComponent(new URL(url).pathname.split("/").pop() || "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = lastSegment.toLowerCase().endsWith(".pdf") ? lastSegment : `manual_${codigoItam}.pdf`;
  return filename.slice(0, 180) || `manual_${codigoItam}.pdf`;
};

export const downloadPdf = async (entry, timeoutMs) => {
  const response = await request(entry.url, { method: "GET", redirect: "follow" }, timeoutMs);
  if (!response.ok) throw new Error(`Descarga fallida: ${response.status} ${response.statusText}`);
  const buffer = await readLimitedBody(response, MAX_MANUAL_BYTES);
  if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("El contenido descargado no tiene firma PDF válida.");
  }
  return { buffer, filename: filenameFromUrl(entry.url, entry.codigoItam) };
};

const apiJson = async (apiUrl, pathname, cookie, timeoutMs, init = {}) => {
  const response = await request(`${apiUrl}${pathname}`, {
    ...init,
    headers: { ...(init.headers || {}), Cookie: cookie, Accept: "application/json" }
  }, timeoutMs);
  if (!response.ok) throw new Error(await responseError(response));
  return response.json();
};

export const currentCatalog = async (apiUrl, codigoItam, cookie, timeoutMs) => {
  const body = await apiJson(apiUrl, `/dispositivos/${codigoItam}/catalogo-tecnico`, cookie, timeoutMs);
  return body?.data ?? null;
};

export const uploadPdf = async (apiUrl, entry, pdf, cookie, timeoutMs) => {
  const form = new FormData();
  form.append("archivo", new Blob([pdf.buffer], { type: "application/pdf" }), pdf.filename);
  const body = await apiJson(
    apiUrl,
    `/dispositivos/${entry.codigoItam}/catalogo-tecnico`,
    cookie,
    timeoutMs,
    { method: "PUT", body: form }
  );
  return body?.data;
};

const readManifest = async (filename) => {
  const content = await fs.readFile(path.resolve(filename), "utf8");
  return validateManifest(JSON.parse(content));
};

export const run = async (options) => {
  if (options.help) {
    console.log(usage());
    return { failed: 0, skipped: 0, uploaded: 0 };
  }
  if (!options.manifest) throw new Error("Falta --manifest.");
  const entries = await readManifest(options.manifest);
  const apiUrl = resolveApiUrl(options);
  const cookie = options.dryRun ? null : await login(apiUrl, options);
  const summary = { failed: 0, skipped: 0, uploaded: 0 };

  console.log(`${options.dryRun ? "[DRY-RUN] " : ""}Entorno: ${options.env}; API: ${apiUrl}`);
  for (const entry of entries) {
    try {
      if (!options.dryRun) {
        const existing = await currentCatalog(apiUrl, entry.codigoItam, cookie, options.timeoutMs);
        if (existing && !options.replace) {
          summary.skipped += 1;
          console.log(`[OMITIDO] ${entry.codigoItam}: ya tiene ${existing.nombreOriginal}. Use --replace para sustituirlo.`);
          continue;
        }
      }
      const pdf = await downloadPdf(entry, options.timeoutMs);
      if (options.dryRun) {
        console.log(`[VALIDADO] ${entry.codigoItam}: ${pdf.filename}, ${pdf.buffer.length} bytes.`);
        continue;
      }
      await uploadPdf(apiUrl, entry, pdf, cookie, options.timeoutMs);
      summary.uploaded += 1;
      console.log(`[ASIGNADO] ${entry.codigoItam}: ${pdf.filename}, ${pdf.buffer.length} bytes.`);
    } catch (error) {
      summary.failed += 1;
      console.error(`[ERROR] ${entry.codigoItam}: ${error.message}`);
    }
  }

  console.log(`Resumen: asignados=${summary.uploaded}, omitidos=${summary.skipped}, errores=${summary.failed}`);
  return summary;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(parseArgs(process.argv.slice(2)))
    .then((summary) => {
      if (summary.failed > 0) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`[ERROR] ${error.message}`);
      console.error(usage());
      process.exitCode = 1;
    });
}
