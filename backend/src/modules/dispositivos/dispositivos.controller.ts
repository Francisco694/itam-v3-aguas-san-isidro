import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { authenticatedActorName } from "../../shared/authenticated-actor";
import { ValidationError } from "../../shared/errors";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseEnum,
  parseOptionalEnum,
  parseOptionalNonNegativeInteger,
  parseOptionalPositiveInteger,
  parseOptionalString,
  parsePositiveInteger,
  requireAtLeastOneDefined
} from "../../shared/validation";
import {
  actualizarDispositivoExistente,
  asignarAColaborador,
  asignarADepartamento,
  cambiarEstadoDispositivoExistente,
  crearNuevoDispositivo,
  darDeBajaDispositivo,
  devolverDispositivoExistente,
  registrarResultadoOffboarding,
  obtenerDispositivoPorIdInterno,
  obtenerDispositivos,
  obtenerIndicadoresGerenciales,
  obtenerHistorialDispositivo,
  obtenerTrazabilidadDispositivo
} from "./dispositivos.service";
import type {
  ActualizarDispositivoInput,
  AsignarColaboradorInput,
  AsignarDepartamentoInput,
  CambiarEstadoDispositivoInput,
  CrearDispositivoInput,
  DevolverDispositivoInput,
  DispositivoFilters,
  DarBajaDispositivoInput,
  MotivoBaja,
  RegistrarResultadoOffboardingInput
} from "./dispositivos.types";

const protectedPatchFields = [
  "codigoInventario",
  "codigo_inventario",
  "estadoId",
  "estado_id",
  "colaboradorId",
  "colaborador_id",
  "departamentoId",
  "departamento_id",
  "recibidoPorId",
  "recibido_por_id"
];

const MAX_DEVICE_ID = 2_147_483_647;

export const parseDispositivoId = (value: unknown): number => {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new ValidationError("Identificador de dispositivo inválido");
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > MAX_DEVICE_ID) {
    throw new ValidationError("Identificador de dispositivo inválido");
  }

  return id;
};

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

const parseOptionalSpecificAttributes = (
  value: unknown
): Record<string, string | number | null> | undefined => {
  if (value === undefined) return undefined;
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new ValidationError("atributosEspecificos debe ser un objeto.");
  }

  const entries = Object.entries(value);
  if (entries.length > 20) {
    throw new ValidationError("atributosEspecificos admite hasta 20 campos.");
  }

  const parsed: Record<string, string | number | null> = {};
  for (const [key, attribute] of entries) {
    if (!/^[a-z][A-Za-z0-9]{0,49}$/.test(key)) {
      throw new ValidationError(`La clave ${key} no es válida.`);
    }
    if (
      attribute !== null &&
      typeof attribute !== "string" &&
      typeof attribute !== "number"
    ) {
      throw new ValidationError(`El atributo ${key} tiene un tipo no válido.`);
    }
    if (typeof attribute === "string" && attribute.length > 250) {
      throw new ValidationError(`El atributo ${key} admite hasta 250 caracteres.`);
    }
    if (typeof attribute === "number" && !Number.isFinite(attribute)) {
      throw new ValidationError(`El atributo ${key} debe ser un número finito.`);
    }
    parsed[key] = attribute;
  }
  return parsed;
};

export const listarDispositivosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filters: DispositivoFilters = {
      q: parseOptionalString(req.query.q, "q") ?? undefined,
      tipo:
        parseOptionalString(req.query.tipo, "tipo", 80) ??
        undefined,
      tipoDispositivoId:
        parseOptionalPositiveInteger(
          req.query.tipoDispositivoId,
          "tipoDispositivoId"
        ) ?? undefined,
      familiaCodigoInventarioId:
        parseOptionalPositiveInteger(
          req.query.familiaCodigoInventarioId,
          "familiaCodigoInventarioId"
        ) ?? undefined,
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

export const resumenGerencialController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    sendItem(res, await obtenerIndicadoresGerenciales());
  }
);

export const obtenerDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parseDispositivoId(req.params.id);
    const dispositivo = await obtenerDispositivoPorIdInterno(id);

    sendItem(res, dispositivo);
  }
);

export const crearDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);
    if (body.codigoInventario !== undefined || body.codigo_inventario !== undefined) {
      throw new ValidationError(
        "El código ITAM es generado automáticamente por el backend."
      );
    }

    const input: CrearDispositivoInput = {
      tipoDispositivoId: parsePositiveInteger(
        body.tipoDispositivoId,
        "tipoDispositivoId"
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
      atributosEspecificos: parseOptionalSpecificAttributes(
        body.atributosEspecificos
      ),
      valorComercial:
        parseOptionalNonNegativeInteger(body.valorComercial, "valorComercial") ?? undefined,
      responsable: authenticatedActorName(req)
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
      "tipoDispositivoId",
      "marca",
      "modelo",
      "numeroSerie",
      "imei",
      "localidad",
      "ubicacionDetalle",
      "observaciones",
      "atributosEspecificos"
      ,"valorComercial"
    ]);

    const input: ActualizarDispositivoInput = {
      tipoDispositivoId:
        parseOptionalPositiveInteger(
          body.tipoDispositivoId,
          "tipoDispositivoId"
        ) ?? undefined,
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
      atributosEspecificos: parseOptionalSpecificAttributes(
        body.atributosEspecificos
      ),
      valorComercial:
        parseOptionalNonNegativeInteger(body.valorComercial, "valorComercial") ?? undefined,
      responsable: authenticatedActorName(req)
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
      responsable: authenticatedActorName(req),
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
      responsable: authenticatedActorName(req),
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
      responsable: authenticatedActorName(req),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      ),
      condicion: parseOptionalString(body.condicion, "condicion", 120),
      resultado: parseOptionalEnum(
        body.resultado,
        "resultado",
        ["DEVUELTO", "DANADO"] as const
      )
    };

    const dispositivo = await devolverDispositivoExistente(
      codigo,
      input
    );

    sendItem(res, dispositivo);
  }
);

const resultadosOffboarding = [
  "DEVUELTO","PENDIENTE","NO_ENTREGADO","EXTRAVIADO","ROBADO_HURTADO","DANADO"
] as const;

export const resultadoOffboardingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);
    const input: RegistrarResultadoOffboardingInput = {
      resultado: parseEnum(body.resultado, "resultado", resultadosOffboarding),
      responsable: authenticatedActorName(req),
      condicion: parseOptionalString(body.condicion, "condicion", 120),
      observaciones: parseOptionalString(body.observaciones, "observaciones")
    };
    sendItem(res, await registrarResultadoOffboarding(codigo, input));
  }
);

const motivosBaja = [
  "IRREPARABLE","REPARACION_NO_CONVENIENTE","MULTIPLES_REPARACIONES",
  "OBSOLESCENCIA","DANO_FISICO","SIN_REPUESTOS","OTRO"
] as const satisfies readonly MotivoBaja[];

export const darBajaDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);
    const input: DarBajaDispositivoInput = {
      motivo: parseEnum(body.motivo, "motivo", motivosBaja),
      responsable: authenticatedActorName(req),
      observaciones: parseOptionalString(body.observaciones, "observaciones")
    };
    sendItem(res, await darDeBajaDispositivo(codigo, input));
  }
);

export const cambiarEstadoDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    const body = parseBodyObject(req.body);

    const input: CambiarEstadoDispositivoInput = {
      estadoId: parsePositiveInteger(body.estadoId, "estadoId"),
      responsable: authenticatedActorName(req),
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

export const trazabilidadDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parseDispositivoId(req.params.id);
    sendItem(res, await obtenerTrazabilidadDispositivo(id));
  }
);
