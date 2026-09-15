#!/usr/bin/env node
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import fs from "node:fs/promises";
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
    .replace(/(DB_PASSWORD\s*[=:]\s*)([^\s"'`]+)/gi, "$1[REDACTED]")
    .replace(/((JWT_SECRET|SESSION_SECRET|API_KEY|TOKEN)\s*[=:]\s*)([^\s"'`]+)/gi, "$1[REDACTED]")
    .replace(/(password=)([^&\s]+)/gi, "$1[REDACTED]");
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
    record.stdout = compact(error.stdout ?? "", options.captureLimit ?? 6000);
    record.stderr = compact(error.stderr ?? error.message ?? "", options.captureLimit ?? 6000);
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

async function httpCheck(url, label, area, severityWhenDown = "MEDIUM") {
  const started = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const elapsed = Math.round(performance.now() - started);
    const body = await response.text();
    if (response.ok) {
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

function isMeaningfulSecretLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return false;
  if (!/(DB_PASSWORD|JWT_SECRET|SESSION_SECRET|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|SECRET_KEY)/i.test(trimmed)) {
    return false;
  }
  if (!/[=:]/.test(trimmed)) return false;
  if (/change_me|example|placeholder|your_|process\.env|import\.meta\.env/i.test(trimmed)) return false;
  const value = trimmed.split(/[=:]/).slice(1).join("=").trim().replace(/^["']|["']$/g, "");
  return value.length >= 8;
}

function looksText(buffer) {
  if (buffer.includes(0)) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8");
  return !/[\u0000-\u0008\u000E-\u001F]/.test(sample);
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
      if (/package-lock\.json$|\.xlsx$|\.png$|\.jpg$|\.jpeg$|\.pdf$|\.ico$|\.pem$/i.test(file)) continue;
      const absolute = path.join(rootDir, file);
      try {
        const stat = await fs.stat(absolute);
        if (stat.size > 1024 * 1024) continue;
        const buffer = await fs.readFile(absolute);
        if (!looksText(buffer)) continue;
        const lines = buffer.toString("utf8").split(/\r?\n/);
        lines.forEach((line, index) => {
          if (isMeaningfulSecretLine(line) || /-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/.test(line)) {
            secretHits.push(`${file}:${index + 1}: ${redact(line.trim())}`);
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
      evidence: addedSecretLines.map(redact).slice(0, 30).join("\n"),
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
    if (!env[secretName] && !process.env[secretName]) {
      addFinding({
        code: `${secretName}_MISSING`,
        severity: "HIGH",
        area,
        description: `Falta ${secretName}.`,
        evidence: `${secretName}=ausente`,
        recommendation: `Definir ${secretName} con un valor robusto y no versionado.`
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

async function auditNpmSecurity(label, cwd, area) {
  if (!(await pathExists(path.join(cwd, "package.json")))) {
    addInfo(
      `NPM_${label.toUpperCase()}_NO_PACKAGE`,
      area,
      `No existe package.json en ${label}.`,
      normalizeSlashes(path.relative(rootDir, cwd)),
      "Confirmar la estructura del proyecto."
    );
    return;
  }

  const audit = await runCommand("npm audit --json", {
    cwd,
    label: `npm audit ${label}`,
    timeout: 120000,
    captureLimit: 10000
  });
  const raw = audit.stdout || audit.stderr;
  try {
    const parsed = JSON.parse(raw);
    const vulns = parsed.metadata?.vulnerabilities ?? {};
    const critical = Number(vulns.critical ?? 0);
    const high = Number(vulns.high ?? 0);
    const moderate = Number(vulns.moderate ?? 0);
    const low = Number(vulns.low ?? 0);
    if (critical > 0 || high > 0) {
      addFinding({
        code: `NPM_AUDIT_${label.toUpperCase()}_HIGH`,
        severity: critical > 0 ? "CRITICAL" : "HIGH",
        area,
        description: `npm audit encontro vulnerabilidades relevantes en ${label}.`,
        evidence: `critical=${critical}; high=${high}; moderate=${moderate}; low=${low}`,
        recommendation: "Revisar npm audit, actualizar dependencias o documentar excepciones justificadas.",
        command: "npm audit --json"
      });
    } else if (moderate > 0 || low > 0) {
      addFinding({
        code: `NPM_AUDIT_${label.toUpperCase()}_WARN`,
        severity: moderate > 0 ? "MEDIUM" : "LOW",
        area,
        description: `npm audit encontro vulnerabilidades menores en ${label}.`,
        evidence: `critical=${critical}; high=${high}; moderate=${moderate}; low=${low}`,
        recommendation: "Planificar actualizaciones de dependencias.",
        command: "npm audit --json"
      });
    } else {
      addOk(area, `npm audit ${label} sin vulnerabilidades reportadas`, JSON.stringify(vulns), "npm audit --json");
    }
  } catch {
    addFinding({
      code: `NPM_AUDIT_${label.toUpperCase()}_FAILED`,
      severity: "MEDIUM",
      area,
      description: `No se pudo interpretar npm audit en ${label}.`,
      evidence: raw || `exitCode=${audit.exitCode}`,
      recommendation: "Ejecutar npm audit manualmente y revisar conectividad al registry.",
      command: "npm audit --json"
    });
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
    const missingFiles = migrationFiles.filter((file) => !applied.includes(file.version));
    const extraDb = applied.filter((version) => !migrationFiles.some((file) => file.version === version));
    const last = migrationRows.rows.at(-1);
    notes.set("migrations", { appliedCount: applied.length, last, missingFiles, extraDb });
    if (missingFiles.length) {
      addFinding({
        code: "DB_MIGRATIONS_PENDING",
        severity: "HIGH",
        area,
        description: "Hay migraciones del repositorio no registradas en la base de datos.",
        evidence: missingFiles.map((file) => file.file).join("\n"),
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
    if (count > 0) {
      addOk(area, `Evento critico presente: ${event}`, `cantidad=${count}`);
    } else {
      addFinding({
        code: `TRACE_EVENT_${event}_MISSING`,
        severity: "MEDIUM",
        area,
        description: `No hay eventos registrados de tipo ${event}.`,
        evidence: "cantidad=0",
        recommendation: "Confirmar si la funcionalidad aun no se usa o si falta registrar el evento.",
        query: "SELECT tipo_evento, COUNT(*) FROM itam.historial_eventos GROUP BY tipo_evento"
      });
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
      severity: "MEDIUM",
      area,
      description: "Un equipo EXTRAVIADO mantiene custodia activa.",
      recommendation: "Retirar custodia activa o documentar excepcion operacional.",
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
      description: "Una linea movil sin SIM no esta asociada a dispositivo ni colaborador.",
      recommendation: "Asociar la linea a un dispositivo o colaborador, salvo flujo documentado de reposicion.",
      tables: ["lineas_moviles"],
      columns: [["lineas_moviles", "sim_id"], ["lineas_moviles", "dispositivo_id"], ["lineas_moviles", "colaborador_id"], ["lineas_moviles", "estado"]],
      sql: "SELECT id, numero_telefonico, estado FROM itam.lineas_moviles WHERE sim_id IS NULL AND dispositivo_id IS NULL AND colaborador_id IS NULL AND estado <> 'PENDIENTE_REPOSICION'"
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
  await checkPort("127.0.0.1", 3100, area);
  await httpCheck("http://127.0.0.1:3100/api/v1/health", "backend health 3100", area, "HIGH");
  await httpCheck("http://127.0.0.1:3100/api/v1/health/database", "backend database health 3100", area, "HIGH");

  const configuredPort = Number(env.PORT ?? process.env.PORT ?? 3000);
  if (configuredPort !== 3100) {
    addInfo(
      "BACKEND_PORT_NOT_3100",
      area,
      "El PORT configurado para backend no es 3100.",
      `PORT=${configuredPort}`,
      "Confirmar si ITAM v3.0 debe estandarizar backend en puerto 3100."
    );
  }

  const frontend = await httpCheck("http://127.0.0.1:4200", "frontend local 4200", area, "INFO");
  if (!frontend.ok) {
    addInfo(
      "FRONTEND_4200_OPTIONAL",
      area,
      "Frontend local 4200 no esta levantado o no responde.",
      "Chequeo informativo porque el requisito indica validar si esta levantado.",
      "Levantar npm start en frontend si se desea validar disponibilidad web."
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
  if (result.ok) {
    addOk(area, `${label} ${command} exitoso`, compact(result.stdout || result.stderr, 1000), command);
  } else {
    addFinding({
      code: `CODE_${label.toUpperCase()}_${scriptName.toUpperCase()}_FAILED`,
      severity: severityWhenFails,
      area,
      description: `${label} ${command} fallo.`,
      evidence: result.stdout || result.stderr,
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

function renderReport() {
  const hasCriticalOrHigh = counts.CRITICAL > 0 || counts.HIGH > 0;
  const status = hasCriticalOrHigh
    ? "NO APTO: existen hallazgos CRITICAL/HIGH."
    : counts.MEDIUM > 0 || counts.LOW > 0
      ? "APTO CON ADVERTENCIAS: revisar hallazgos antes de promover."
      : "APTO: sin hallazgos bloqueantes.";

  const byArea = [...new Set([...findings.map((item) => item.area), ...okChecks.map((item) => item.area)])]
    .sort((a, b) => a.localeCompare(b));

  const sections = [];
  for (const area of byArea) {
    sections.push(`## ${area}`);
    sections.push("### Hallazgos");
    sections.push(renderFindingsTable(findings.filter((item) => item.area === area)));
    sections.push("### Checks OK");
    sections.push(renderOkTable(okChecks.filter((item) => item.area === area)));
  }

  return `# Auditoria automatica integral ITAM v3.0

Generado: ${new Date().toISOString()}
Proyecto: ${normalizeSlashes(rootDir)}

## Resumen ejecutivo

Estado general: **${status}**

${renderSeverityTable()}

## Detalle por area

${sections.join("\n\n")}

## Evidencia adicional

${renderNotes() || "Sin notas adicionales."}

## Consultas ejecutadas

${renderQueryTable()}

## Comandos ejecutados

${renderCommandTable()}

## Recomendaciones finales

- Corregir primero CRITICAL y HIGH; el auditor saldra con codigo 1 mientras existan.
- Revisar MEDIUM antes de despliegues o respaldos operacionales.
- Mantener secretos fuera de Git y rotar cualquier secreto que haya aparecido en diff o archivos versionados.
- No ejecutar migraciones sin respaldo y sin revisar el resultado de esta auditoria.

## Checklist antes de commit

- [ ] git status solo contiene cambios esperados.
- [ ] git diff --check pasa sin errores.
- [ ] No hay .env ni secretos en el indice, diff o archivos versionados.
- [ ] backend build/typecheck/test revisados.
- [ ] frontend build/typecheck/test revisados segun scripts disponibles.
- [ ] El informe de auditoria fue leido y los hallazgos bloqueantes fueron resueltos o documentados.

## Checklist antes de produccion

- [ ] NODE_ENV=production.
- [ ] CORS_ORIGIN usa origen explicito.
- [ ] JWT_SECRET y SESSION_SECRET existen y son robustos.
- [ ] PostgreSQL responde y schema itam esta completo.
- [ ] Migraciones aplicadas coinciden con database/migrations.
- [ ] Health checks del backend y base de datos responden.
- [ ] No hay inconsistencias criticas de custodia, lineas moviles, SIM o historial.
- [ ] Hay respaldo vigente antes de cambios de base de datos.
`;
}

async function main() {
  await fs.mkdir(reportsDir, { recursive: true });
  const env = await loadBackendEnv();

  await auditSecurity(env);
  await auditDatabase(env);
  await auditAvailability(env);
  await auditCodeAndTests();

  const reportPath = path.join(reportsDir, `itam-environment-audit-${nowStamp()}.md`);
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

main().catch(async (error) => {
  await fs.mkdir(reportsDir, { recursive: true }).catch(() => {});
  addFinding({
    code: "AUDIT_FATAL",
    severity: "CRITICAL",
    area: "Auditor",
    description: "El auditor fallo de forma inesperada.",
    evidence: error.stack ?? error.message,
    recommendation: "Revisar excepcion y corregir el script o entorno antes de confiar en el resultado."
  });
  const reportPath = path.join(reportsDir, `itam-environment-audit-${nowStamp()}.md`);
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
});
