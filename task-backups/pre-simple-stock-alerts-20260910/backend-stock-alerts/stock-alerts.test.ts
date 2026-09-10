import assert from "node:assert/strict";
import test, { after } from "node:test";
import type { NextFunction, Request, Response } from "express";
import { pool } from "../../config/database";
import { requireRole } from "../../shared/auth.middleware";
import { AppError } from "../../shared/errors";
import { parseOptionalNonNegativeInteger } from "../../shared/validation";
import { stockAlertIsTriggered, stockAlertMessage } from "./stock-alerts.service";
import { listStockAlerts } from "./stock-alerts.service";

after(async () => { await pool.end(); });

test("activa la alerta con 0 disponibles y mínimo 0", () => {
  assert.equal(stockAlertIsTriggered(0, 0, true), true);
  assert.equal(stockAlertMessage(0, 0), "No quedan equipos disponibles");
});

test("activa la alerta con 3 disponibles y mínimo 3", () => {
  assert.equal(stockAlertIsTriggered(3, 3, true), true);
  assert.match(stockAlertMessage(3, 3), /Quedan 3 disponibles/);
});

test("no alerta sobre el mínimo ni cuando está desactivada", () => {
  assert.equal(stockAlertIsTriggered(4, 3, true), false);
  assert.equal(stockAlertIsTriggered(0, 3, false), false);
});

test("rechaza mínimos negativos o no enteros", () => {
  assert.throws(() => parseOptionalNonNegativeInteger(-1, "minimoDisponible"));
  assert.throws(() => parseOptionalNonNegativeInteger(1.5, "minimoDisponible"));
});

test("un usuario normal no supera la autorización de actualización", () => {
  const request = {
    authUser: {
      id: "8", nombre: "Usuario", email: "user@example.test", cargo: null,
      rol: "USUARIO", debeCambiarPassword: false, debeCambiarPin: false
    }
  } as Request;
  let received: unknown;
  requireRole("SUPER_USUARIO")(
    request,
    {} as Response,
    ((error?: unknown) => { received = error; }) as NextFunction
  );
  assert.ok(received instanceof AppError);
  assert.equal((received as AppError).statusCode, 403);
});

test("calcula disponibles desde inventario usando solo el estado DISPONIBLE", async () => {
  const alerts = await listStockAlerts();
  const expected = await pool.query<{ tipo_id: string; disponibles: string }>(
    `SELECT tipo.id AS tipo_id,
            COUNT(dispositivo.id) FILTER (WHERE estado.codigo='DISPONIBLE') AS disponibles
       FROM itam.tipos_dispositivo tipo
       LEFT JOIN itam.dispositivos dispositivo ON dispositivo.tipo_dispositivo_id=tipo.id
       LEFT JOIN itam.estados estado ON estado.id=dispositivo.estado_id
      WHERE tipo.activo=TRUE
      GROUP BY tipo.id`
  );
  const counts = new Map(expected.rows.map((row) => [row.tipo_id, Number(row.disponibles)]));
  for (const alert of alerts) {
    assert.equal(alert.disponibles, counts.get(alert.tipoDispositivo.id));
  }
});
