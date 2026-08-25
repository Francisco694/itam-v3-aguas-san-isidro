import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { AppError } from "../../shared/errors";
import { tokenHash } from "../../shared/auth.middleware";
import { hashPin, verifyPassword, verifyPin } from "../../shared/password";

type UserRole = "SUPER_USUARIO" | "USUARIO";

interface UserRow {
  id: string | number;
  nombre: string;
  email: string;
  cargo: string | null;
  password_hash: string;
  pin_hash: string | null;
  pin_intentos_fallidos: number;
  pin_bloqueado_hasta: Date | string | null;
  debe_cambiar_password: boolean;
  debe_cambiar_pin: boolean;
  rol: UserRole;
  activo: boolean;
}

const safeUser = (row: UserRow) => ({
  id: String(row.id),
  nombre: row.nombre,
  email: row.email,
  cargo: row.cargo,
  rol: row.rol,
  debeCambiarPassword: row.debe_cambiar_password,
  debeCambiarPin: row.debe_cambiar_pin
});

const createSession = async (client: PoolClient, userId: string | number) => {
  const token = randomBytes(32).toString("base64url");
  await client.query(
    `INSERT INTO itam.sesiones_usuario(token_hash, usuario_id, expira_en)
     VALUES ($1, $2, NOW() + INTERVAL '12 hours')`,
    [tokenHash(token), userId]
  );
  return token;
};

const invalidCredentials = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Credenciales incorrectas.");

const auditPin = async (
  client: PoolClient,
  userId: string | number | null,
  event: "LOGIN_PIN_OK" | "LOGIN_PIN_FALLIDO" | "LOGIN_PIN_BLOQUEADO"
): Promise<void> => {
  await client.query(
    `INSERT INTO itam.auditoria_operaciones(
       usuario_ejecutor_id, metodo, ruta, codigo_respuesta,
       tipo_entidad, entidad_id, detalle
     ) VALUES ($1, 'POST', '/api/v1/auth/login-pin', $2, 'AUTH', $3, $4::jsonb)`,
    [
      userId,
      event === "LOGIN_PIN_OK" ? 200 : 401,
      userId === null ? null : String(userId),
      JSON.stringify({ evento: event })
    ]
  );
};

export const login = async (email: string, password: string) => {
  const client = await pool.connect();
  try {
    const result = await client.query<UserRow>(
      `SELECT id, nombre, email, cargo, password_hash, pin_hash,
              pin_intentos_fallidos, pin_bloqueado_hasta,
              debe_cambiar_password, debe_cambiar_pin, rol, activo
         FROM itam.usuarios
        WHERE LOWER(BTRIM(email)) = LOWER(BTRIM($1))
        LIMIT 1`,
      [email]
    );
    const row = result.rows[0];
    if (!row || !row.activo || !verifyPassword(password, row.password_hash)) {
      throw invalidCredentials();
    }
    const token = await createSession(client, row.id);
    return { token, user: safeUser(row) };
  } finally {
    client.release();
  }
};

export const loginWithPin = async (email: string, pin: string) => {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    const result = await client.query<UserRow>(
      `SELECT id, nombre, email, cargo, password_hash, pin_hash,
              pin_intentos_fallidos, pin_bloqueado_hasta,
              debe_cambiar_password, debe_cambiar_pin, rol, activo
         FROM itam.usuarios
        WHERE LOWER(BTRIM(email)) = LOWER(BTRIM($1))
        FOR UPDATE`,
      [email]
    );
    const row = result.rows[0];
    if (!row || !row.activo || !row.pin_hash) {
      await auditPin(client, row?.id ?? null, "LOGIN_PIN_FALLIDO");
      await client.query("COMMIT");
      committed = true;
      throw invalidCredentials();
    }

    const now = new Date();
    const blockedUntil = row.pin_bloqueado_hasta
      ? new Date(row.pin_bloqueado_hasta)
      : null;
    if (blockedUntil && blockedUntil > now) {
      await auditPin(client, row.id, "LOGIN_PIN_BLOQUEADO");
      await client.query("COMMIT");
      committed = true;
      throw invalidCredentials();
    }

    if (!verifyPin(pin, row.pin_hash)) {
      const previousAttempts = blockedUntil ? 0 : row.pin_intentos_fallidos;
      const attempts = Math.min(previousAttempts + 1, 5);
      const blocked = attempts >= 5;
      await client.query(
        `UPDATE itam.usuarios
            SET pin_intentos_fallidos = $2,
                pin_bloqueado_hasta =
                  CASE WHEN $3 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
          WHERE id = $1`,
        [row.id, attempts, blocked]
      );
      await auditPin(
        client,
        row.id,
        blocked ? "LOGIN_PIN_BLOQUEADO" : "LOGIN_PIN_FALLIDO"
      );
      await client.query("COMMIT");
      committed = true;
      throw invalidCredentials();
    }

    await client.query(
      `UPDATE itam.usuarios
          SET pin_intentos_fallidos = 0, pin_bloqueado_hasta = NULL
        WHERE id = $1`,
      [row.id]
    );
    const token = await createSession(client, row.id);
    await auditPin(client, row.id, "LOGIN_PIN_OK");
    await client.query("COMMIT");
    committed = true;
    return { token, user: safeUser(row) };
  } catch (error) {
    if (!committed) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const changeOwnPin = async (
  userId: string,
  currentPin: string,
  newPin: string
): Promise<void> => {
  const result = await pool.query<{ pin_hash: string | null }>(
    "SELECT pin_hash FROM itam.usuarios WHERE id = $1 AND activo = TRUE",
    [userId]
  );
  const currentHash = result.rows[0]?.pin_hash;
  if (!currentHash || !verifyPin(currentPin, currentHash)) {
    throw new AppError(401, "INVALID_PIN", "El PIN actual no es correcto.");
  }
  await pool.query(
    `UPDATE itam.usuarios
        SET pin_hash = $2, pin_intentos_fallidos = 0,
            pin_bloqueado_hasta = NULL, debe_cambiar_pin = FALSE
      WHERE id = $1`,
    [userId, hashPin(newPin)]
  );
};

export const logout = async (token: string | undefined): Promise<void> => {
  if (token) {
    await pool.query(
      `UPDATE itam.sesiones_usuario
          SET revocado_en = NOW()
        WHERE token_hash = $1 AND revocado_en IS NULL`,
      [tokenHash(token)]
    );
  }
};
