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
  actualizarColaboradorExistente,
  crearNuevoColaborador,
  obtenerColaborador,
  obtenerColaboradorPorRutExistente,
  obtenerColaboradores,
  obtenerInventarioColaborador,
  obtenerPendientesOffboarding
} from "./colaboradores.service";
import type {
  ActualizarColaboradorInput,
  ColaboradorFilters,
  CrearColaboradorInput
} from "./colaboradores.types";

export const listarColaboradoresController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filters: ColaboradorFilters = {
      nombre:
        parseOptionalString(req.query.nombre, "nombre", 180) ??
        undefined,
      rut: parseOptionalString(req.query.rut, "rut", 20) ??
        undefined,
      departamentoId:
        parseOptionalPositiveInteger(
          req.query.departamentoId,
          "departamentoId"
        ) ?? undefined,
      activo: parseOptionalBoolean(req.query.activo, "activo")
    };

    const colaboradores = await obtenerColaboradores(filters);

    sendCollection(res, colaboradores);
  }
);

export const obtenerInventarioColaboradorController = asyncHandler(
  async (req:Request,res:Response):Promise<void> => {
    sendItem(res,await obtenerInventarioColaborador(parsePositiveInteger(req.params.id,"id")));
  }
);

export const pendientesOffboardingController = asyncHandler(
  async (_req:Request,res:Response):Promise<void> => {
    sendCollection(res,await obtenerPendientesOffboarding());
  }
);

export const obtenerColaboradorController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePositiveInteger(req.params.id, "id");
    const colaborador = await obtenerColaborador(id);

    sendItem(res, colaborador);
  }
);

export const obtenerColaboradorPorRutController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const rut = parseRequiredString(req.params.rut, "rut", 20);
    const colaborador = await obtenerColaboradorPorRutExistente(rut);

    sendItem(res, colaborador);
  }
);

export const crearColaboradorController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);

    const input: CrearColaboradorInput = {
      rut: parseRequiredString(body.rut, "rut", 20),
      nombre: parseRequiredString(body.nombre, "nombre", 180),
      cargo: parseOptionalString(body.cargo, "cargo", 150),
      departamentoId: parseOptionalPositiveInteger(
        body.departamentoId,
        "departamentoId"
      ),
      localidad: parseOptionalString(
        body.localidad,
        "localidad",
        120
      ),
      activo: parseOptionalBoolean(body.activo, "activo"),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    };

    const colaborador = await crearNuevoColaborador(input);

    sendItem(res, colaborador, 201);
  }
);

export const actualizarColaboradorController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePositiveInteger(req.params.id, "id");
    const body = parseBodyObject(req.body);

    requireAtLeastOneDefined(body, [
      "rut",
      "nombre",
      "cargo",
      "departamentoId",
      "localidad",
      "activo",
      "observaciones"
    ]);

    const input: ActualizarColaboradorInput = {
      rut:
        body.rut === undefined
          ? undefined
          : parseRequiredString(body.rut, "rut", 20),
      nombre:
        body.nombre === undefined
          ? undefined
          : parseRequiredString(body.nombre, "nombre", 180),
      cargo: parseOptionalString(body.cargo, "cargo", 150),
      departamentoId: parseOptionalPositiveInteger(
        body.departamentoId,
        "departamentoId"
      ),
      localidad: parseOptionalString(
        body.localidad,
        "localidad",
        120
      ),
      activo: parseOptionalBoolean(body.activo, "activo"),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    };

    const colaborador = await actualizarColaboradorExistente(
      id,
      input
    );

    sendItem(res, colaborador);
  }
);
