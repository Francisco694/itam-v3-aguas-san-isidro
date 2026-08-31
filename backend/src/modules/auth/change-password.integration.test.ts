import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import type { NextFunction, Request, Response } from "express";
import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { AppError, ValidationError } from "../../shared/errors";
import { requireAuth } from "../../shared/auth.middleware";
import {
  hashPassword,
  hashPin,
  verifyPassword
} from "../../shared/password";
import {
  changeOwnPasswordInTransaction,
  failedPasswordAttempts,
  isPasswordLoginBlocked
} from "./auth.service";

const CURRENT_PASSWORD = "CurrentPassword#2026";
const NEW_PASSWORD = "NewPassword#2026";

after(async () => {
  await pool.end();
});

const inRollback = async (
  callback: (client: PoolClient) => Promise<void>
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await callback(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
};

const createTestUser = async (client: PoolClient): Promise<string> => {
  const result = await client.query<{ id: string | number }>(
    `INSERT INTO itam.usuarios(
       nombre,email,password_hash,pin_hash,rol,activo,
       debe_cambiar_password,debe_cambiar_pin
     ) VALUES($1,$2,$3,$4,'USUARIO',TRUE,TRUE,TRUE)
     RETURNING id`,
    [
      "TEST cambio password rollback",
      `change-password-${randomUUID()}@example.test`,
      hashPassword(CURRENT_PASSWORD),
      hashPin("123456")
    ]
  );
  return String(result.rows[0]!.id);
};

test("A/E/F/H: cambia password, conserva PIN y audita con SQL PostgreSQL valido", async () => {
  await inRollback(async (client) => {
    const userId = await createTestUser(client);
    const sessionHash = "a".repeat(64);
    await client.query(
      `INSERT INTO itam.sesiones_usuario(
         token_hash,usuario_id,expira_en,ultima_actividad
       ) VALUES($1,$2,NOW() + INTERVAL '1 hour',NOW())`,
      [sessionHash,userId]
    );

    await changeOwnPasswordInTransaction(
      client,
      userId,
      CURRENT_PASSWORD,
      NEW_PASSWORD
    );

    const user = await client.query<{
      password_hash: string;
      debe_cambiar_password: boolean;
      debe_cambiar_pin: boolean;
    }>(
      `SELECT password_hash,debe_cambiar_password,debe_cambiar_pin
         FROM itam.usuarios WHERE id=$1`,
      [userId]
    );
    assert.equal(verifyPassword(NEW_PASSWORD,user.rows[0]!.password_hash),true);
    assert.equal(user.rows[0]!.debe_cambiar_password,false);
    assert.equal(user.rows[0]!.debe_cambiar_pin,true);

    const session = await client.query<{ revocado_en: string | null }>(
      "SELECT revocado_en FROM itam.sesiones_usuario WHERE token_hash=$1",
      [sessionHash]
    );
    assert.equal(session.rows[0]!.revocado_en,null);

    const audit = await client.query<{
      entidad_id: string;
      detalle: Record<string,unknown>;
    }>(
      `SELECT entidad_id,detalle
         FROM itam.auditoria_operaciones
        WHERE usuario_ejecutor_id=$1
          AND ruta='/api/v1/auth/change-password'`,
      [userId]
    );
    assert.equal(audit.rowCount,1);
    assert.equal(audit.rows[0]!.entidad_id,userId);
    assert.deepEqual(audit.rows[0]!.detalle,{ evento:"PASSWORD_CHANGED" });
    const auditText = JSON.stringify(audit.rows[0]!.detalle);
    assert.equal(auditText.includes(CURRENT_PASSWORD),false);
    assert.equal(auditText.includes(NEW_PASSWORD),false);
    assert.equal(auditText.includes("scrypt$"),false);
  });
});

test("B: password actual incorrecta produce error de negocio y no modifica usuario", async () => {
  await inRollback(async (client) => {
    const userId = await createTestUser(client);
    const before = await client.query<{ password_hash: string }>(
      "SELECT password_hash FROM itam.usuarios WHERE id=$1",
      [userId]
    );

    await assert.rejects(
      changeOwnPasswordInTransaction(
        client,
        userId,
        "WrongPassword#2026",
        NEW_PASSWORD
      ),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 401 &&
        error.code === "INVALID_PASSWORD"
    );

    const after = await client.query<{
      password_hash: string;
      debe_cambiar_password: boolean;
    }>(
      `SELECT password_hash,debe_cambiar_password
         FROM itam.usuarios WHERE id=$1`,
      [userId]
    );
    assert.equal(after.rows[0]!.password_hash,before.rows[0]!.password_hash);
    assert.equal(after.rows[0]!.debe_cambiar_password,true);
  });
});

test("C: nueva password invalida produce VALIDATION_ERROR 400", async () => {
  await inRollback(async (client) => {
    await assert.rejects(
      changeOwnPasswordInTransaction(
        client,
        "0",
        CURRENT_PASSWORD,
        "corta"
      ),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.statusCode === 400 &&
        error.code === "VALIDATION_ERROR"
    );
  });
});

test("D: change-password sin sesion es rechazado con 401", async () => {
  const error = await new Promise<unknown>((resolve) => {
    const request = {
      headers: {},
      method: "POST",
      originalUrl: "/api/v1/auth/change-password"
    } as Request;
    requireAuth(
      request,
      {} as Response,
      ((nextError?: unknown) => resolve(nextError)) as NextFunction
    );
  });
  assert.equal(error instanceof AppError,true);
  assert.equal((error as AppError).statusCode,401);
  assert.equal((error as AppError).code,"AUTH_REQUIRED");
});

test("G: conteo PostgreSQL aplica bloqueo en cinco fallos durante quince minutos", async () => {
  await inRollback(async (client) => {
    const userId = await createTestUser(client);
    for (const event of [
      "LOGIN_PASSWORD_FALLIDO",
      "LOGIN_PASSWORD_FALLIDO",
      "LOGIN_PASSWORD_FALLIDO",
      "LOGIN_PASSWORD_FALLIDO",
      "LOGIN_PASSWORD_BLOQUEADO"
    ]) {
      await client.query(
        `INSERT INTO itam.auditoria_operaciones(
           usuario_ejecutor_id,metodo,ruta,codigo_respuesta,
           tipo_entidad,entidad_id,detalle
         ) VALUES($1,'POST','/api/v1/auth/login',401,'AUTH',$2,$3::jsonb)`,
        [userId,userId,JSON.stringify({ evento:event })]
      );
    }

    const attempts = await failedPasswordAttempts(client,userId);
    assert.equal(attempts,5);
    assert.equal(isPasswordLoginBlocked(attempts),true);

    await client.query(
      `INSERT INTO itam.auditoria_operaciones(
         usuario_ejecutor_id,metodo,ruta,codigo_respuesta,
         tipo_entidad,entidad_id,detalle
       ) VALUES($1,'POST','/api/v1/auth/login',200,'AUTH',$2,$3::jsonb)`,
      [userId,userId,JSON.stringify({ evento:"LOGIN_PASSWORD_OK" })]
    );
    assert.equal(await failedPasswordAttempts(client,userId),0);
  });
});
