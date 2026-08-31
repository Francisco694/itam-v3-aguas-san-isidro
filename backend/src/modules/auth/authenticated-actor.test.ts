import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { AppError } from "../../shared/errors";
import { authenticatedActorName } from "../../shared/authenticated-actor";

test("QA-09: utiliza exclusivamente el nombre de la sesión autenticada", () => {
  const request = {
    authUser: {
      id: "7",
      nombre: "  Responsable TI de sesión  ",
      email: "responsable@example.test",
      cargo: null,
      rol: "OPERADOR_TI",
      debeCambiarPassword: false,
      debeCambiarPin: false
    },
    body: { responsable: "Nombre arbitrario enviado por el cliente" }
  } as unknown as Request;

  assert.equal(authenticatedActorName(request), "Responsable TI de sesión");
});

test("QA-09: bloquea la operación cuando no existe una sesión identificable", () => {
  assert.throws(
    () => authenticatedActorName({} as Request),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 401 &&
      error.code === "UNAUTHORIZED"
  );
});
