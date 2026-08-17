import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { ValidationError } from "../../shared/errors";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseOptionalString,
  parsePositiveInteger,
  parseRequiredString,
  requireAtLeastOneDefined
} from "../../shared/validation";
import {
  actualizarSimExistente,
  asociarDispositivo,
  asignarColaboradorSim,
  cambiarEstadoSimExistente,
  crearNuevaSim,
  desasignarColaboradorSim,
  desasociarDispositivo,
  obtenerHistorialSim,
  obtenerSim,
  obtenerSims
} from "./sim.service";
import type {
  ActualizarSimInput,
  AsociarDispositivoInput,
  AsignarColaboradorSimInput,
  CambiarEstadoSimInput,
  CrearSimInput,
  ResponsableInput
} from "./sim.types";

const protectedPatchFields = [
  "codigoInventario",
  "codigo_inventario",
  "estadoId",
  "estado_id",
  "colaboradorId",
  "colaborador_id",
  "dispositivoId",
  "dispositivo_id",
  "dispositivoCodigoInventario"
];

const assertNoProtectedPatchFields = (
  body: Record<string, unknown>
): void => {
  const protectedField = protectedPatchFields.find(
    (field) => body[field] !== undefined
  );

  if (protectedField) {
    throw new ValidationError(
      `${protectedField} debe modificarse mediante endpoints de negocio.`
    );
  }
};

const parseResponsableInput = (
  body: Record<string, unknown>
): ResponsableInput => ({
  responsable: parseRequiredString(
    body.responsable,
    "responsable",
    150
  ),
  observaciones: parseOptionalString(
    body.observaciones,
    "observaciones"
  )
});

export const listarSimController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const sims = await obtenerSims();

    sendCollection(res, sims);
  }
);

export const obtenerSimController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const sim = await obtenerSim(codigo);

    sendItem(res, sim);
  }
);

export const crearSimController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);
    if (body.codigoInventario !== undefined || body.codigo_inventario !== undefined) {
      throw new ValidationError(
        "El código ITAM es generado automáticamente por el backend."
      );
    }

    const input: CrearSimInput = {
      iccidCodigoFabrica: parseRequiredString(
        body.iccidCodigoFabrica,
        "iccidCodigoFabrica",
        32
      ),
      numeroAsociado: parseOptionalString(
        body.numeroAsociado,
        "numeroAsociado",
        30
      ),
      compania: parseOptionalString(body.compania, "compania", 100),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      ),
      responsable: parseRequiredString(
        body.responsable,
        "responsable",
        150
      )
    };

    const sim = await crearNuevaSim(input);

    sendItem(res, sim, 201);
  }
);

export const actualizarSimController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    assertNoProtectedPatchFields(body);
    requireAtLeastOneDefined(body, [
      "iccidCodigoFabrica",
      "numeroAsociado",
      "compania",
      "observaciones"
    ]);

    const input: ActualizarSimInput = {
      iccidCodigoFabrica:
        body.iccidCodigoFabrica === undefined
          ? undefined
          : parseRequiredString(
              body.iccidCodigoFabrica,
              "iccidCodigoFabrica",
              32
            ),
      numeroAsociado: parseOptionalString(
        body.numeroAsociado,
        "numeroAsociado",
        30
      ),
      compania: parseOptionalString(body.compania, "compania", 100),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    };

    const sim = await actualizarSimExistente(codigo, input);

    sendItem(res, sim);
  }
);

export const asociarDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    const input: AsociarDispositivoInput = {
      dispositivoCodigoInventario: parsePositiveInteger(
        body.dispositivoCodigoInventario,
        "dispositivoCodigoInventario"
      ),
      ...parseResponsableInput(body)
    };

    const sim = await asociarDispositivo(codigo, input);

    sendItem(res, sim);
  }
);

export const desasociarDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);
    const input = parseResponsableInput(body);

    const sim = await desasociarDispositivo(codigo, input);

    sendItem(res, sim);
  }
);

export const asignarColaboradorController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    const input: AsignarColaboradorSimInput = {
      colaboradorId: parsePositiveInteger(
        body.colaboradorId,
        "colaboradorId"
      ),
      ...parseResponsableInput(body)
    };

    const sim = await asignarColaboradorSim(codigo, input);

    sendItem(res, sim);
  }
);

export const desasignarColaboradorController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);
    const input = parseResponsableInput(body);

    const sim = await desasignarColaboradorSim(codigo, input);

    sendItem(res, sim);
  }
);

export const cambiarEstadoSimController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    const input: CambiarEstadoSimInput = {
      estadoId: parsePositiveInteger(body.estadoId, "estadoId"),
      ...parseResponsableInput(body)
    };

    const sim = await cambiarEstadoSimExistente(codigo, input);

    sendItem(res, sim);
  }
);

export const historialSimController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const historial = await obtenerHistorialSim(codigo);

    sendCollection(res, historial);
  }
);
