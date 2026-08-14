import dotenv from "dotenv";

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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  port: Number(process.env.PORT ?? 3000),

  corsOrigin: process.env.CORS_ORIGIN,

  database: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT!),
    name: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!
  }
};
