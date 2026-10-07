import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { authenticatedActorName } from "../../shared/authenticated-actor";
import { ValidationError } from "../../shared/errors";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseEnum,
  parseOptionalEnum,
  parseOptionalPositiveInteger,
  parseOptionalString,
  parsePositiveInteger,
  parseRequiredString
} from "../../shared/validation";
import {
  crearReemplazoDispositivo,
  obtenerReemplazosDeColaborador,
  obtenerReemplazosPendientes,
  recibirReemplazoPendiente
} from "./reemplazos-dispositivo.service";
import type { CrearReemplazoInput, RecibirReemplazoInput } from "./reemplazos-dispositivo.types";

const parseBoolean = (value: unknown, field: string): boolean => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new ValidationError(`${field} debe ser verdadero o falso.`);
};

const parseMotivoBaja = (value: unknown): CrearReemplazoInput["motivoBaja"] => {
  return parseOptionalEnum(value, "motivoBaja", [
    "IRREPARABLE", "REPARACION_NO_CONVENIENTE", "MULTIPLES_REPARACIONES",
    "OBSOLESCENCIA", "DANO_FISICO", "SIN_REPUESTOS", "OTRO"
  ] as const) ?? undefined;
};

const parseDestination = (value: unknown): RecibirReemplazoInput["destinoDispositivoAnterior"] =>
  parseEnum(value, "destinoDispositivoAnterior", ["DISPONIBLE", "RETENIDO_REVISION", "DADO_BAJA"] as const);

export const listarReemplazosPendientesController = asyncHandler(async (_req: Request, res: Response) => {
  sendCollection(res, await obtenerReemplazosPendientes());
});

export const listarReemplazosColaboradorController = asyncHandler(async (req: Request, res: Response) => {
  sendCollection(res, await obtenerReemplazosDeColaborador(parsePositiveInteger(req.params.colaboradorId, "colaboradorId")));
});

export const crearReemplazoController = asyncHandler(async (req: Request, res: Response) => {
  const body = parseBodyObject(req.body);
  const entregaAnterior = parseBoolean(body.entregaAnterior, "entregaAnterior");
  const input: CrearReemplazoInput = {
    colaboradorId: parsePositiveInteger(body.colaboradorId, "colaboradorId"),
    dispositivoAnteriorCodigo: parsePositiveInteger(body.dispositivoAnteriorCodigo, "dispositivoAnteriorCodigo"),
    dispositivoNuevoCodigo: parsePositiveInteger(body.dispositivoNuevoCodigo, "dispositivoNuevoCodigo"),
    entregaAnterior,
    destinoDispositivoAnterior: entregaAnterior ? parseDestination(body.destinoDispositivoAnterior) : undefined,
    motivoBaja: parseMotivoBaja(body.motivoBaja),
    condicion: parseOptionalString(body.condicion, "condicion", 120),
    resultado: parseOptionalEnum(body.resultado, "resultado", ["DEVUELTO", "DANADO"] as const),
    accionSim: parseOptionalEnum(body.accionSim, "accionSim", ["MOVER_SIM_ACTUAL", "USAR_SIM_EXISTENTE", "REGISTRAR_SIM_NUEVA", "SIN_SIM"] as const),
    simDestinoCodigo: parseOptionalPositiveInteger(body.simDestinoCodigo, "simDestinoCodigo") ?? undefined,
    conservarNumero: body.conservarNumero === undefined ? undefined : parseBoolean(body.conservarNumero, "conservarNumero"),
    simNueva: body.simNueva === undefined ? undefined : (() => {
      const simNueva = parseBodyObject(body.simNueva);
      return {
        iccidCodigoFabrica: parseRequiredString(simNueva.iccidCodigoFabrica, "simNueva.iccidCodigoFabrica", 32),
        compania: parseOptionalString(simNueva.compania, "simNueva.compania", 100),
        observaciones: parseOptionalString(simNueva.observaciones, "simNueva.observaciones"),
        linea: parseEnum(simNueva.linea, "simNueva.linea", ["CONSERVAR_NUMERO", "NUMERO_NUEVO", "SIN_LINEA"] as const),
        numeroTelefonico: parseOptionalString(simNueva.numeroTelefonico, "simNueva.numeroTelefonico", 30)
      };
    })(),
    observaciones: parseOptionalString(body.observaciones, "observaciones"),
    responsable: authenticatedActorName(req)
  };
  sendItem(res, await crearReemplazoDispositivo(input), 201);
});

export const recibirReemplazoController = asyncHandler(async (req: Request, res: Response) => {
  const body = parseBodyObject(req.body);
  const input: RecibirReemplazoInput = {
    destinoDispositivoAnterior: parseDestination(body.destinoDispositivoAnterior),
    simEntregada: body.simEntregada === undefined ? undefined : parseBoolean(body.simEntregada, "simEntregada"),
    motivoBaja: parseMotivoBaja(body.motivoBaja),
    condicion: parseOptionalString(body.condicion, "condicion", 120),
    resultado: parseOptionalEnum(body.resultado, "resultado", ["DEVUELTO", "DANADO"] as const),
    observaciones: parseOptionalString(body.observaciones, "observaciones"),
    responsable: authenticatedActorName(req)
  };
  sendItem(res, await recibirReemplazoPendiente(String(req.params.id), input));
});
