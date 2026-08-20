import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseOptionalBoolean,
  parseOptionalPositiveInteger,
  parseOptionalString,
  parsePositiveInteger,
  parseRequiredString,
  requireAtLeastOneDefined
} from "../../shared/validation";
import {
  actualizarDepartamentoExistente,
  crearNuevoDepartamento,
  obtenerDepartamento,
  obtenerInventarioDepartamento,
  obtenerDepartamentos
} from "./departamentos.service";
import type {
  ActualizarDepartamentoInput,
  CrearDepartamentoInput
} from "./departamentos.types";

export const listarDepartamentosController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const departamentos = await obtenerDepartamentos();
    sendCollection(res, departamentos);
  }
);

export const obtenerDepartamentoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePositiveInteger(req.params.id, "id");
    const departamento = await obtenerDepartamento(id);

    sendItem(res, departamento);
  }
);

export const obtenerInventarioDepartamentoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePositiveInteger(req.params.id, "id");
    sendItem(res, await obtenerInventarioDepartamento(id));
  }
);

export const crearDepartamentoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);

    const input: CrearDepartamentoInput = {
      nombre: parseRequiredString(body.nombre, "nombre", 120),
      activo: parseOptionalBoolean(body.activo, "activo"),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      ),
      dependencia_id: parseOptionalPositiveInteger(body.dependencia_id, "dependencia_id")
    };

    const departamento = await crearNuevoDepartamento(input);

    sendItem(res, departamento, 201);
  }
);

export const actualizarDepartamentoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePositiveInteger(req.params.id, "id");
    const body = parseBodyObject(req.body);

    requireAtLeastOneDefined(body, [
      "nombre",
      "activo",
      "observaciones",
      "dependencia_id"
    ]);

    const input: ActualizarDepartamentoInput = {
      nombre:
        body.nombre === undefined
          ? undefined
          : parseRequiredString(body.nombre, "nombre", 120),
      activo: parseOptionalBoolean(body.activo, "activo"),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      ),
      dependencia_id: parseOptionalPositiveInteger(body.dependencia_id, "dependencia_id")
    };

    const departamento = await actualizarDepartamentoExistente(
      id,
      input
    );

    sendItem(res, departamento);
  }
);
