#!/usr/bin/env node
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exec } from "node:child_process";
import fs from "node:fs/promises";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const require = createRequire(import.meta.url);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");
const reportsDir = path.join(rootDir, "reports");
const backendEnvPath = path.join(backendDir, ".env");

const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const counts = Object.fromEntries([...severities, "OK"].map((severity) => [severity, 0]));
const findings = [];
const okChecks = [];
const commands = [];
const queries = [];
const notes = new Map();
let auditRunStamp = "";
let auditLogDir = "";
let auditScreenshotDir = "";

function nowStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("-") + "-" + [pad(now.getHours()), pad(now.getMinutes())].join("-");
}

function normalizeSlashes(value) {
  return value.replaceAll("\\", "/");
}

function escapeMd(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\r", "")
    .replaceAll("\n", "<br>");
}

function compact(value, maxLength = 1200) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}... [truncado]` : text;
}

function redact(value) {
  return String(value ?? "")
    .replace(/((?:DB_PASSWORD|JWT_SECRET|SESSION_SECRET|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|SECRET_KEY)\s*["']?\s*[=:]\s*["']?)([^"'`\s,}]+)(["']?)/gi, "$1[REDACTED]$3")
    .replace(/(password=)([^&\s]+)/gi, "$1[REDACTED]");
}

function summarizeFailureOutput(value, maxTailLines = 150) {
  const lines = String(value ?? "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= maxTailLines + 25) return redact(lines.join("\n"));
  const first = lines.slice(0, 25);
  const relevant = lines.filter((line) => /\bERROR\b|Error:|\bNG\d|\bTS\d|budget|failed|exception/i.test(line));
  const tail = lines.slice(-maxTailLines);
  const merged = [...first, ...relevant, ...tail].filter((line, index, all) => all.indexOf(line) === index);
  return redact(merged.join("\n"));
}

function failureEvidence(value, maxLength = 1200) {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  const headLength = Math.min(320, Math.floor(maxLength * 0.3));
  const tailLength = maxLength - headLength - 45;
  return `${text.slice(0, headLength)}\n... [se prioriza el final del fallo] ...\n${text.slice(-tailLength)}`;
}

function parsePort(value, fallback = 3000) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function resolveBackendPort(env = {}) {
  return parsePort(env.PORT ?? process.env.PORT, 3000);
}

function parseCliFlag(command, flag, fallback = undefined) {
  const pattern = new RegExp(`(?:^|\\s)--${flag}(?:=|\\s+)([^\\s]+)`);
  const match = String(command ?? "").match(pattern);
  return match ? match[1].replace(/^['"]|['"]$/g, "") : fallback;
}

function detectFrontendConfig(packageJson = {}, env = process.env, lanAddress = undefined) {
  const explicitUrl = String(env.AUDIT_FRONTEND_URL ?? "").trim();
  if (explicitUrl) {
    try {
      const parsed = new URL(explicitUrl);
      return {
        url: parsed.toString().replace(/\/$/, ""),
        protocol: parsed.protocol.replace(":", ""),
        host: parsed.hostname,
        port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)),
        scriptName: "AUDIT_FRONTEND_URL",
        script: ""
      };
    } catch {
      // Se informa en auditAvailability y se usa la configuracion del package.json.
    }
  }

  const scripts = packageJson.scripts ?? {};
  const candidates = Object.entries(scripts)
    .filter(([name]) => /^(start|serve)/i.test(name))
    .map(([name, script]) => ({ name, script: String(script) }));
  const selected = candidates.find(({ script }) => /(?:^|\s)--ssl(?:\s|$)/i.test(script))
    ?? candidates.find(({ name }) => name === "start")
    ?? candidates[0]
    ?? { name: "default", script: "" };
  const ssl = /(?:^|\s)--ssl(?:\s|$)/i.test(selected.script);
  const port = Number(parseCliFlag(selected.script, "port", 4200));
  const configuredHost = parseCliFlag(selected.script, "host", "127.0.0.1");
  const host = configuredHost === "0.0.0.0" || configuredHost === "::"
    ? (lanAddress ?? "127.0.0.1")
    : configuredHost;
  return {
    url: `${ssl ? "https" : "http"}://${host}:${Number.isInteger(port) && port > 0 ? port : 4200}`,
    protocol: ssl ? "https" : "http",
    host,
    port: Number.isInteger(port) && port > 0 ? port : 4200,
    scriptName: selected.name,
    script: selected.script
  };
}

function detectLanAddress() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal && !/^169\.254\./.test(entry.address)) return entry.address;
    }
  }
  return "127.0.0.1";
}

function isMeaningfulSecretLine(line) {
  return Boolean(extractMeaningfulSecretName(line));
}

function extractMeaningfulSecretName(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
  const match = trimmed.match(/^(?:export\s+)?(?:(?:const|let|var)\s+)?["']?(DB_PASSWORD|JWT_SECRET|SESSION_SECRET|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|SECRET_KEY)["']?\s*[:=]\s*(.+?)\s*,?\s*(?:#.*)?$/i);
  if (!match) return null;
  const value = match[2]
    .trim()
    .replace(/;\s*$/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (!value || /^(?:process\.env|import\.meta\.env|\$\{?[A-Z_][A-Z0-9_]*\}?|undefined|null)$/i.test(value)) return null;
  if (/change_me|example|placeholder|your_|dummy|replace[_-]?me|secret_here/i.test(value)) return null;
  if (value.length < 8) return null;
  return match[1].toUpperCase();
}

function isRobustSecretValue(value) {
  const text = String(value ?? "");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(text)).length;
  return text.length >= 16 && classes >= 3;
}

function shouldSkipSecretScan(file) {
  const normalized = normalizeSlashes(file).toLowerCase();
  return normalized === "scripts/itam-environment-audit.mjs"
    || normalized.includes("/node_modules/")
    || normalized.startsWith("node_modules/")
    || normalized.includes("/dist/")
    || normalized.startsWith("dist/")
    || normalized.includes("/coverage/")
    || normalized.startsWith("coverage/")
    || normalized.includes("/reports/")
    || normalized.startsWith("reports/")
    || normalized.includes("/.angular/")
    || normalized.startsWith(".angular/")
    || normalized.endsWith("package-lock.json")
    || normalized.endsWith(".env.example")
    || /\.(?:png|jpe?g|gif|webp|ico|pdf|xlsx?|zip|gz|tar|7z|exe|dll|so|dylib|pem|key)$/i.test(normalized);
}

function addFinding({ code, severity, area, description, evidence, recommendation, command, query }) {
  counts[severity] += 1;
  findings.push({
    code,
    severity,
    area,
    description,
    evidence: redact(compact(evidence)),
    recommendation,
    command,
    query
  });
}

function addOk(area, description, evidence = "", commandOrQuery = "") {
  counts.OK += 1;
  okChecks.push({
    area,
    description,
    evidence: redact(compact(evidence)),
    commandOrQuery
  });
}

function addInfo(code, area, description, evidence, recommendation, command, query) {
  addFinding({
    code,
    severity: "INFO",
    area,
    description,
    evidence,
    recommendation,
    command,
    query
  });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function parseDotenv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

async function loadBackendEnv() {
  if (!(await pathExists(backendEnvPath))) return {};
  return parseDotenv(await fs.readFile(backendEnvPath, "utf8"));
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

async function readJson(target) {
  return JSON.parse(await fs.readFile(target, "utf8"));
}

async function writeAuditArtifact(fileName, contents) {
  if (!auditLogDir) return;
  await fs.mkdir(auditLogDir, { recursive: true });
  await fs.writeFile(path.join(auditLogDir, fileName), contents, "utf8");
}

function isLocalAuditUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "localhost"
      || hostname === "127.0.0.1"
      || hostname === "::1"
      || /^10\./.test(hostname)
      || /^192\.168\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
  } catch {
    return false;
  }
}

async function requestHttp(url, allowSelfSigned = false) {
  if (!allowSelfSigned || !url.startsWith("https://") || !isLocalAuditUrl(url)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return { status: response.status, body: await response.text() };
    } finally {
      clearTimeout(timeout);
    }
  }
  return new Promise((resolve, reject) => {
    const request = https.get(url, { rejectUnauthorized: false, timeout: 5000 }, (response) => {
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: chunks.join("") }));
    });
    request.on("timeout", () => request.destroy(new Error("HTTPS request timed out")));
    request.on("error", reject);
  });
}

async function runCommand(command, options = {}) {
  const cwd = options.cwd ?? rootDir;
  const timeout = options.timeout ?? 120000;
  const label = options.label ?? command;
  const record = {
    label,
    command,
    cwd: normalizeSlashes(path.relative(rootDir, cwd) || "."),
    exitCode: null,
    stdout: "",
    stderr: "",
    timedOut: false
  };
  commands.push(record);

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: options.maxBuffer ?? 1024 * 1024 * 10,
      windowsHide: true,
      env: { ...process.env, CI: "true" }
    });
    record.exitCode = 0;
    record.stdout = compact(stdout, options.captureLimit ?? 6000);
    record.stderr = compact(stderr, options.captureLimit ?? 6000);
    return { ok: true, exitCode: 0, stdout, stderr, record };
  } catch (error) {
    record.exitCode = typeof error.code === "number" ? error.code : 1;
    record.stdout = summarizeFailureOutput(error.stdout ?? "");
    record.stderr = summarizeFailureOutput(error.stderr ?? error.message ?? "");
    record.timedOut = error.killed || /timed out/i.test(error.message ?? "");
    return {
      ok: false,
      exitCode: record.exitCode,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message ?? "",
      timedOut: record.timedOut,
      record
    };
  }
}

