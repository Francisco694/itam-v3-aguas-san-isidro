import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { ValidationError } from "../../shared/errors";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseOptionalPositiveInteger,
  parseOptionalString,
  parsePositiveInteger,
  parseRequiredString,
  requireAtLeastOneDefined
} from "../../shared/validation";
import {
  actualizarDispositivoExistente,
  asignarAColaborador,
  asignarADepartamento,
  cambiarEstadoDispositivoExistente,
  crearNuevoDispositivo,
  devolverDispositivoExistente,
  obtenerDispositivo,
  obtenerDispositivos,
  obtenerHistorialDispositivo
} from "./dispositivos.service";
import type {
  ActualizarDispositivoInput,
  AsignarColaboradorInput,
  AsignarDepartamentoInput,
  CambiarEstadoDispositivoInput,
  CrearDispositivoInput,
  DevolverDispositivoInput,
  DispositivoFilters
} from "./dispositivos.types";

const protectedPatchFields = [
  "estadoId",
  "estado_id",
  "colaboradorId",
  "colaborador_id",
  "departamentoId",
  "departamento_id",
  "recibidoPorId",
  "recibido_por_id"
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

export const listarDispositivosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filters: DispositivoFilters = {
      q: parseOptionalString(req.query.q, "q") ?? undefined,
      tipo:
        parseOptionalString(req.query.tipo, "tipo", 80) ??
        undefined,
      estado:
        parseOptionalString(req.query.estado, "estado", 40)
          ?.toUpperCase() ?? undefined,
      colaboradorId:
        parseOptionalPositiveInteger(
          req.query.colaboradorId,
          "colaboradorId"
        ) ?? undefined,
      departamentoId:
        parseOptionalPositiveInteger(
          req.query.departamentoId,
          "departamentoId"
        ) ?? undefined,
      localidad:
        parseOptionalString(
          req.query.localidad,
          "localidad",
          120
        ) ?? undefined
    };

    const dispositivos = await obtenerDispositivos(filters);

    sendCollection(res, dispositivos);
  }
);

export const obtenerDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const dispositivo = await obtenerDispositivo(codigo);

    sendItem(res, dispositivo);
  }
);

export const crearDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);

    const input: CrearDispositivoInput = {
      codigoInventario: parsePositiveInteger(
        body.codigoInventario,
        "codigoInventario"
      ),
      tipoDispositivo: parseRequiredString(
        body.tipoDispositivo,
        "tipoDispositivo",
        80
      ),
      marca: parseOptionalString(body.marca, "marca", 100),
      modelo: parseOptionalString(body.modelo, "modelo", 150),
      numeroSerie: parseOptionalString(
        body.numeroSerie,
        "numeroSerie",
        150
      ),
      imei: parseOptionalString(body.imei, "imei", 30),
      localidad: parseOptionalString(
        body.localidad,
        "localidad",
        120
      ),
      ubicacionDetalle: parseOptionalString(
        body.ubicacionDetalle,
        "ubicacionDetalle",
        250
      ),
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

    const dispositivo = await crearNuevoDispositivo(input);

    sendItem(res, dispositivo, 201);
  }
);

export const actualizarDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    assertNoProtectedPatchFields(body);
    requireAtLeastOneDefined(body, [
      "tipoDispositivo",
      "marca",
      "modelo",
      "numeroSerie",
      "imei",
      "localidad",
      "ubicacionDetalle",
      "observaciones"
    ]);

    const input: ActualizarDispositivoInput = {
      tipoDispositivo:
        body.tipoDispositivo === undefined
          ? undefined
          : parseRequiredString(
              body.tipoDispositivo,
              "tipoDispositivo",
              80
            ),
      marca: parseOptionalString(body.marca, "marca", 100),
      modelo: parseOptionalString(body.modelo, "modelo", 150),
      numeroSerie: parseOptionalString(
        body.numeroSerie,
        "numeroSerie",
        150
      ),
      imei: parseOptionalString(body.imei, "imei", 30),
      localidad: parseOptionalString(
        body.localidad,
        "localidad",
        120
      ),
      ubicacionDetalle: parseOptionalString(
        body.ubicacionDetalle,
        "ubicacionDetalle",
        250
      ),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    };

    const dispositivo = await actualizarDispositivoExistente(
      codigo,
      input
    );

    sendItem(res, dispositivo);
  }
);

export const asignarColaboradorController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    const input: AsignarColaboradorInput = {
      colaboradorId: parsePositiveInteger(
        body.colaboradorId,
        "colaboradorId"
      ),
      responsable: parseRequiredString(
        body.responsable,
        "responsable",
        150
      ),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    };

    const dispositivo = await asignarAColaborador(codigo, input);

    sendItem(res, dispositivo);
  }
);

export const asignarDepartamentoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    const input: AsignarDepartamentoInput = {
      departamentoId: parsePositiveInteger(
        body.departamentoId,
        "departamentoId"
      ),
      recibidoPorId: parsePositiveInteger(
        body.recibidoPorId,
        "recibidoPorId"
      ),
      localidad: parseOptionalString(
        body.localidad,
        "localidad",
        120
      ),
      ubicacionDetalle: parseOptionalString(
        body.ubicacionDetalle,
        "ubicacionDetalle",
        250
      ),
      responsable: parseRequiredString(
        body.responsable,
        "responsable",
        150
      ),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    };

    const dispositivo = await asignarADepartamento(codigo, input);

    sendItem(res, dispositivo);
  }
);

export const devolverDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    const input: DevolverDispositivoInput = {
      responsable: parseRequiredString(
        body.responsable,
        "responsable",
        150
      ),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    };

    const dispositivo = await devolverDispositivoExistente(
      codigo,
      input
    );

    sendItem(res, dispositivo);
  }
);

export const cambiarEstadoDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    const input: CambiarEstadoDispositivoInput = {
      estadoId: parsePositiveInteger(body.estadoId, "estadoId"),
      responsable: parseRequiredString(
        body.responsable,
        "responsable",
        150
      ),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    };

    const dispositivo = await cambiarEstadoDispositivoExistente(
      codigo,
      input
    );

    sendItem(res, dispositivo);
  }
);

export const historialDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const historial = await obtenerHistorialDispositivo(codigo);

    sendCollection(res, historial);
  }
);
