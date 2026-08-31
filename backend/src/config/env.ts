import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

const requiredVariables = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD"
] as const;

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(
      `Falta la variable de entorno requerida: ${variable}`
    );
  }
}

const positiveMinutes = (name: string, fallback: number): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un numero entero positivo.`);
  }
  return value;
};

const sessionIdleTimeoutMinutes = positiveMinutes(
  "SESSION_IDLE_TIMEOUT_MINUTES",
  60
);
const sessionIdleWarningMinutes = positiveMinutes(
  "SESSION_IDLE_WARNING_MINUTES",
  5
);

if (sessionIdleWarningMinutes >= sessionIdleTimeoutMinutes) {
  throw new Error(
    "SESSION_IDLE_WARNING_MINUTES debe ser menor que SESSION_IDLE_TIMEOUT_MINUTES."
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  host:
    process.env.BACKEND_HOST ??
    ((process.env.NODE_ENV ?? "development") === "development"
      ? "127.0.0.1"
      : "0.0.0.0"),

  port: Number(process.env.PORT ?? 3000),

  corsOrigin: process.env.CORS_ORIGIN,

  session: {
    idleTimeoutMinutes: sessionIdleTimeoutMinutes,
    idleWarningMinutes: sessionIdleWarningMinutes,
    activityRefreshMinutes: Math.min(
      sessionIdleWarningMinutes,
      Math.max(1, Math.floor(sessionIdleTimeoutMinutes / 2))
    )
  },

  documentStoragePath: process.env.DOCUMENT_STORAGE_PATH
    ? path.resolve(process.env.DOCUMENT_STORAGE_PATH)
    : path.resolve(__dirname, "../../storage/facturas"),

  database: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT!),
    name: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!
  }
};
