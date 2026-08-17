import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { sendCollection, sendItem } from "../../shared/responses";
import { parseBodyObject, parseOptionalBoolean, parseOptionalPositiveInteger,
  parseOptionalString, parsePositiveInteger, parseRequiredString,
  requireAtLeastOneDefined } from "../../shared/validation";
import { actualizarTipoDispositivoExistente, crearNuevoTipoDispositivo,
  obtenerTipoDispositivo, obtenerTiposDispositivo } from "./tipos-dispositivo.service";
import type { ActualizarTipoDispositivoInput,
  CrearTipoDispositivoInput } from "./tipos-dispositivo.types";

export const listarTiposDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    sendCollection(res, await obtenerTiposDispositivo({
      activo: parseOptionalBoolean(req.query.activo, "activo")
    }));
  }
);

export const obtenerTipoDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    sendItem(res, await obtenerTipoDispositivo(parsePositiveInteger(req.params.id, "id")));
  }
);

export const crearTipoDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);
    const input: CrearTipoDispositivoInput = {
      nombre: parseRequiredString(body.nombre, "nombre", 80),
      descripcion: parseOptionalString(body.descripcion, "descripcion"),
      familiaCodigoInventarioId: parseOptionalPositiveInteger(
        body.familiaCodigoInventarioId, "familiaCodigoInventarioId"),
      activo: parseOptionalBoolean(body.activo, "activo"),
      requiereImei: parseOptionalBoolean(body.requiereImei, "requiereImei")
    };
    sendItem(res, await crearNuevoTipoDispositivo(input), 201);
  }
);

export const actualizarTipoDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePositiveInteger(req.params.id, "id");
    const body = parseBodyObject(req.body);
    requireAtLeastOneDefined(body,
      ["nombre", "descripcion", "familiaCodigoInventarioId", "activo", "requiereImei"]);
    const input: ActualizarTipoDispositivoInput = {
      nombre: body.nombre === undefined ? undefined
        : parseRequiredString(body.nombre, "nombre", 80),
      descripcion: parseOptionalString(body.descripcion, "descripcion"),
      familiaCodigoInventarioId: parseOptionalPositiveInteger(
        body.familiaCodigoInventarioId, "familiaCodigoInventarioId"),
      activo: parseOptionalBoolean(body.activo, "activo"),
      requiereImei: parseOptionalBoolean(body.requiereImei, "requiereImei")
    };
    sendItem(res, await actualizarTipoDispositivoExistente(id, input));
  }
);
