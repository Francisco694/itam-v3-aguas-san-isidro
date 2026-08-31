import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { AppError, ValidationError } from "../../shared/errors";
import { tokenHash } from "../../shared/auth.middleware";
import { hashPassword, hashPin, verifyPassword, verifyPin } from "../../shared/password";

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
    `INSERT INTO itam.sesiones_usuario(
       token_hash, usuario_id, expira_en, ultima_actividad
     )
     VALUES ($1, $2, NOW() + INTERVAL '12 hours', NOW())`,
    [tokenHash(token), userId]
  );
  return token;
};

const invalidCredentials = () =>
  new AppError(401, "INVALID_CREDENTIALS", "Credenciales incorrectas.");

type PasswordLoginEvent =
  | "LOGIN_PASSWORD_OK"
  | "LOGIN_PASSWORD_FALLIDO"
  | "LOGIN_PASSWORD_BLOQUEADO";

export const isPasswordLoginBlocked = (failedAttempts: number): boolean =>
  failedAttempts >= 5;

export const assertPasswordPolicy = (password: string): void => {
  if (password.length < 12) {
    throw new ValidationError(
      "newPassword debe contener al menos 12 caracteres."
    );
  }
};

export const failedPasswordAttempts = async (
  client: PoolClient,
  userId: string | number
): Promise<number> => {
  const result = await client.query<{ attempts: string | number }>(
    `SELECT COUNT(*) AS attempts
       FROM itam.auditoria_operaciones failed
      WHERE failed.usuario_ejecutor_id=$1
        AND failed.ruta='/api/v1/auth/login'
        AND failed.fecha_evento >= NOW() - INTERVAL '15 minutes'
        AND failed.detalle->>'evento' IN (
          'LOGIN_PASSWORD_FALLIDO','LOGIN_PASSWORD_BLOQUEADO'
        )
        AND failed.fecha_evento > COALESCE((
          SELECT MAX(success.fecha_evento)
            FROM itam.auditoria_operaciones success
           WHERE success.usuario_ejecutor_id=$1
             AND success.ruta='/api/v1/auth/login'
             AND success.detalle->>'evento'='LOGIN_PASSWORD_OK'
        ), '-infinity'::timestamptz)`,
    [userId]
  );
  return Number(result.rows[0]?.attempts ?? 0);
};

const auditPassword = async (
  client: PoolClient,
  userId: string | number | null,
  event: PasswordLoginEvent
): Promise<void> => {
  await client.query(
    `INSERT INTO itam.auditoria_operaciones(
       usuario_ejecutor_id,metodo,ruta,codigo_respuesta,
       tipo_entidad,entidad_id,detalle
     ) VALUES($1,'POST','/api/v1/auth/login',$2,'AUTH',$3,$4::jsonb)`,
    [userId,event === "LOGIN_PASSWORD_OK" ? 200 : 401,
      userId === null ? null : String(userId),JSON.stringify({ evento:event })]
  );
};

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
    const attempts = row ? await failedPasswordAttempts(client, row.id) : 0;
    if (row && isPasswordLoginBlocked(attempts)) {
      await auditPassword(client,row.id,"LOGIN_PASSWORD_BLOQUEADO");
      await client.query("COMMIT");
      committed = true;
      throw invalidCredentials();
    }
    if (!row || !row.activo || !verifyPassword(password, row.password_hash)) {
      await auditPassword(client,row?.id ?? null,"LOGIN_PASSWORD_FALLIDO");
      await client.query("COMMIT");
      committed = true;
      throw invalidCredentials();
    }
    const token = await createSession(client, row.id);
    await auditPassword(client,row.id,"LOGIN_PASSWORD_OK");
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

export const changeOwnPasswordInTransaction = async (
  client: PoolClient,
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  assertPasswordPolicy(newPassword);
  const result = await client.query<{ password_hash: string }>(
    "SELECT password_hash FROM itam.usuarios WHERE id=$1 AND activo=TRUE FOR UPDATE",
    [userId]
  );
  const currentHash = result.rows[0]?.password_hash;
  if (!currentHash || !verifyPassword(currentPassword,currentHash)) {
    throw new AppError(401,"INVALID_PASSWORD","La contrasena actual no es correcta.");
  }
  if (verifyPassword(newPassword,currentHash)) {
    throw new AppError(400,"PASSWORD_UNCHANGED","La nueva contrasena debe ser diferente.");
  }
  await client.query(
    `UPDATE itam.usuarios
        SET password_hash=$2,debe_cambiar_password=FALSE
      WHERE id=$1`,
    [userId,hashPassword(newPassword)]
  );
  await client.query(
    `INSERT INTO itam.auditoria_operaciones(
       usuario_ejecutor_id,metodo,ruta,codigo_respuesta,
       tipo_entidad,entidad_id,detalle
     ) VALUES($1,'POST','/api/v1/auth/change-password',204,'AUTH',$2,$3::jsonb)`,
    [userId,String(userId),JSON.stringify({ evento:"PASSWORD_CHANGED" })]
  );
};

export const changeOwnPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await changeOwnPasswordInTransaction(
      client,
      userId,
      currentPassword,
      newPassword
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
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
      `WITH revoked AS (
         UPDATE itam.sesiones_usuario
            SET revocado_en = NOW()
          WHERE token_hash = $1 AND revocado_en IS NULL
          RETURNING usuario_id
       )
       INSERT INTO itam.auditoria_operaciones(
         usuario_ejecutor_id, metodo, ruta, codigo_respuesta,
         tipo_entidad, entidad_id, detalle
       )
       SELECT usuario_id, 'POST', '/api/v1/auth/logout', 204,
              'AUTH', usuario_id::TEXT,
              jsonb_build_object('evento', 'LOGOUT')
         FROM revoked`,
      [tokenHash(token)]
    );
  }
};

export const refreshSession = async (
  token: string | undefined
): Promise<void> => {
  if (!token) {
    throw new AppError(401, "AUTH_REQUIRED", "Debe iniciar sesion.");
  }
  const result = await pool.query(
    `UPDATE itam.sesiones_usuario
        SET ultima_actividad = NOW()
      WHERE token_hash = $1
        AND revocado_en IS NULL
        AND expira_en > NOW()`,
    [tokenHash(token)]
  );
  if (!result.rowCount) {
    throw new AppError(
      401,
      "INVALID_SESSION",
      "La sesion no es valida o expiro."
    );
  }
};
