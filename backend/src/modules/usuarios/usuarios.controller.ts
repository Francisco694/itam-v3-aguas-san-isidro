import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { ValidationError } from "../../shared/errors";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseEnum,
  parseOptionalBoolean,
  parseOptionalString,
  parsePositiveInteger,
  parseRequiredString,
  requireAtLeastOneDefined
} from "../../shared/validation";
import {
  actualizarUsuario,
  crearUsuario,
  listarUsuarios
} from "./usuarios.service";

const roles = ["SUPER_USUARIO", "USUARIO"] as const;

const validatePassword = (value: string): string => {
  if (value.length < 12) {
    throw new ValidationError("password debe contener al menos 12 caracteres.");
  }
  return value;
};

const parsePin = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) {
    throw new ValidationError("pin debe contener exactamente 6 digitos.");
  }
  return value;
};

export const listarUsuariosController = asyncHandler(
  async (_req: Request, res: Response) =>
    sendCollection(res, await listarUsuarios())
);

export const crearUsuarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parseBodyObject(req.body);
    sendItem(
      res,
      await crearUsuario({
        nombre: parseRequiredString(body.nombre, "nombre", 180),
        email: parseRequiredString(body.email, "email", 254),
        cargo: parseRequiredString(body.cargo, "cargo", 150),
        password: validatePassword(
          parseRequiredString(body.password, "password", 200)
        ),
        pin: parsePin(body.pin),
        rol: parseEnum(body.rol, "rol", roles),
        activo: parseOptionalBoolean(body.activo, "activo")
      }),
      201
    );
  }
);

export const actualizarUsuarioController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parseBodyObject(req.body);
    requireAtLeastOneDefined(body, [
      "nombre",
      "email",
      "cargo",
      "password",
      "pin",
      "rol",
      "activo"
    ]);
    const password =
      body.password === undefined
        ? undefined
        : validatePassword(
            parseRequiredString(body.password, "password", 200)
          );
    const pin = body.pin === undefined ? undefined : parsePin(body.pin);
    sendItem(
      res,
      await actualizarUsuario(parsePositiveInteger(req.params.id, "id"), {
        nombre: parseOptionalString(body.nombre, "nombre", 180),
        email: parseOptionalString(body.email, "email", 254),
        cargo: parseOptionalString(body.cargo, "cargo", 150),
        password,
        pin,
        rol:
          body.rol === undefined
            ? undefined
            : parseEnum(body.rol, "rol", roles),
        activo: parseOptionalBoolean(body.activo, "activo")
      })
    );
  }
);
