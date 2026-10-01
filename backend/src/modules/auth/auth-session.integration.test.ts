import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { pool } from "../../config/database";
import { AppError } from "../../shared/errors";
import { requireAuth, tokenHash } from "../../shared/auth.middleware";
import { hashPassword, hashPin } from "../../shared/password";
import {
  loginWithPin,
  logout,
  refreshSession
} from "./auth.service";

const TEST_PIN = "123456";

after(async () => {
  await pool.end();
});

interface TestUser {
  id: string;
  email: string;
}

const createTestUser = async (
  blocked = false
): Promise<TestUser> => {
  const email = `auth-session-${randomUUID()}@example.test`;
  const result = await pool.query<{ id: string | number }>(
    `INSERT INTO itam.usuarios(
       nombre,email,password_hash,pin_hash,rol,activo,
       pin_bloqueado_hasta,debe_cambiar_password,debe_cambiar_pin
     ) VALUES($1,$2,$3,$4,'USUARIO',TRUE,
       CASE WHEN $5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
       FALSE,FALSE)
     RETURNING id`,
    [
      "TEST sesión de autenticación",
      email,
      hashPassword("TestPassword#2026"),
      hashPin(TEST_PIN),
      blocked
    ]
  );
  return { id: String(result.rows[0]!.id), email };
};

const cleanupTestUser = async (userId: string): Promise<void> => {
  await pool.query("BEGIN");
  try {
    await pool.query(
      `DELETE FROM itam.auditoria_operaciones
        WHERE usuario_ejecutor_id = $1::bigint
           OR (tipo_entidad = 'AUTH' AND entidad_id = $1::text)`,
      [userId]
    );
    await pool.query("DELETE FROM itam.sesiones_usuario WHERE usuario_id = $1", [userId]);
    await pool.query("DELETE FROM itam.usuarios WHERE id = $1", [userId]);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
};

const assertInvalidCredentials = async (
  callback: () => Promise<unknown>
): Promise<void> => {
  await assert.rejects(
    callback,
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 401 &&
      error.code === "INVALID_CREDENTIALS"
  );
};

const runRequireAuth = async (
  token?: string,
  path = "/dispositivos"
): Promise<unknown> => new Promise((resolve) => {
  const request = {
    headers: token ? { cookie: `itam_session=${token}` } : {},
    method: "GET",
    path,
    originalUrl: `/api/v1${path}`
  } as Request;
  requireAuth(
    request,
    {} as Response,
    ((error?: unknown) => resolve(error)) as NextFunction
  );
});

test("PIN correcto crea sesión con actividad inicial y PIN incorrecto devuelve 401", async () => {
  const user = await createTestUser();
  try {
    const result = await loginWithPin(user.email, TEST_PIN);
    assert.ok(result.token);

    const session = await pool.query<{
      usuario_id: string | number;
      expira_en: Date | string;
      ultima_actividad: Date | string;
    }>(
      `SELECT usuario_id,expira_en,ultima_actividad
         FROM itam.sesiones_usuario WHERE token_hash=$1`,
      [tokenHash(result.token)]
    );
    assert.equal(String(session.rows[0]!.usuario_id), user.id);
    assert.ok(new Date(session.rows[0]!.expira_en).getTime() > Date.now());
    assert.ok(new Date(session.rows[0]!.ultima_actividad).getTime() <= Date.now());

    await logout(result.token);
    const revoked = await pool.query<{ revocado_en: Date | string | null }>(
      "SELECT revocado_en FROM itam.sesiones_usuario WHERE token_hash=$1",
      [tokenHash(result.token)]
    );
    assert.ok(revoked.rows[0]!.revocado_en);
  } finally {
    await cleanupTestUser(user.id);
  }

  const wrongUser = await createTestUser();
  try {
    await assertInvalidCredentials(() => loginWithPin(wrongUser.email, "000000"));
    const attempts = await pool.query<{ pin_intentos_fallidos: number }>(
      "SELECT pin_intentos_fallidos FROM itam.usuarios WHERE id=$1",
      [wrongUser.id]
    );
    assert.equal(attempts.rows[0]!.pin_intentos_fallidos, 1);
  } finally {
    await cleanupTestUser(wrongUser.id);
  }
});

test("usuario bloqueado por PIN devuelve 401 sin crear sesión", async () => {
  const user = await createTestUser(true);
  try {
    await assertInvalidCredentials(() => loginWithPin(user.email, TEST_PIN));
    const sessions = await pool.query(
      "SELECT 1 FROM itam.sesiones_usuario WHERE usuario_id=$1",
      [user.id]
    );
    assert.equal(sessions.rowCount, 0);
  } finally {
    await cleanupTestUser(user.id);
  }
});

test("refresh, middleware de actividad, logout y sesión ausente tienen el comportamiento esperado", async () => {
  const user = await createTestUser();
  try {
    const result = await loginWithPin(user.email, TEST_PIN);
    await pool.query(
      `UPDATE itam.sesiones_usuario
          SET ultima_actividad = NOW() - INTERVAL '10 minutes'
        WHERE token_hash=$1`,
      [tokenHash(result.token)]
    );

    await refreshSession(result.token);
    const refreshed = await pool.query<{ ultima_actividad: Date | string }>(
      "SELECT ultima_actividad FROM itam.sesiones_usuario WHERE token_hash=$1",
      [tokenHash(result.token)]
    );
    assert.ok(new Date(refreshed.rows[0]!.ultima_actividad).getTime() > Date.now() - 5000);

    await pool.query(
      `UPDATE itam.sesiones_usuario
          SET ultima_actividad = NOW() - INTERVAL '10 minutes'
        WHERE token_hash=$1`,
      [tokenHash(result.token)]
    );
    assert.equal(await runRequireAuth(result.token), undefined);
    const activity = await pool.query<{ ultima_actividad: Date | string }>(
      "SELECT ultima_actividad FROM itam.sesiones_usuario WHERE token_hash=$1",
      [tokenHash(result.token)]
    );
    assert.ok(new Date(activity.rows[0]!.ultima_actividad).getTime() > Date.now() - 5000);

    await logout(result.token);
    const afterLogout = await runRequireAuth(result.token);
    assert.equal(afterLogout instanceof AppError, true);
    assert.equal((afterLogout as AppError).statusCode, 401);
  } finally {
    await cleanupTestUser(user.id);
  }

  const withoutSession = await runRequireAuth();
  assert.equal(withoutSession instanceof AppError, true);
  assert.equal((withoutSession as AppError).statusCode, 401);
});