async function httpCheck(url, label, area, severityWhenDown = "MEDIUM", options = {}) {
  const started = performance.now();
  try {
    const response = await requestHttp(url, options.allowSelfSigned === true);
    const elapsed = Math.round(performance.now() - started);
    const body = response.body;
    if (response.status >= 200 && response.status < 300) {
      addOk(area, `${label} disponible`, `HTTP ${response.status}; ${elapsed} ms`, `GET ${url}`);
      return { ok: true, status: response.status, elapsed, body };
    }
    addFinding({
      code: `HTTP_${label.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
      severity: severityWhenDown,
      area,
      description: `${label} respondio con estado no exitoso.`,
      evidence: `HTTP ${response.status}; ${elapsed} ms; ${compact(body, 500)}`,
      recommendation: "Revisar el servicio local, logs y configuracion de puerto.",
      command: `GET ${url}`
    });
    return { ok: false, status: response.status, elapsed, body };
  } catch (error) {
    addFinding({
      code: `HTTP_${label.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_DOWN`,
      severity: severityWhenDown,
      area,
      description: `${label} no esta disponible.`,
      evidence: error.message,
      recommendation: "Levantar el servicio local o corregir host/puerto antes de validar disponibilidad.",
      command: `GET ${url}`
    });
    return { ok: false, error };
  }
}

async function checkPort(host, port, area) {
  await new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 2500 }, () => {
      socket.destroy();
      addOk(area, `Puerto ${port} abierto`, `${host}:${port}`, `TCP ${host}:${port}`);
      resolve();
    });
    socket.on("timeout", () => {
      socket.destroy();
      addFinding({
        code: `PORT_${port}_TIMEOUT`,
        severity: "MEDIUM",
        area,
        description: `El puerto ${port} no respondio dentro del tiempo esperado.`,
        evidence: `${host}:${port}`,
        recommendation: "Confirmar que el backend esperado este levantado y escuchando en el puerto solicitado.",
        command: `TCP ${host}:${port}`
      });
      resolve();
    });
    socket.on("error", (error) => {
      addFinding({
        code: `PORT_${port}_CLOSED`,
        severity: "MEDIUM",
        area,
        description: `El puerto ${port} no esta abierto.`,
        evidence: error.message,
        recommendation: "Levantar el backend local o ajustar la configuracion de puerto.",
        command: `TCP ${host}:${port}`
      });
      resolve();
    });
  });
}

function importPg() {
  try {
    return require(path.join(backendDir, "node_modules", "pg"));
  } catch {
    return require("pg");
  }
}

async function listMigrationFiles() {
  const migrationDir = path.join(rootDir, "database", "migrations");
  if (!(await pathExists(migrationDir))) return [];
  const files = await fs.readdir(migrationDir);
  return files
    .map((file) => {
      const match = file.match(/^(\d{3,})_(.+)\.sql$/);
      return match ? { version: match[1], file } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.version.localeCompare(b.version));
}

function migrationSequenceInfo(migrationFiles, appliedVersions) {
  const applied = appliedVersions.map(String);
  const missingFiles = migrationFiles.filter((file) => !applied.includes(String(file.version)));
  const extraDb = applied.filter((version) => !migrationFiles.some((file) => String(file.version) === version));
  const outOfSequence = missingFiles.map((file) => ({
    ...file,
    laterApplied: applied.filter((version) => Number(version) > Number(file.version))
  })).filter((item) => item.laterApplied.length > 0);
  return { missingFiles, extraDb, outOfSequence };
}

function buildLineWithoutOwnerQuery() {
  return "SELECT id, numero_telefonico, estado FROM itam.lineas_moviles WHERE estado = 'ACTIVA' AND sim_id IS NULL AND dispositivo_id IS NULL AND colaborador_id IS NULL";
}

function classifyTraceabilityCount(count) {
  return Number(count) > 0 ? "OK" : "INFO";
}

function looksText(buffer) {
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8");
  return !/[\u0000-\u0008\u000E-\u001F]/.test(sample);
}

async function listTextFiles(directory) {
  if (!(await pathExists(directory))) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listTextFiles(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

async function findBackendSecretUsage(secretName) {
  const sourceFiles = await listTextFiles(path.join(backendDir, "src"));
  const usage = [];
  const pattern = new RegExp(`(?:process\\.env|env)\\s*(?:\\.|\\?\\.|\\[\\s*["'])${secretName}(?:["']\\s*\\])?`, "i");
  for (const file of sourceFiles) {
    try {
      const text = await fs.readFile(file, "utf8");
      text.split(/\r?\n/).forEach((line, index) => {
        if (pattern.test(line)) usage.push({ file: normalizeSlashes(path.relative(rootDir, file)), line: index + 1 });
      });
    } catch {
      // Unreadable source files are not treated as usage evidence.
    }
  }
  return usage;
}

async function auditSecurity(env) {
  const area = "Seguridad";
  const envExists = await pathExists(backendEnvPath);
  if (envExists) {
    addOk(area, "Existe backend/.env", normalizeSlashes(path.relative(rootDir, backendEnvPath)));
  } else {
    addFinding({
      code: "ENV_MISSING",
      severity: "HIGH",
      area,
      description: "No existe backend/.env.",
      evidence: normalizeSlashes(path.relative(rootDir, backendEnvPath)),
      recommendation: "Crear backend/.env desde backend/.env.example con valores reales locales."
    });
  }

  const status = await runCommand("git status --short", { label: "git status --short" });
  if (status.ok) {
    if (status.stdout.trim()) {
      addInfo(
        "GIT_DIRTY",
        area,
        "El arbol de trabajo tiene cambios locales.",
        status.stdout,
        "Revisar que los cambios esperados sean los unicos antes de commitear.",
        "git status --short"
      );
    } else {
      addOk(area, "Git sin cambios locales", "", "git status --short");
    }
    const envInStatus = status.stdout
      .split(/\r?\n/)
      .filter((line) => /(^|\s)(\.env|.*\/\.env|.*\\\.env)\s*$/i.test(line.trim()));
    if (envInStatus.length) {
      addFinding({
        code: "ENV_IN_GIT_STATUS",
        severity: "CRITICAL",
        area,
        description: ".env aparece en git status.",
        evidence: envInStatus.join("\n"),
        recommendation: "Remover .env del indice si fue agregado y asegurar que quede ignorado.",
        command: "git status --short"
      });
    } else {
      addOk(area, ".env no aparece en git status", "", "git status --short");
    }
  } else {
    addFinding({
      code: "GIT_STATUS_FAILED",
      severity: "MEDIUM",
      area,
      description: "No se pudo ejecutar git status.",
      evidence: status.stderr,
      recommendation: "Revisar que el proyecto sea un repositorio Git valido.",
      command: "git status --short"
    });
  }

  const tracked = await runCommand("git ls-files", { label: "git ls-files" });
  if (tracked.ok) {
    const files = tracked.stdout.split(/\r?\n/).filter(Boolean);
    const trackedEnv = files.filter((file) => /(^|\/)\.env$/i.test(file));
    if (trackedEnv.length) {
      addFinding({
        code: "ENV_VERSIONED",
        severity: "CRITICAL",
        area,
        description: "Hay archivos .env versionados.",
        evidence: trackedEnv.join("\n"),
        recommendation: "Eliminar los .env del repositorio y rotar credenciales expuestas.",
        command: "git ls-files"
      });
    } else {
      addOk(area, "No hay .env versionado", "", "git ls-files");
    }

    const secretHits = [];
    for (const file of files) {
      if (shouldSkipSecretScan(file)) continue;
      const absolute = path.join(rootDir, file);
      try {
        const stat = await fs.stat(absolute);
        if (stat.size > 1024 * 1024) continue;
        const buffer = await fs.readFile(absolute);
        if (!looksText(buffer)) continue;
        const lines = buffer.toString("utf8").split(/\r?\n/);
        lines.forEach((line, index) => {
          const variable = extractMeaningfulSecretName(line);
          if (variable) {
            secretHits.push(`${file}:${index + 1}\nvariable=${variable}`);
          } else if (/-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/.test(line)) {
            secretHits.push(`${file}:${index + 1}\nvariable=PRIVATE_KEY`);
          }
        });
      } catch {
        // Deleted or unreadable tracked files are handled by git status/diff checks.
      }
    }
    if (secretHits.length) {
      addFinding({
        code: "SECRETS_IN_VERSIONED_FILES",
        severity: "HIGH",
        area,
        description: "Se detectaron posibles secretos en archivos versionados.",
        evidence: secretHits.slice(0, 30).join("\n"),
        recommendation: "Mover secretos a .env, usar placeholders en ejemplos y rotar valores comprometidos."
      });
    } else {
      addOk(area, "No se detectaron secretos evidentes en archivos versionados");
    }
  }

  const diff = await runCommand("git diff --cached --no-ext-diff && git diff --no-ext-diff", {
    label: "git diff --cached --no-ext-diff && git diff --no-ext-diff",
    captureLimit: 12000
  });
  const addedSecretLines = diff.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++") && isMeaningfulSecretLine(line.slice(1)));
  if (addedSecretLines.length) {
    addFinding({
      code: "SECRETS_IN_GIT_DIFF",
      severity: "CRITICAL",
      area,
      description: "El diff contiene posibles secretos.",
      evidence: addedSecretLines
        .map((line) => `variable=${extractMeaningfulSecretName(line.slice(1))}`)
        .slice(0, 30)
        .join("\n"),
      recommendation: "Retirar secretos del diff antes de commitear y rotar cualquier valor expuesto.",
      command: "git diff --cached --no-ext-diff && git diff --no-ext-diff"
    });
  } else {
    addOk(area, "No se detectaron secretos en git diff", "", "git diff");
  }

  const nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV ?? "development";
  if (nodeEnv === "development") {
    addFinding({
      code: "NODE_ENV_DEVELOPMENT",
      severity: "LOW",
      area,
      description: "NODE_ENV esta en development.",
      evidence: "NODE_ENV=development",
      recommendation: "Usar NODE_ENV=production para despliegues productivos."
    });
  } else {
    addOk(area, "NODE_ENV no esta en development", `NODE_ENV=${nodeEnv}`);
  }

  if ((env.CORS_ORIGIN ?? "").trim() === "*") {
    addFinding({
      code: "CORS_WILDCARD",
      severity: "MEDIUM",
      area,
      description: "CORS_ORIGIN permite cualquier origen.",
      evidence: "CORS_ORIGIN=*",
      recommendation: "Configurar un origen explicito permitido."
    });
  } else if (env.CORS_ORIGIN) {
    addOk(area, "CORS_ORIGIN configurado con origen explicito", `CORS_ORIGIN=${env.CORS_ORIGIN}`);
  } else {
    addInfo(
      "CORS_ORIGIN_DEFAULT",
      area,
      "CORS_ORIGIN no esta definido; el backend usara su valor por defecto.",
      "Sin CORS_ORIGIN en backend/.env",
      "Definir CORS_ORIGIN explicitamente por entorno."
    );
  }

  for (const secretName of ["JWT_SECRET", "SESSION_SECRET"]) {
    const usage = await findBackendSecretUsage(secretName);
    const configuredValue = env[secretName] ?? process.env[secretName];
    if (!usage.length) {
      addInfo(
        `${secretName}_NOT_REQUIRED`,
        area,
        `${secretName} no es requerido por la implementacion actual.`,
        "No se encontraron referencias reales en backend/src.",
        "No exigir esta variable mientras la implementacion no la utilice."
      );
    } else if (!configuredValue) {
      addFinding({
        code: `${secretName}_MISSING`,
        severity: "HIGH",
        area,
        description: `Falta ${secretName}.`,
        evidence: `${secretName}=ausente; referencias=${usage.slice(0, 5).map((item) => `${item.file}:${item.line}`).join(", ")}`,
        recommendation: `Definir ${secretName} con un valor robusto y no versionado.`
      });
    } else if (!isRobustSecretValue(configuredValue)) {
      addFinding({
        code: `${secretName}_WEAK`,
        severity: "MEDIUM",
        area,
        description: `${secretName} esta definido, pero no parece tener longitud/entropia suficiente.`,
        evidence: `${secretName}=presente; referencias=${usage.length}`,
        recommendation: `Usar un valor aleatorio de al menos 16 caracteres con variedad de caracteres para ${secretName}.`
      });
    } else {
      addOk(area, `${secretName} esta definido`, `${secretName}=presente`);
    }
  }

  const timeout = Number(env.SESSION_IDLE_TIMEOUT_MINUTES ?? process.env.SESSION_IDLE_TIMEOUT_MINUTES);
  const warning = Number(env.SESSION_IDLE_WARNING_MINUTES ?? process.env.SESSION_IDLE_WARNING_MINUTES);
  if (!Number.isInteger(timeout) || timeout <= 0) {
    addFinding({
      code: "SESSION_IDLE_TIMEOUT_INVALID",
      severity: "MEDIUM",
      area,
      description: "SESSION_IDLE_TIMEOUT_MINUTES falta o no es un entero positivo.",
      evidence: `SESSION_IDLE_TIMEOUT_MINUTES=${env.SESSION_IDLE_TIMEOUT_MINUTES ?? "ausente"}`,
      recommendation: "Configurar un timeout positivo, por ejemplo 60."
    });
  } else {
    addOk(area, "SESSION_IDLE_TIMEOUT_MINUTES valido", String(timeout));
  }
  if (!Number.isInteger(warning) || warning <= 0 || (Number.isInteger(timeout) && warning >= timeout)) {
    addFinding({
      code: "SESSION_IDLE_WARNING_INVALID",
      severity: "MEDIUM",
      area,
      description: "SESSION_IDLE_WARNING_MINUTES falta, no es positivo o no es menor que el timeout.",
      evidence: `SESSION_IDLE_WARNING_MINUTES=${env.SESSION_IDLE_WARNING_MINUTES ?? "ausente"}`,
      recommendation: "Configurar una advertencia positiva y menor que SESSION_IDLE_TIMEOUT_MINUTES."
    });
  } else {
    addOk(area, "SESSION_IDLE_WARNING_MINUTES valido", String(warning));
  }

  await auditNpmSecurity("backend", backendDir, area);
  await auditNpmSecurity("frontend", frontendDir, area);
}

function parseNpmAuditOutput(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function npmVulnerabilityCounts(parsed) {
  const vulns = parsed?.metadata?.vulnerabilities ?? {};
  return Object.fromEntries(["critical", "high", "moderate", "low"].map((severity) => [
    severity,
    Number(vulns[severity] ?? 0)
  ]));
}

function subtractVulnerabilityCounts(full, runtime) {
  return Object.fromEntries(Object.keys(full).map((severity) => [
    severity,
    Math.max(0, Number(full[severity] ?? 0) - Number(runtime[severity] ?? 0))
  ]));
}

function vulnerabilityEvidence(counts) {
  return Object.entries(counts).map(([key, value]) => `${key}=${value}`).join("; ");
}

async function auditNpmSecurity(label, cwd, area) {
  const upperLabel = label.toUpperCase();
  if (!(await pathExists(path.join(cwd, "package.json")))) {
    addInfo(
      `NPM_${upperLabel}_NO_PACKAGE`,
      area,
      `No existe package.json en ${label}.`,
      normalizeSlashes(path.relative(rootDir, cwd)),
      "Confirmar la estructura del proyecto."
    );
    return;
  }

  const runtime = await runCommand("npm audit --omit=dev --json", {
    cwd,
    label: `npm audit ${label} runtime`,
    timeout: 120000,
    captureLimit: 10000
  });
  const development = await runCommand("npm audit --json", {
    cwd,
    label: `npm audit ${label} desarrollo`,
    timeout: 120000,
    captureLimit: 10000
  });
  const runtimeParsed = parseNpmAuditOutput(runtime.stdout || runtime.stderr);
  const developmentParsed = parseNpmAuditOutput(development.stdout || development.stderr);
  const runtimeCounts = npmVulnerabilityCounts(runtimeParsed);
  const developmentCounts = npmVulnerabilityCounts(developmentParsed);
  const developmentOnly = subtractVulnerabilityCounts(developmentCounts, runtimeCounts);
  const artifact = {
    runtime: runtimeParsed ?? { parseError: true, raw: redact(runtime.stdout || runtime.stderr || `exitCode=${runtime.exitCode}`) },
    development: developmentParsed ?? { parseError: true, raw: redact(development.stdout || development.stderr || `exitCode=${development.exitCode}`) }
  };
  await writeAuditArtifact(`npm-audit-${label}.json`, JSON.stringify(artifact, null, 2));
  const auditRecord = {
    label,
    runtime: runtimeCounts,
    development: developmentCounts,
    developmentOnly,
    runtimeParsed: Boolean(runtimeParsed),
    developmentParsed: Boolean(developmentParsed)
  };
  const audits = notes.get("npmAudits") ?? [];
  notes.set("npmAudits", [...audits.filter((item) => item.label !== label), auditRecord]);

  if (!runtimeParsed || !developmentParsed) {
    addFinding({
      code: `NPM_AUDIT_${upperLabel}_FAILED`,
      severity: "MEDIUM",
      area,
      description: `No se pudo interpretar completamente npm audit en ${label}.`,
      evidence: `runtime=${runtimeParsed ? "OK" : "sin JSON"}; desarrollo=${developmentParsed ? "OK" : "sin JSON"}`,
      recommendation: "Revisar los JSON completos generados en reports/logs y la conectividad al registry.",
      command: "npm audit --omit=dev --json; npm audit --json"
    });
  }

  if (runtimeParsed) {
    const { critical, high, moderate, low } = runtimeCounts;
    if (critical > 0 || high > 0) {
      addFinding({
        code: `NPM_AUDIT_${upperLabel}_RUNTIME_HIGH`,
        severity: critical > 0 ? "CRITICAL" : "HIGH",
        area,
        description: `npm audit encontro vulnerabilidades de runtime en ${label}.`,
        evidence: vulnerabilityEvidence(runtimeCounts),
        recommendation: "Revisar dependencias que llegan a produccion y actualizar sin ejecutar npm audit fix desde el auditor.",
        command: "npm audit --omit=dev --json"
      });
    } else if (moderate > 0 || low > 0) {
      addFinding({
        code: `NPM_AUDIT_${upperLabel}_RUNTIME_WARN`,
        severity: moderate > 0 ? "MEDIUM" : "LOW",
        area,
        description: `npm audit encontro vulnerabilidades no bloqueantes de runtime en ${label}.`,
        evidence: vulnerabilityEvidence(runtimeCounts),
        recommendation: "Planificar actualizaciones de dependencias runtime.",
        command: "npm audit --omit=dev --json"
      });
    } else {
      addOk(area, `npm audit runtime ${label} sin vulnerabilidades reportadas`, vulnerabilityEvidence(runtimeCounts), "npm audit --omit=dev --json");
    }
  }

  if (developmentParsed && Object.values(developmentOnly).some((value) => value > 0)) {
    const devSeverity = developmentOnly.critical > 0 || developmentOnly.high > 0
      ? "MEDIUM"
      : developmentOnly.moderate > 0 ? "LOW" : "INFO";
    if (devSeverity === "INFO") {
      addInfo(
        `NPM_AUDIT_${upperLabel}_DEVELOPMENT_WARN`,
        area,
        `npm audit encontro vulnerabilidades de baja severidad exclusivamente en dependencias de desarrollo de ${label}.`,
        vulnerabilityEvidence(developmentOnly),
        "Planificar su actualizacion sin tratarla como vulnerabilidad runtime."
      );
    } else {
      addFinding({
        code: `NPM_AUDIT_${upperLabel}_DEVELOPMENT_WARN`,
        severity: devSeverity,
        area,
        description: `npm audit encontro vulnerabilidades en tooling de desarrollo de ${label}; no se presentan como runtime.`,
        evidence: vulnerabilityEvidence(developmentOnly),
        recommendation: "Actualizar tooling de desarrollo y confirmar que no se incluya en el artefacto de produccion.",
        command: "npm audit --json"
      });
    }
  } else if (developmentParsed) {
    addOk(area, `npm audit desarrollo ${label} sin vulnerabilidades adicionales a runtime`, vulnerabilityEvidence(developmentOnly), "npm audit --json");
  }

  const outdated = await runCommand("npm outdated --json", {
    cwd,
    label: `npm outdated ${label}`,
    timeout: 120000,
    captureLimit: 10000
  });
  const outdatedRaw = outdated.stdout || outdated.stderr;
  if (!outdatedRaw.trim() && outdated.ok) {
    addOk(area, `Dependencias ${label} sin obsolescencia reportada`, "", "npm outdated --json");
    return;
  }
  try {
    const parsed = JSON.parse(outdatedRaw || "{}");
    const names = Object.keys(parsed);
    if (names.length) {
      addFinding({
        code: `NPM_OUTDATED_${label.toUpperCase()}`,
        severity: "LOW",
        area,
        description: `Hay dependencias obsoletas en ${label}.`,
        evidence: names.slice(0, 20).join(", "),
        recommendation: "Evaluar actualizaciones compatibles y probar build/test despues.",
        command: "npm outdated --json"
      });
    } else {
      addOk(area, `Dependencias ${label} sin obsolescencia reportada`, "", "npm outdated --json");
    }
  } catch {
    addInfo(
      `NPM_OUTDATED_${label.toUpperCase()}_SKIPPED`,
      area,
      `No se pudo determinar dependencias obsoletas en ${label}.`,
      outdatedRaw || `exitCode=${outdated.exitCode}`,
      "Reintentar con conectividad al registry si se requiere este dato.",
      "npm outdated --json"
    );
  }
}

async function auditDatabase(env) {
  const area = "Base de datos";
  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((name) => !env[name] && !process.env[name]);
  if (missing.length) {
    addFinding({
      code: "DB_ENV_MISSING",
      severity: "HIGH",
      area,
      description: "Faltan variables requeridas para conectar a PostgreSQL.",
      evidence: missing.join(", "),
      recommendation: "Completar backend/.env con DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD."
    });
    return;
  }

  let Pool;
  try {
    ({ Pool } = importPg());
  } catch (error) {
    addFinding({
      code: "PG_MODULE_MISSING",
      severity: "HIGH",
      area,
      description: "No se pudo cargar el modulo pg.",
      evidence: error.message,
      recommendation: "Ejecutar npm install en backend o revisar node_modules."
    });
    return;
  }

  const pool = new Pool({
    host: env.DB_HOST ?? process.env.DB_HOST,
    port: Number(env.DB_PORT ?? process.env.DB_PORT),
    database: env.DB_NAME ?? process.env.DB_NAME,
    user: env.DB_USER ?? process.env.DB_USER,
    password: env.DB_PASSWORD ?? process.env.DB_PASSWORD,
    options: "-c search_path=itam,public",
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    max: 2
  });

  async function queryDb(label, sql, params = []) {
    queries.push({ label, sql: sql.trim(), params: params.length ? params : undefined });
    return pool.query(sql, params);
  }

  try {
    const dbInfo = await queryDb(
      "conexion PostgreSQL",
      "SELECT NOW() AS database_time, current_database() AS database, current_user AS user"
    );
    addOk(area, "Conexion PostgreSQL exitosa", dbInfo.rows[0], "SELECT current_database()");
  } catch (error) {
    addFinding({
      code: "DB_CONNECTION_FAILED",
      severity: "HIGH",
      area,
      description: "No se pudo conectar a PostgreSQL.",
      evidence: error.message,
      recommendation: "Validar credenciales, host, puerto y disponibilidad del servicio PostgreSQL.",
      query: "SELECT current_database()"
    });
    await pool.end().catch(() => {});
    return;
  }

  const tableCache = new Map();
  const columnCache = new Map();

  async function schemaExists(schema) {
    const result = await queryDb(
      `schema ${schema}`,
      "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS exists",
      [schema]
    );
    return Boolean(result.rows[0]?.exists);
  }

  async function tableExists(table) {
    if (tableCache.has(table)) return tableCache.get(table);
    const result = await queryDb(
      `tabla ${table}`,
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'itam' AND table_name = $1
       ) AS exists`,
      [table]
    );
    const exists = Boolean(result.rows[0]?.exists);
    tableCache.set(table, exists);
    return exists;
  }

  async function columnExists(table, column) {
    const key = `${table}.${column}`;
    if (columnCache.has(key)) return columnCache.get(key);
    const result = await queryDb(
      `columna ${key}`,
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2
       ) AS exists`,
      [table, column]
    );
    const exists = Boolean(result.rows[0]?.exists);
    columnCache.set(key, exists);
    return exists;
  }

  const hasItamSchema = await schemaExists("itam");
  if (hasItamSchema) {
    addOk(area, "Schema itam existe", "itam", "information_schema.schemata");
  } else {
    addFinding({
      code: "DB_SCHEMA_ITAM_MISSING",
      severity: "HIGH",
      area,
      description: "No existe el schema itam.",
      evidence: "information_schema.schemata",
      recommendation: "Aplicar el esquema inicial en un entorno controlado; el auditor no ejecuta migraciones."
    });
    await pool.end().catch(() => {});
    return;
  }

  const migrationFiles = await listMigrationFiles();
  if (await tableExists("schema_migrations")) {
    addOk(area, "Tabla schema_migrations existe", "itam.schema_migrations");
    const migrationRows = await queryDb(
      "migraciones aplicadas",
      "SELECT version, nombre, aplicado_en FROM itam.schema_migrations ORDER BY version"
    );
    const applied = migrationRows.rows.map((row) => row.version);
    const { missingFiles, extraDb, outOfSequence } = migrationSequenceInfo(migrationFiles, applied);
    const last = migrationRows.rows.at(-1);
    const laterApplied = [...new Set(outOfSequence.flatMap((item) => item.laterApplied))];
    notes.set("migrations", { appliedCount: applied.length, last, missingFiles, extraDb, outOfSequence, laterApplied });
    if (missingFiles.length) {
      addFinding({
        code: "DB_MIGRATIONS_PENDING",
        severity: "HIGH",
        area,
        description: outOfSequence.length
          ? "Migracion fuera de secuencia detectada. Hay migraciones inferiores pendientes y migraciones superiores aplicadas."
          : "Hay migraciones del repositorio no registradas en la base de datos.",
        evidence: [
          `pendientes=${missingFiles.map((file) => file.file).join(", ")}`,
          `ultima_aplicada=${last ? `${last.version} ${last.nombre}` : "ninguna"}`,
          `versiones_posteriores_aplicadas=${laterApplied.join(", ") || "ninguna"}`
        ].join("\n"),
        recommendation: "Revisar y aplicar migraciones pendientes mediante el flujo oficial, no desde el auditor.",
        query: "SELECT version FROM itam.schema_migrations"
      });
    } else {
      addOk(area, "Migraciones del repositorio registradas en base de datos", `aplicadas=${applied.length}`);
    }
    if (extraDb.length) {
      addFinding({
        code: "DB_MIGRATIONS_UNKNOWN",
        severity: "MEDIUM",
        area,
        description: "La base de datos registra migraciones que no existen en el repositorio local.",
        evidence: extraDb.join(", "),
        recommendation: "Confirmar rama, respaldo o historial de migraciones."
      });
    }
    if (last) {
      addOk(area, "Ultima migracion aplicada detectada", `${last.version} ${last.nombre} ${last.aplicado_en}`);
    }
  } else {
    addFinding({
      code: "DB_SCHEMA_MIGRATIONS_MISSING",
      severity: "HIGH",
      area,
      description: "No existe itam.schema_migrations.",
      evidence: "itam.schema_migrations",
      recommendation: "Validar inicializacion del esquema; el auditor no crea tablas."
    });
  }

  const criticalTables = [
    "colaboradores",
    "departamentos",
    "dispositivos",
    "sim",
    "estados",
    "historial_eventos",
    "lineas_moviles",
    "actas_entrega",
    "comprobantes_devolucion"
  ];
  for (const table of criticalTables) {
    if (await tableExists(table)) {
      addOk(area, `Tabla critica presente: ${table}`, `itam.${table}`);
    } else {
      addFinding({
        code: `DB_TABLE_${table.toUpperCase()}_MISSING`,
        severity: "HIGH",
        area,
        description: `Falta tabla critica ${table}.`,
        evidence: `itam.${table}`,
        recommendation: "Revisar migraciones pendientes o schema incorrecto."
      });
    }
  }

  const criticalColumns = [
    ["sim", "linea_movil_id"],
    ["lineas_moviles", "numero_telefonico"],
    ["lineas_moviles", "dispositivo_id"],
    ["lineas_moviles", "sim_id"],
    ["lineas_moviles", "colaborador_id"]
  ];
  for (const [table, column] of criticalColumns) {
    if ((await tableExists(table)) && (await columnExists(table, column))) {
      addOk(area, `Columna critica presente: ${table}.${column}`);
    } else {
      addFinding({
        code: `DB_COLUMN_${table.toUpperCase()}_${column.toUpperCase()}_MISSING`,
        severity: "HIGH",
        area,
        description: `Falta columna critica ${table}.${column}.`,
        evidence: `itam.${table}.${column}`,
        recommendation: "Revisar migracion 028 y consistencia del schema."
      });
    }
  }

  async function runDataCheck(check) {
    const missingTables = [];
    for (const table of check.tables ?? []) {
      if (!(await tableExists(table))) missingTables.push(table);
    }
    const missingColumns = [];
    for (const [table, column] of check.columns ?? []) {
      if (!(await tableExists(table)) || !(await columnExists(table, column))) {
        missingColumns.push(`${table}.${column}`);
      }
    }
    if (missingTables.length || missingColumns.length) {
      addInfo(
        `${check.code}_SKIPPED`,
        check.area ?? area,
        `Consulta omitida por dependencias inexistentes: ${check.description}`,
        [...missingTables, ...missingColumns].join(", "),
        "Corregir schema/migraciones y volver a ejecutar auditoria.",
        undefined,
        check.sql
      );
      return;
    }
    try {
      const result = await queryDb(check.code, `SELECT COUNT(*)::int AS count FROM (${check.sql}) audit_subquery`);
      const count = Number(result.rows[0]?.count ?? 0);
      if (count > 0) {
        const sample = await queryDb(`${check.code} sample`, `${check.sql} LIMIT 20`);
        addFinding({
          code: check.code,
          severity: check.severity,
          area: check.area ?? area,
          description: check.description,
          evidence: `cantidad=${count}\n${JSON.stringify(sample.rows, null, 2)}`,
          recommendation: check.recommendation,
          query: check.sql
        });
      } else {
        addOk(check.area ?? area, check.okDescription ?? check.description, "cantidad=0", check.sql);
      }
    } catch (error) {
      addFinding({
        code: `${check.code}_QUERY_FAILED`,
        severity: "MEDIUM",
        area: check.area ?? area,
        description: `Fallo la consulta: ${check.description}`,
        evidence: error.message,
        recommendation: "Revisar compatibilidad del schema local y ajustar la auditoria si corresponde.",
        query: check.sql
      });
    }
  }

  const integrityChecks = [
    {
      code: "DB_DUP_DEVICE_ITAM_CODE",
      severity: "HIGH",
      description: "Codigos ITAM duplicados en dispositivos.",
      recommendation: "Unificar o corregir codigos de inventario duplicados.",
      tables: ["dispositivos"],
      columns: [["dispositivos", "codigo_inventario"]],
      sql: "SELECT codigo_inventario, COUNT(*) AS cantidad FROM itam.dispositivos GROUP BY codigo_inventario HAVING COUNT(*) > 1"
    },
    {
      code: "DB_DUP_SIM_ITAM_CODE",
      severity: "HIGH",
      description: "Codigos ITAM duplicados en SIM.",
      recommendation: "Unificar o corregir codigos de inventario duplicados.",
      tables: ["sim"],
      columns: [["sim", "codigo_inventario"]],
      sql: "SELECT codigo_inventario, COUNT(*) AS cantidad FROM itam.sim GROUP BY codigo_inventario HAVING COUNT(*) > 1"
    },
    {
      code: "DB_DUP_ITAM_CODE_BETWEEN_DEVICE_SIM",
      severity: "MEDIUM",
      description: "Codigos ITAM repetidos entre dispositivos y SIM.",
      recommendation: "Asegurar familias/rangos de codigo sin colision entre activos.",
      tables: ["dispositivos", "sim"],
      columns: [["dispositivos", "codigo_inventario"], ["sim", "codigo_inventario"]],
      sql: "SELECT d.codigo_inventario FROM itam.dispositivos d JOIN itam.sim s ON s.codigo_inventario = d.codigo_inventario"
    },
    {
      code: "DB_DUP_DEVICE_IMEI",
      severity: "HIGH",
      description: "IMEI duplicados en dispositivos.",
      recommendation: "Corregir fichas duplicadas o normalizar IMEI.",
      tables: ["dispositivos"],
      columns: [["dispositivos", "imei"]],
      sql: "SELECT BTRIM(imei) AS imei, COUNT(*) AS cantidad FROM itam.dispositivos WHERE NULLIF(BTRIM(imei), '') IS NOT NULL GROUP BY BTRIM(imei) HAVING COUNT(*) > 1"
    },
    {
      code: "DB_DUP_MOBILE_NUMBER",
      severity: "HIGH",
      description: "Numeros telefonicos duplicados en lineas_moviles.",
      recommendation: "Mantener una unica linea por numero normalizado.",
      tables: ["lineas_moviles"],
      columns: [["lineas_moviles", "numero_telefonico"]],
      sql: "SELECT REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') AS numero, COUNT(*) AS cantidad FROM itam.lineas_moviles GROUP BY REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') HAVING COUNT(*) > 1"
    },
    {
      code: "DB_DEVICE_TWO_CUSTODIANS",
      severity: "HIGH",
      description: "Dispositivos con colaborador_id y departamento_id al mismo tiempo.",
      recommendation: "Dejar solo un tipo de custodia activa por dispositivo.",
      tables: ["dispositivos"],
      columns: [["dispositivos", "colaborador_id"], ["dispositivos", "departamento_id"]],
      sql: "SELECT id, codigo_inventario, colaborador_id, departamento_id FROM itam.dispositivos WHERE colaborador_id IS NOT NULL AND departamento_id IS NOT NULL"
    },
    {
      code: "DB_SIM_ORPHAN_DEVICE",
      severity: "HIGH",
      description: "SIM asociadas a dispositivos inexistentes.",
      recommendation: "Corregir asociacion o restaurar dispositivo referenciado.",
      tables: ["sim", "dispositivos"],
      columns: [["sim", "dispositivo_id"]],
      sql: "SELECT s.id, s.codigo_inventario, s.dispositivo_id FROM itam.sim s LEFT JOIN itam.dispositivos d ON d.id = s.dispositivo_id WHERE s.dispositivo_id IS NOT NULL AND d.id IS NULL"
    },
    {
      code: "DB_LINE_ORPHAN_DEVICE",
      severity: "HIGH",
      description: "Lineas moviles asociadas a dispositivos inexistentes.",
      recommendation: "Corregir asociacion de linea movil.",
      tables: ["lineas_moviles", "dispositivos"],
      columns: [["lineas_moviles", "dispositivo_id"]],
      sql: "SELECT l.id, l.numero_telefonico, l.dispositivo_id FROM itam.lineas_moviles l LEFT JOIN itam.dispositivos d ON d.id = l.dispositivo_id WHERE l.dispositivo_id IS NOT NULL AND d.id IS NULL"
    },
    {
      code: "DB_LINE_ORPHAN_SIM",
      severity: "HIGH",
      description: "Lineas moviles asociadas a SIM inexistente.",
      recommendation: "Corregir asociacion de SIM en linea movil.",
      tables: ["lineas_moviles", "sim"],
      columns: [["lineas_moviles", "sim_id"]],
      sql: "SELECT l.id, l.numero_telefonico, l.sim_id FROM itam.lineas_moviles l LEFT JOIN itam.sim s ON s.id = l.sim_id WHERE l.sim_id IS NOT NULL AND s.id IS NULL"
    },
    {
      code: "DB_DEVICE_WITHOUT_STATE",
      severity: "HIGH",
      description: "Dispositivos sin estado valido.",
      recommendation: "Asignar estado valido del catalogo DISPOSITIVO.",
      tables: ["dispositivos", "estados"],
      columns: [["dispositivos", "estado_id"]],
      sql: "SELECT d.id, d.codigo_inventario, d.estado_id FROM itam.dispositivos d LEFT JOIN itam.estados e ON e.id = d.estado_id WHERE d.estado_id IS NULL OR e.id IS NULL"
    },
    {
      code: "DB_SIM_WITHOUT_STATE",
      severity: "HIGH",
      description: "SIM sin estado valido.",
      recommendation: "Asignar estado valido del catalogo SIM.",
      tables: ["sim", "estados"],
      columns: [["sim", "estado_id"]],
      sql: "SELECT s.id, s.codigo_inventario, s.estado_id FROM itam.sim s LEFT JOIN itam.estados e ON e.id = s.estado_id WHERE s.estado_id IS NULL OR e.id IS NULL"
    },
    {
      code: "DB_COLLABORATOR_WITHOUT_RUT",
      severity: "MEDIUM",
      description: "Colaboradores sin RUT.",
      recommendation: "Completar RUT canonico para colaboradores activos.",
      tables: ["colaboradores"],
      columns: [["colaboradores", "rut"]],
      sql: "SELECT id, nombre FROM itam.colaboradores WHERE NULLIF(BTRIM(rut), '') IS NULL"
    },
    {
      code: "DB_HISTORY_WITHOUT_EVENT_TYPE",
      severity: "HIGH",
      description: "historial_eventos sin tipo_evento.",
      recommendation: "Corregir registros historicos o investigar carga defectuosa.",
      tables: ["historial_eventos"],
      columns: [["historial_eventos", "tipo_evento"]],
      sql: "SELECT id, fecha_evento FROM itam.historial_eventos WHERE NULLIF(BTRIM(tipo_evento), '') IS NULL"
    }
  ];
  for (const check of integrityChecks) await runDataCheck(check);

  const hasLineRef = await columnExists("historial_eventos", "linea_movil_id");
  await runDataCheck({
    code: "DB_HISTORY_WITHOUT_ENTITY_REFERENCE",
    severity: "HIGH",
    description: "historial_eventos sin entidad o referencia.",
    recommendation: "Todo evento debe apuntar exactamente a una entidad ITAM.",
    tables: ["historial_eventos"],
    columns: [["historial_eventos", "tipo_entidad"], ["historial_eventos", "dispositivo_id"], ["historial_eventos", "sim_id"]],
    sql: hasLineRef
      ? "SELECT id, tipo_entidad, dispositivo_id, sim_id, linea_movil_id FROM itam.historial_eventos WHERE tipo_entidad IS NULL OR (dispositivo_id IS NULL AND sim_id IS NULL AND linea_movil_id IS NULL)"
      : "SELECT id, tipo_entidad, dispositivo_id, sim_id FROM itam.historial_eventos WHERE tipo_entidad IS NULL OR (dispositivo_id IS NULL AND sim_id IS NULL)"
  });

  await auditTraceability({ tableExists, columnExists, queryDb, runDataCheck });
  await auditOperationalConsistency({ tableExists, columnExists, runDataCheck });

  try {
    const recentEvents = await queryDb(
      "ultimos 20 eventos",
      `SELECT id, tipo_entidad, tipo_evento, responsable, fecha_evento
       FROM itam.historial_eventos
       ORDER BY fecha_evento DESC, id DESC
       LIMIT 20`
    );
    notes.set("recentEvents", recentEvents.rows);
    addOk("Trazabilidad", "Ultimos 20 eventos consultados", `eventos=${recentEvents.rows.length}`);
  } catch (error) {
    addFinding({
      code: "TRACE_RECENT_EVENTS_FAILED",
      severity: "MEDIUM",
      area: "Trazabilidad",
      description: "No se pudieron consultar los ultimos eventos.",
      evidence: error.message,
      recommendation: "Revisar tabla historial_eventos.",
      query: "SELECT ... FROM itam.historial_eventos ORDER BY fecha_evento DESC LIMIT 20"
    });
  }

  await pool.end().catch(() => {});
}

async function auditTraceability(ctx) {
  const area = "Trazabilidad";
  const criticalEvents = [
    "VERIFICACION_MANUAL_EQUIPO",
    "ASIGNAR_COLABORADOR",
    "DEVOLVER_DISPOSITIVO",
    "ASIGNAR_DEPARTAMENTO",
    "SIM_ASOCIADA_A_DISPOSITIVO",
    "LINEA_MOVIL_ASOCIADA_A_DISPOSITIVO",
    "LINEA_CONSERVADA_POR_REPOSICION",
    "LINEA_MOVIL_NUMERO_ACTUALIZADO"
  ];

  if (!(await ctx.tableExists("historial_eventos"))) {
    addFinding({
      code: "TRACE_HISTORY_TABLE_MISSING",
      severity: "HIGH",
      area,
      description: "No existe historial_eventos para revisar trazabilidad.",
      evidence: "itam.historial_eventos",
      recommendation: "Revisar migraciones."
    });
    return;
  }

  const result = await ctx.queryDb(
    "eventos criticos",
    "SELECT tipo_evento, COUNT(*)::int AS count FROM itam.historial_eventos WHERE tipo_evento = ANY($1) GROUP BY tipo_evento ORDER BY tipo_evento",
    [criticalEvents]
  );
  const found = new Map(result.rows.map((row) => [row.tipo_evento, Number(row.count)]));
  notes.set("criticalEvents", criticalEvents.map((event) => ({ event, count: found.get(event) ?? 0 })));
  for (const event of criticalEvents) {
    const count = found.get(event) ?? 0;
    if (classifyTraceabilityCount(count) === "OK") {
      addOk(area, `Evento critico presente: ${event}`, `cantidad=${count}`);
    } else {
      addInfo(
        `TRACE_EVENT_${event}_MISSING`,
        area,
        `No existen eventos registrados de tipo ${event}; no implica error por si solo.`,
        "cantidad=0",
        "Investigar solo si existe evidencia de que el proceso ocurrio y no se registro su historial.",
        undefined,
        "SELECT tipo_evento, COUNT(*) FROM itam.historial_eventos GROUP BY tipo_evento"
      );
    }
  }

  await ctx.runDataCheck({
    code: "TRACE_EVENTS_WITHOUT_RESPONSIBLE",
    severity: "HIGH",
    area,
    description: "Eventos sin responsable.",
    recommendation: "Todo movimiento debe identificar responsable.",
    tables: ["historial_eventos"],
    columns: [["historial_eventos", "responsable"]],
    sql: "SELECT id, tipo_evento, fecha_evento FROM itam.historial_eventos WHERE NULLIF(BTRIM(responsable), '') IS NULL"
  });

  await ctx.runDataCheck({
    code: "TRACE_EVENTS_WITHOUT_DATE",
    severity: "HIGH",
    area,
    description: "Eventos sin fecha.",
    recommendation: "Todo evento historico debe tener fecha_evento.",
    tables: ["historial_eventos"],
    columns: [["historial_eventos", "fecha_evento"]],
    sql: "SELECT id, tipo_evento FROM itam.historial_eventos WHERE fecha_evento IS NULL"
  });

  await ctx.runDataCheck({
    code: "TRACE_CRITICAL_EVENTS_EMPTY_METADATA",
    severity: "MEDIUM",
    area,
    description: "Eventos criticos con metadata vacia.",
    recommendation: "Agregar detalle JSON suficiente para reconstruir la decision operacional.",
    tables: ["historial_eventos"],
    columns: [["historial_eventos", "detalle"], ["historial_eventos", "tipo_evento"]],
    sql: `SELECT id, tipo_evento, fecha_evento
          FROM itam.historial_eventos
          WHERE tipo_evento = ANY(ARRAY['${criticalEvents.join("','")}'])
            AND (detalle IS NULL OR detalle = '{}'::jsonb)`
  });
}

async function auditOperationalConsistency(ctx) {
  const area = "Consistencia operacional";
  const checks = [
    {
      code: "OPS_DEVICE_TWO_CUSTODIANS",
      severity: "HIGH",
      area,
      description: "Un equipo tiene colaborador_id y departamento_id simultaneamente.",
      recommendation: "Resolver la custodia activa dejando solo persona o departamento.",
      tables: ["dispositivos"],
      columns: [["dispositivos", "colaborador_id"], ["dispositivos", "departamento_id"]],
      sql: "SELECT id, codigo_inventario, colaborador_id, departamento_id FROM itam.dispositivos WHERE colaborador_id IS NOT NULL AND departamento_id IS NOT NULL"
    },
    {
      code: "OPS_LOST_DEVICE_ACTIVE_CUSTODY",
      severity: "INFO",
      area,
      description: "Un equipo EXTRAVIADO conserva un responsable conocido; puede representar custodia activa o ultimo responsable historico.",
      recommendation: "Confirmar la semantica de colaborador_id/departamento_id antes de clasificarlo como inconsistencia; no modificarlo automaticamente.",
      tables: ["dispositivos", "estados"],
      columns: [["dispositivos", "estado_id"], ["dispositivos", "colaborador_id"], ["dispositivos", "departamento_id"], ["estados", "codigo"]],
      sql: "SELECT d.id, d.codigo_inventario, e.codigo, d.colaborador_id, d.departamento_id FROM itam.dispositivos d JOIN itam.estados e ON e.id = d.estado_id WHERE e.codigo = 'EXTRAVIADO' AND (d.colaborador_id IS NOT NULL OR d.departamento_id IS NOT NULL)"
    },
    {
      code: "OPS_RETIRED_DEVICE_ACTIVE_CUSTODY",
      severity: "HIGH",
      area,
      description: "Un equipo DADO_BAJA tiene custodia activa.",
      recommendation: "Cerrar custodia antes o durante la baja operacional.",
      tables: ["dispositivos", "estados"],
      columns: [["dispositivos", "estado_id"], ["dispositivos", "colaborador_id"], ["dispositivos", "departamento_id"], ["estados", "codigo"]],
      sql: "SELECT d.id, d.codigo_inventario, e.codigo, d.colaborador_id, d.departamento_id FROM itam.dispositivos d JOIN itam.estados e ON e.id = d.estado_id WHERE e.codigo = 'DADO_BAJA' AND (d.colaborador_id IS NOT NULL OR d.departamento_id IS NOT NULL)"
    },
    {
      code: "OPS_SIM_MULTIPLE_DEVICES",
      severity: "HIGH",
      area,
      description: "Una SIM aparece asociada a mas de un dispositivo.",
      recommendation: "Asegurar asociacion unica SIM-dispositivo.",
      tables: ["lineas_moviles"],
      columns: [["lineas_moviles", "sim_id"], ["lineas_moviles", "dispositivo_id"]],
      sql: "SELECT sim_id, COUNT(DISTINCT dispositivo_id) AS dispositivos FROM itam.lineas_moviles WHERE sim_id IS NOT NULL AND dispositivo_id IS NOT NULL GROUP BY sim_id HAVING COUNT(DISTINCT dispositivo_id) > 1"
    },
    {
      code: "OPS_ACTIVE_LINE_DUPLICATED",
      severity: "HIGH",
      area,
      description: "Una linea movil activa esta duplicada.",
      recommendation: "Conservar una unica linea activa por numero normalizado.",
      tables: ["lineas_moviles"],
      columns: [["lineas_moviles", "numero_telefonico"], ["lineas_moviles", "estado"]],
      sql: "SELECT REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') AS numero, COUNT(*) AS cantidad FROM itam.lineas_moviles WHERE estado = 'ACTIVA' GROUP BY REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') HAVING COUNT(*) > 1"
    },
    {
      code: "OPS_LINE_WITHOUT_OWNER",
      severity: "MEDIUM",
      area,
      description: "Una linea movil ACTIVA no esta asociada a SIM, dispositivo ni colaborador.",
      recommendation: "Asociar la linea activa a su relacion operacional correspondiente; no evaluar DADA_BAJA ni PENDIENTE_REPOSICION como faltas de propietario.",
      tables: ["lineas_moviles"],
      columns: [["lineas_moviles", "sim_id"], ["lineas_moviles", "dispositivo_id"], ["lineas_moviles", "colaborador_id"], ["lineas_moviles", "estado"]],
      sql: buildLineWithoutOwnerQuery()
    },
    {
      code: "OPS_PENDING_REPLACEMENT_WITH_SIM",
      severity: "LOW",
      area,
      description: "Una linea PENDIENTE_REPOSICION conserva sim_id.",
      recommendation: "Validar si la SIM extraviada/reemplazada debe desacoplarse.",
      tables: ["lineas_moviles"],
      columns: [["lineas_moviles", "sim_id"], ["lineas_moviles", "estado"]],
      sql: "SELECT id, numero_telefonico, sim_id FROM itam.lineas_moviles WHERE estado = 'PENDIENTE_REPOSICION' AND sim_id IS NOT NULL"
    },
    {
      code: "OPS_AUTOMATIC_MANUAL_VERIFICATION",
      severity: "MEDIUM",
      area,
      description: "La verificacion manual parece deducida de movimientos operativos.",
      recommendation: "Registrar VERIFICACION_MANUAL_EQUIPO solo con confirmacion manual explicita.",
      tables: ["historial_eventos"],
      columns: [["historial_eventos", "tipo_evento"], ["historial_eventos", "detalle"]],
      sql: "SELECT id, dispositivo_id, fecha_evento, detalle FROM itam.historial_eventos WHERE tipo_evento = 'VERIFICACION_MANUAL_EQUIPO' AND (detalle->>'motivo' ILIKE '%operativ%' OR detalle->>'origen' ILIKE '%automatic%' OR detalle->>'automatico' = 'true')"
    }
  ];
  for (const check of checks) await ctx.runDataCheck(check);
}

async function auditAvailability(env) {
  const area = "Disponibilidad";
  const backendPort = resolveBackendPort(env);
  if (backendPort === null) {
    addFinding({
      code: "BACKEND_PORT_INVALID",
      severity: "HIGH",
      area,
      description: "El PORT configurado para backend no es un puerto valido.",
      evidence: `PORT=${env.PORT ?? process.env.PORT ?? "ausente"}; se usara 3000 para la comprobacion`,
      recommendation: "Configurar PORT como entero entre 1 y 65535.",
      command: "backend/.env PORT"
    });
  }
  const effectiveBackendPort = backendPort ?? 3000;
  const backendBase = `127.0.0.1:${effectiveBackendPort}`;
  addOk(area, "Backend configurado", backendBase, `PORT=${effectiveBackendPort}`);
  await checkPort("127.0.0.1", effectiveBackendPort, area);
  await httpCheck(`http://127.0.0.1:${effectiveBackendPort}/api/v1/health`, "backend health", area, "HIGH");
  await httpCheck(`http://127.0.0.1:${effectiveBackendPort}/api/v1/health/database`, "backend database health", area, "HIGH");

  const frontendPackage = await readJson(path.join(frontendDir, "package.json")).catch(() => ({}));
  const requestedFrontendUrl = String(env.AUDIT_FRONTEND_URL ?? process.env.AUDIT_FRONTEND_URL ?? "").trim();
  if (requestedFrontendUrl) {
    try {
      new URL(requestedFrontendUrl);
    } catch {
      addFinding({
        code: "AUDIT_FRONTEND_URL_INVALID",
        severity: "MEDIUM",
        area,
        description: "AUDIT_FRONTEND_URL no es una URL valida.",
        evidence: "Se omitio el valor para no mostrar configuracion ambigua.",
        recommendation: "Usar una URL completa, por ejemplo https://127.0.0.1:4200."
      });
    }
  }
  const frontendConfig = detectFrontendConfig(frontendPackage, { ...env, ...process.env }, detectLanAddress());
  const frontend = await httpCheck(frontendConfig.url, `frontend ${frontendConfig.protocol.toUpperCase()} ${frontendConfig.port}`, area, "INFO", {
    allowSelfSigned: frontendConfig.protocol === "https"
  });
  addOk(area, "Frontend configurado", frontendConfig.url, `${frontendConfig.scriptName}: ${frontendConfig.script || "URL explicita"}`);
  if (!frontend.ok) {
    addInfo(
      "FRONTEND_OPTIONAL",
      area,
      "Frontend no esta levantado o no responde; esto es informativo salvo que se solicite auditoria visual.",
      frontendConfig.url,
      "Levantar el frontend si se desea validar disponibilidad web o generar capturas."
    );
  }

  addOk(area, "Sistema operativo detectado", `${os.type()} ${os.release()} ${os.arch()}`);
  addOk(area, "Memoria disponible detectada", `${Math.round(os.freemem() / 1024 / 1024)} MB libres de ${Math.round(os.totalmem() / 1024 / 1024)} MB`);

  const node = await runCommand("node --version", { label: "node --version" });
  if (node.ok) addOk(area, "Version Node detectada", node.stdout.trim(), "node --version");
  else addFinding({
    code: "NODE_VERSION_FAILED",
    severity: "MEDIUM",
    area,
    description: "No se pudo obtener version Node.",
    evidence: node.stderr,
    recommendation: "Revisar instalacion de Node.",
    command: "node --version"
  });

  const npm = await runCommand("npm --version", { label: "npm --version" });
  if (npm.ok) addOk(area, "Version npm detectada", npm.stdout.trim(), "npm --version");
  else addFinding({
    code: "NPM_VERSION_FAILED",
    severity: "MEDIUM",
    area,
    description: "No se pudo obtener version npm.",
    evidence: npm.stderr,
    recommendation: "Revisar instalacion de npm.",
    command: "npm --version"
  });

  await auditDiskSpace(area);
  return { frontendConfig, frontend };
}

async function findPlaywrightModule() {
  const packagePaths = [
    path.join(frontendDir, "node_modules", "playwright", "package.json"),
    path.join(frontendDir, "node_modules", "@playwright", "test", "package.json"),
    path.join(rootDir, "node_modules", "playwright", "package.json")
  ];
  for (const packagePath of packagePaths) {
    if (!(await pathExists(packagePath))) continue;
    try {
      const packageJson = await readJson(packagePath);
      const entry = path.resolve(path.dirname(packagePath), packageJson.main ?? "index.js");
      return await import(pathToFileURL(entry).href);
    } catch {
      // Probar el siguiente paquete disponible sin instalar nada.
    }
  }
  return null;
}

function visualPageSlug(pathname) {
  return pathname.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "dashboard";
}

async function waitForFrontendStability(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await page.locator(".spin").first().waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function captureVisualPage(browserContext, baseUrl, target) {
  const page = await browserContext.newPage();
  const evidence = {
    name: target.name,
    path: target.path,
    file: `audit-screenshots/${auditRunStamp}/${target.file}`,
    pageErrors: [],
    consoleErrors: [],
    requestsFailed: [],
    http5xx: [],
    status: "OK"
  };
  page.on("pageerror", (error) => evidence.pageErrors.push(String(error?.message ?? error)));
  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => evidence.requestsFailed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
  page.on("response", (response) => {
    if (response.status() >= 500) evidence.http5xx.push(`${response.status()} ${response.url()}`);
  });
  try {
    await page.goto(`${baseUrl}${target.path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await waitForFrontendStability(page);
    await page.screenshot({ path: path.join(auditScreenshotDir, target.file), fullPage: true });
  } catch (error) {
    evidence.pageErrors.push(`navigation: ${error.message}`);
  } finally {
    await page.close().catch(() => {});
  }
  const criticalErrors = evidence.pageErrors.length + evidence.requestsFailed.length + evidence.http5xx.length;
  if (criticalErrors) {
    evidence.status = "MEDIUM";
    addFinding({
      code: `VISUAL_${target.file.replace(/\.png$/, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`,
      severity: "MEDIUM",
      area: "Evidencia visual",
      description: `La pagina ${target.name} genero errores durante la auditoria visual.`,
      evidence: JSON.stringify({
        pageErrors: evidence.pageErrors,
        requestsFailed: evidence.requestsFailed,
        http5xx: evidence.http5xx
      }),
      recommendation: "Revisar errores JavaScript, requests fallidas y respuestas HTTP 500+ de la pagina.",
      command: `Playwright ${target.path}`
    });
  } else {
    addOk("Evidencia visual", `${target.name} capturada sin errores`, evidence.file, `Playwright ${target.path}`);
  }
  return evidence;
}

async function auditVisual(frontendConfig, frontendCheck, env) {
  const enabled = String(env.AUDIT_SCREENSHOTS ?? process.env.AUDIT_SCREENSHOTS ?? "").toLowerCase() === "true";
  const visual = { enabled, frontendUrl: frontendConfig.url, authenticated: false, pages: [] };
  notes.set("visual", visual);
  if (!enabled) {
    addInfo("VISUAL_DISABLED", "Evidencia visual", "Auditoria visual omitida porque AUDIT_SCREENSHOTS no esta configurado como true.", "Definir AUDIT_SCREENSHOTS=true para habilitar capturas.");
    return;
  }
  if (!frontendCheck.ok) {
    addInfo("VISUAL_FRONTEND_UNAVAILABLE", "Evidencia visual", "Auditoria visual omitida porque el frontend no esta disponible.", frontendConfig.url, "Levantar el frontend y repetir con AUDIT_SCREENSHOTS=true.");
    return;
  }
  const playwright = await findPlaywrightModule();
  if (!playwright) {
    addInfo("VISUAL_PLAYWRIGHT_MISSING", "Evidencia visual", "Auditoria visual omitida: Playwright no esta disponible.", "No se instalo ninguna dependencia automaticamente.", "Instalar Playwright fuera del auditor si se requiere esta evidencia.");
    return;
  }
  const credentials = {
    user: String(env.AUDIT_LOGIN_USER ?? process.env.AUDIT_LOGIN_USER ?? "").trim(),
    password: String(env.AUDIT_LOGIN_PASSWORD ?? process.env.AUDIT_LOGIN_PASSWORD ?? ""),
    pin: String(env.AUDIT_LOGIN_PIN ?? process.env.AUDIT_LOGIN_PIN ?? "")
  };
  const hasCredentials = Boolean(credentials.user && (credentials.password || credentials.pin));
  const browserType = playwright.chromium ?? playwright.default?.chromium;
  if (!browserType) {
    addInfo("VISUAL_PLAYWRIGHT_INVALID", "Evidencia visual", "Playwright esta disponible pero no expone chromium.", "No se realizaron capturas.");
    return;
  }
  await fs.mkdir(auditScreenshotDir, { recursive: true });
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } });
  try {
    const loginPage = await context.newPage();
    await loginPage.goto(`${frontendConfig.url}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await waitForFrontendStability(loginPage);
    if (!hasCredentials) {
      await loginPage.screenshot({ path: path.join(auditScreenshotDir, "00-login.png"), fullPage: true });
      visual.pages.push({ name: "Login", path: "/login", file: `audit-screenshots/${auditRunStamp}/00-login.png`, pageErrors: [], consoleErrors: [], requestsFailed: [], http5xx: [], status: "OK" });
      addInfo("VISUAL_LOGIN_NOT_AUTHENTICATED", "Evidencia visual", "No se realizaron capturas autenticadas porque no se configuraron credenciales de auditoria.", "Solo se capturo la pantalla de login.");
      await loginPage.close();
      return;
    }
    await loginPage.getByLabel("Correo").fill(credentials.user);
    if (credentials.pin) {
      await loginPage.getByLabel("PIN de 6 dígitos").fill(credentials.pin);
    } else {
      await loginPage.getByRole("button", { name: "Contraseña" }).click();
      await loginPage.getByLabel("Contraseña").fill(credentials.password);
    }
    await loginPage.getByRole("button", { name: "Ingresar" }).click();
    await loginPage.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 }).catch(() => {});
    visual.authenticated = !loginPage.url().endsWith("/login");
    if (!visual.authenticated) {
      await loginPage.screenshot({ path: path.join(auditScreenshotDir, "00-login.png"), fullPage: true });
      addInfo("VISUAL_LOGIN_FAILED", "Evidencia visual", "No fue posible completar el login de auditoria; se capturo la pantalla resultante.", "Verificar credenciales AUDIT_LOGIN_* sin imprimirlas.");
      await loginPage.close();
      return;
    }
    await loginPage.close();
    const targets = [
      { name: "Dashboard", path: "/dashboard", file: "01-dashboard.png" },
      { name: "Inventario", path: "/dispositivos", file: "02-inventario.png" },
      { name: "Alertas stock", path: "/alertas-stock", file: "03-alertas-stock.png" },
      { name: "Colaboradores", path: "/colaboradores", file: "04-colaboradores.png" },
      { name: "Departamentos", path: "/departamentos", file: "05-departamentos.png" },
      { name: "Tarjetas SIM", path: "/sim", file: "06-tarjetas-sim.png" },
      { name: "Offboarding", path: "/offboarding", file: "07-offboarding.png" }
    ];
    for (const target of targets) visual.pages.push(await captureVisualPage(context, frontendConfig.url, target));
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function auditDiskSpace(area) {
  const driveRoot = path.parse(rootDir).root;
  let command;
  if (process.platform === "win32") {
    const driveName = driveRoot.replace(":\\", "");
    command = `powershell -NoProfile -Command "(Get-PSDrive -Name '${driveName}').Free"`;
  } else {
    command = `df -Pk "${rootDir}"`;
  }
  const result = await runCommand(command, { label: "espacio libre en disco" });
  if (!result.ok) {
    addFinding({
      code: "DISK_SPACE_FAILED",
      severity: "LOW",
      area,
      description: "No se pudo calcular espacio libre en disco.",
      evidence: result.stderr,
      recommendation: "Verificar manualmente espacio libre del volumen del proyecto.",
      command
    });
    return;
  }
  if (process.platform === "win32") {
    const bytes = Number(result.stdout.trim());
    if (Number.isFinite(bytes)) {
      const gb = bytes / 1024 / 1024 / 1024;
      if (gb < 2) {
        addFinding({
          code: "DISK_SPACE_LOW",
          severity: "MEDIUM",
          area,
          description: "Espacio libre bajo en el disco del proyecto.",
          evidence: `${gb.toFixed(2)} GB libres`,
          recommendation: "Liberar espacio antes de builds, backups o migraciones.",
          command
        });
      } else {
        addOk(area, "Espacio libre en disco suficiente", `${gb.toFixed(2)} GB libres`, command);
      }
    }
  } else {
    addOk(area, "Espacio libre en disco consultado", result.stdout.trim(), command);
  }
}

async function auditCodeAndTests() {
  const area = "Codigo y pruebas";
  const gitStatus = await runCommand("git status --short", { label: "git status --short" });
  if (gitStatus.ok) addOk(area, "git status ejecutado", gitStatus.stdout.trim() || "sin cambios", "git status --short");
  else addFinding({
    code: "CODE_GIT_STATUS_FAILED",
    severity: "MEDIUM",
    area,
    description: "Fallo git status --short.",
    evidence: gitStatus.stderr,
    recommendation: "Revisar repositorio Git.",
    command: "git status --short"
  });

  const diffCheck = await runCommand("git diff --check", { label: "git diff --check" });
  if (diffCheck.ok) addOk(area, "git diff --check sin errores", diffCheck.stdout.trim(), "git diff --check");
  else addFinding({
    code: "CODE_GIT_DIFF_CHECK_FAILED",
    severity: "MEDIUM",
    area,
    description: "git diff --check detecto problemas.",
    evidence: diffCheck.stdout || diffCheck.stderr,
    recommendation: "Corregir whitespace errors antes de commit.",
    command: "git diff --check"
  });

  const backendPackage = await readJson(path.join(backendDir, "package.json")).catch(() => null);
  const frontendPackage = await readJson(path.join(frontendDir, "package.json")).catch(() => null);

  await runNpmScriptCheck("backend", backendDir, backendPackage, "build", "npm run build", "HIGH");
  await runNpmScriptCheck("backend", backendDir, backendPackage, "typecheck", "npm run typecheck", "HIGH", true);
  await runNpmScriptCheck("backend", backendDir, backendPackage, "test", "npm test", "HIGH", true);

  await runNpmScriptCheck("frontend", frontendDir, frontendPackage, "build", "npm run build", "HIGH");
  await runNpmScriptCheck("frontend", frontendDir, frontendPackage, "typecheck", "npm run typecheck", "HIGH", true);
  await runNpmScriptCheck("frontend", frontendDir, frontendPackage, "test", "npm run test -- --watch=false", "HIGH", true);
}

async function runNpmScriptCheck(label, cwd, packageJson, scriptName, command, severityWhenFails, optional = false) {
  const area = "Codigo y pruebas";
  if (!packageJson) {
    addFinding({
      code: `CODE_${label.toUpperCase()}_PACKAGE_MISSING`,
      severity: "HIGH",
      area,
      description: `No se pudo leer package.json de ${label}.`,
      evidence: normalizeSlashes(path.relative(rootDir, cwd)),
      recommendation: "Restaurar package.json."
    });
    return;
  }
  if (!hasScript(packageJson, scriptName)) {
    const message = `${label} no define script ${scriptName}.`;
    if (optional) {
      addInfo(
        `CODE_${label.toUpperCase()}_${scriptName.toUpperCase()}_MISSING`,
        area,
        message,
        "script ausente",
        "Agregar el script si el proyecto requiere esta validacion."
      );
    } else {
      addFinding({
        code: `CODE_${label.toUpperCase()}_${scriptName.toUpperCase()}_MISSING`,
        severity: "MEDIUM",
        area,
        description: message,
        evidence: "script ausente",
        recommendation: "Agregar script de build/test requerido."
      });
    }
    return;
  }
  const result = await runCommand(command, {
    cwd,
    label: `${label} ${command}`,
    timeout: 180000,
    captureLimit: 12000
  });
  if (scriptName === "build" || scriptName === "test") {
    const fileName = scriptName === "build" ? `${label}-build.log` : `${label}-tests.log`;
    await writeAuditArtifact(
      fileName,
      [
        `command=${command}`,
        `cwd=${cwd}`,
        `exitCode=${result.exitCode ?? ""}`,
        "",
        "--- stdout ---",
        redact(result.stdout ?? ""),
        "",
        "--- stderr ---",
        redact(result.stderr ?? "")
      ].join("\n")
    );
  }
  if (result.ok) {
    addOk(area, `${label} ${command} exitoso`, compact(result.stdout || result.stderr, 1000), command);
  } else {
    addFinding({
      code: `CODE_${label.toUpperCase()}_${scriptName.toUpperCase()}_FAILED`,
      severity: severityWhenFails,
      area,
      description: `${label} ${command} fallo.`,
      evidence: failureEvidence([result.record.stdout, result.record.stderr].filter(Boolean).join("\n")),
      recommendation: "Corregir errores de build/typecheck/test antes de promover cambios.",
      command
    });
  }
}

function renderSeverityTable() {
  return [
    "| Severidad | Cantidad |",
    "| --- | ---: |",
    ...["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO", "OK"].map((severity) => `| ${severity} | ${counts[severity]} |`)
  ].join("\n");
}

function renderFindingsTable(items) {
  if (!items.length) return "Sin hallazgos.";
  return [
    "| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |",
    "| --- | --- | --- | --- | --- |",
    ...items.map((item) =>
      `| ${escapeMd(item.code)} | ${item.severity} | ${escapeMd(item.description)} | ${escapeMd(item.evidence)} | ${escapeMd(item.recommendation)} |`
    )
  ].join("\n");
}

function renderOkTable(items) {
  if (!items.length) return "Sin checks OK registrados.";
  return [
    "| Area | Check | Evidencia |",
    "| --- | --- | --- |",
    ...items.map((item) => `| ${escapeMd(item.area)} | ${escapeMd(item.description)} | ${escapeMd(item.evidence)} |`)
  ].join("\n");
}

function renderCommandTable() {
  if (!commands.length) return "Sin comandos ejecutados.";
  return [
    "| Comando | CWD | Exit | Resumen |",
    "| --- | --- | ---: | --- |",
    ...commands.map((item) => {
      const summary = item.stdout || item.stderr || (item.timedOut ? "timeout" : "");
      return `| ${escapeMd(item.command)} | ${escapeMd(item.cwd)} | ${item.exitCode ?? ""} | ${escapeMd(redact(compact(summary, 500)))} |`;
    })
  ].join("\n");
}

function renderQueryTable() {
  if (!queries.length) return "Sin consultas ejecutadas.";
  return [
    "| Consulta | SQL |",
    "| --- | --- |",
    ...queries.map((item) => `| ${escapeMd(item.label)} | ${escapeMd(item.sql)} |`)
  ].join("\n");
}

function renderNotes() {
  const parts = [];
  const migrations = notes.get("migrations");
  if (migrations) {
    parts.push("### Migraciones");
    parts.push(`- Aplicadas: ${migrations.appliedCount}`);
    parts.push(`- Ultima: ${migrations.last ? `${migrations.last.version} ${migrations.last.nombre}` : "no detectada"}`);
    parts.push(`- Pendientes segun repo: ${migrations.missingFiles?.length ?? 0}`);
  }
  const criticalEvents = notes.get("criticalEvents");
  if (criticalEvents) {
    parts.push("### Eventos criticos");
    parts.push("| Evento | Cantidad |");
    parts.push("| --- | ---: |");
    for (const row of criticalEvents) parts.push(`| ${escapeMd(row.event)} | ${row.count} |`);
  }
  const recentEvents = notes.get("recentEvents");
  if (recentEvents) {
    parts.push("### Ultimos 20 eventos");
    parts.push("| ID | Entidad | Evento | Responsable | Fecha |");
    parts.push("| --- | --- | --- | --- | --- |");
    for (const row of recentEvents) {
      parts.push(`| ${row.id} | ${escapeMd(row.tipo_entidad)} | ${escapeMd(row.tipo_evento)} | ${escapeMd(row.responsable)} | ${escapeMd(row.fecha_evento)} |`);
    }
  }
  return parts.join("\n");
}

function renderAreaBlock(area) {
  const areaFindings = findings.filter((item) => item.area === area);
  const areaChecks = okChecks.filter((item) => item.area === area);
  return [
    "### Hallazgos",
    renderFindingsTable(areaFindings),
    "### Checks OK",
    renderOkTable(areaChecks)
  ].join("\n\n");
}

function renderVisualEvidence() {
  const visual = notes.get("visual");
  if (!visual?.enabled) return "Auditoria visual no habilitada. Definir `AUDIT_SCREENSHOTS=true` para capturar el frontend.";
  if (!visual.pages?.length) return "No se generaron capturas.";
  return visual.pages.map((page) => {
    const errors = page.pageErrors.length + page.consoleErrors.length + page.requestsFailed.length + page.http5xx.length;
    return [
      `### ${escapeMd(page.name)}`,
      `Estado: ${page.status}`,
      "",
      `Captura: ![${escapeMd(page.name)}](${page.file})`,
      "",
      `Errores de consola: ${page.consoleErrors.length + page.pageErrors.length}`,
      `Requests fallidas criticas: ${page.requestsFailed.length + page.http5xx.length}`,
      errors ? `Detalle: ${escapeMd(JSON.stringify({ pageErrors: page.pageErrors, consoleErrors: page.consoleErrors, requestsFailed: page.requestsFailed, http5xx: page.http5xx }))}` : ""
    ].join("\n");
  }).join("\n\n");
}

function renderMigrationSection() {
  const migration = notes.get("migrations");
  if (!migration) return "No se pudo obtener evidencia de migraciones.";
  const pending = migration.missingFiles?.map((file) => file.file).join(", ") || "ninguna";
  const later = migration.laterApplied?.join(", ") || "ninguna";
  return [
    `Aplicadas: ${migration.appliedCount}`,
    `Ultima aplicada: ${migration.last ? `${migration.last.version} ${migration.last.nombre}` : "no detectada"}`,
    `Pendientes segun repositorio: ${pending}`,
    `Versiones posteriores aplicadas: ${later}`,
    migration.outOfSequence?.length ? "Diagnostico: Migracion fuera de secuencia detectada." : "Diagnostico: sin evidencia de migracion fuera de secuencia."
  ].join("\n");
}

function renderDependencySection() {
  const audits = notes.get("npmAudits") ?? [];
  if (!audits.length) return "No se generaron resultados npm audit.";
  return [
    "| Proyecto | Runtime (omit=dev) | Desarrollo adicional |",
    "| --- | --- | --- |",
    ...audits.map((audit) => `| ${audit.label} | ${escapeMd(vulnerabilityEvidence(audit.runtime))} | ${escapeMd(vulnerabilityEvidence(audit.developmentOnly))} |`)
  ].join("\n");
}

function renderLogsSection() {
  const logs = notes.get("logs") ?? [];
  if (!logs.length) return "No se generaron logs de comandos.";
  return logs.map((file) => `- [${file}](logs/${auditRunStamp}/${file})`).join("\n");
}

function renderReport() {
  const hasCriticalOrHigh = counts.CRITICAL > 0 || counts.HIGH > 0;
  const status = hasCriticalOrHigh
    ? "NO APTO: existen hallazgos CRITICAL/HIGH."
    : counts.MEDIUM > 0 || counts.LOW > 0
      ? "APTO CON ADVERTENCIAS: revisar hallazgos antes de promover."
      : "APTO: sin hallazgos bloqueantes.";

  const knownAreas = ["Base de datos", "Seguridad", "Consistencia operacional", "Disponibilidad", "Codigo y pruebas", "Trazabilidad"];
  const otherAreas = [...new Set([...findings.map((item) => item.area), ...okChecks.map((item) => item.area)])]
    .filter((area) => !knownAreas.includes(area) && area !== "Evidencia visual")
    .sort((a, b) => a.localeCompare(b));
  return `# Auditoria automatizada integral ITAM

Generado: ${new Date().toISOString()}
Proyecto: ${normalizeSlashes(rootDir)}

## 1. Resumen ejecutivo

Estado general: **${status}**

${renderSeverityTable()}

## 2. Hallazgos bloqueantes reales

${renderFindingsTable(findings.filter((item) => item.severity === "CRITICAL" || item.severity === "HIGH"))}

## 3. Advertencias

${renderFindingsTable(findings.filter((item) => ["MEDIUM", "LOW", "INFO"].includes(item.severity)))}

## 4. Base de datos

${renderAreaBlock("Base de datos")}

## 5. Seguridad

${renderAreaBlock("Seguridad")}

## 6. Consistencia operacional

${renderAreaBlock("Consistencia operacional")}

## 7. Disponibilidad

${renderAreaBlock("Disponibilidad")}

## 8. Codigo y pruebas

${renderAreaBlock("Codigo y pruebas")}

## 9. Trazabilidad

${renderAreaBlock("Trazabilidad")}

## 10. Evidencia visual

${renderVisualEvidence()}

## 11. Migraciones

${renderMigrationSection()}

## 12. Dependencias

${renderDependencySection()}

## 13. Logs generados

${renderLogsSection()}

## Consultas ejecutadas

${renderQueryTable()}

## Comandos ejecutados

${renderCommandTable()}

## Recomendaciones finales

- Corregir primero CRITICAL y HIGH confirmados; el auditor saldra con codigo 1 mientras existan.
- Revisar MEDIUM antes de despliegues o respaldos operacionales.
- Mantener secretos fuera de Git y rotar cualquier secreto que haya aparecido en diff o archivos versionados.
- No ejecutar migraciones sin respaldo y sin revisar el resultado de esta auditoria.

## 14. Checklist antes de commit

- [ ] git status solo contiene cambios esperados.
- [ ] git diff --check pasa sin errores.
- [ ] No hay .env ni secretos en el indice, diff o archivos versionados.
- [ ] backend build/typecheck/test revisados.
- [ ] frontend build/typecheck/test revisados segun scripts disponibles.
- [ ] El informe de auditoria fue leido y los hallazgos bloqueantes fueron resueltos o documentados.

## 15. Checklist antes de produccion

- [ ] NODE_ENV=production.
- [ ] CORS_ORIGIN usa origen explicito.
- [ ] JWT_SECRET y SESSION_SECRET existen y son robustos cuando backend/src los utiliza.
- [ ] PostgreSQL responde y schema itam esta completo.
- [ ] Migraciones aplicadas coinciden con database/migrations.
- [ ] Health checks del backend y base de datos responden.
- [ ] No hay inconsistencias criticas de custodia, lineas moviles, SIM o historial.
- [ ] Hay respaldo vigente antes de cambios de base de datos.
`;
}

async function main() {
  auditRunStamp = nowStamp();
  auditLogDir = path.join(reportsDir, "logs", auditRunStamp);
  auditScreenshotDir = path.join(reportsDir, "audit-screenshots", auditRunStamp);
  await fs.mkdir(reportsDir, { recursive: true });
  const env = await loadBackendEnv();

  await auditSecurity(env);
  await auditDatabase(env);
  const availability = await auditAvailability(env);
  await auditVisual(availability.frontendConfig, availability.frontend, { ...env, ...process.env });
  await auditCodeAndTests();
  notes.set("logs", await fs.readdir(auditLogDir).catch(() => []));

  const reportPath = path.join(reportsDir, `itam-environment-audit-${auditRunStamp}.md`);
  await fs.writeFile(reportPath, renderReport(), "utf8");

  console.log(`OK: ${counts.OK}`);
  console.log(`INFO: ${counts.INFO}`);
  console.log(`LOW: ${counts.LOW}`);
  console.log(`MEDIUM: ${counts.MEDIUM}`);
  console.log(`HIGH: ${counts.HIGH}`);
  console.log(`CRITICAL: ${counts.CRITICAL}`);
  console.log(`Informe: ${reportPath}`);

  process.exitCode = counts.CRITICAL > 0 || counts.HIGH > 0 ? 1 : 0;
}

async function runMain() {
  try {
    await main();
  } catch (error) {
    auditRunStamp ||= nowStamp();
    auditLogDir ||= path.join(reportsDir, "logs", auditRunStamp);
    auditScreenshotDir ||= path.join(reportsDir, "audit-screenshots", auditRunStamp);
  await fs.mkdir(reportsDir, { recursive: true }).catch(() => {});
  addFinding({
    code: "AUDIT_FATAL",
    severity: "CRITICAL",
    area: "Auditor",
    description: "El auditor fallo de forma inesperada.",
    evidence: error.stack ?? error.message,
    recommendation: "Revisar excepcion y corregir el script o entorno antes de confiar en el resultado."
  });
  const reportPath = path.join(reportsDir, `itam-environment-audit-${auditRunStamp}.md`);
  await fs.writeFile(reportPath, renderReport(), "utf8").catch(() => {});
  console.error(error);
  console.log(`OK: ${counts.OK}`);
  console.log(`INFO: ${counts.INFO}`);
  console.log(`LOW: ${counts.LOW}`);
  console.log(`MEDIUM: ${counts.MEDIUM}`);
  console.log(`HIGH: ${counts.HIGH}`);
  console.log(`CRITICAL: ${counts.CRITICAL}`);
  console.log(`Informe: ${reportPath}`);
  process.exitCode = 1;
  }
}

export {
  buildLineWithoutOwnerQuery,
  classifyTraceabilityCount,
  detectFrontendConfig,
  extractMeaningfulSecretName,
  failureEvidence,
  findPlaywrightModule,
  isMeaningfulSecretLine,
  isRobustSecretValue,
  migrationSequenceInfo,
  parsePort,
  redact,
  resolveBackendPort,
  summarizeFailureOutput
};

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) void runMain();
