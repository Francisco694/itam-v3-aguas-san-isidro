import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseOptionalBoolean,
  parseOptionalEnum,
  parsePositiveInteger,
  parseRequiredString,
  requireAtLeastOneDefined
} from "../../shared/validation";
import {
  createNewInventoryCodeFamily,
  getInventoryCodeFamilies,
  getInventoryCodeFamily,
  suggestInventoryCodePrefix,
  updateExistingInventoryCodeFamily
} from "./inventory-code.service";
import type {
  CreateInventoryCodeFamilyInput,
  InventoryCodeStrategy,
  InventoryEntityType,
  UpdateInventoryCodeFamilyInput
} from "./inventory-code.types";

const entityTypes = ["DISPOSITIVO", "SIM"] as const;
const strategies = ["REPEAT_PREFIX"] as const;

export const listInventoryCodeFamiliesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    sendCollection(res, await getInventoryCodeFamilies({
      activo: parseOptionalBoolean(req.query.activo, "activo"),
      tipoEntidad: parseOptionalEnum(
        req.query.tipoEntidad,
        "tipoEntidad",
        entityTypes
      ) as InventoryEntityType | undefined
    }));
  }
);

export const getInventoryCodeFamilyController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    sendItem(res, await getInventoryCodeFamily(
      parsePositiveInteger(req.params.id, "id")
    ));
  }
);

export const suggestInventoryCodePrefixController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    sendItem(res, await suggestInventoryCodePrefix());
  }
);

export const createInventoryCodeFamilyController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);
    const input: Omit<CreateInventoryCodeFamilyInput, "tipoActivoNormalizado"> = {
      nombreFamilia: parseRequiredString(body.nombreFamilia, "nombreFamilia", 100),
      prefijo: parseRequiredString(body.prefijo, "prefijo", 1),
      estrategiaCodigo: parseOptionalEnum(
        body.estrategiaCodigo,
        "estrategiaCodigo",
        strategies
      ) ?? "REPEAT_PREFIX",
      activo: parseOptionalBoolean(body.activo, "activo")
    };
    sendItem(res, await createNewInventoryCodeFamily(input), 201);
  }
);

export const updateInventoryCodeFamilyController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePositiveInteger(req.params.id, "id");
    const body = parseBodyObject(req.body);
    requireAtLeastOneDefined(body, [
      "nombreFamilia", "prefijo", "estrategiaCodigo", "activo"
    ]);
    const input: Omit<UpdateInventoryCodeFamilyInput, "tipoActivoNormalizado"> = {
      nombreFamilia: body.nombreFamilia === undefined
        ? undefined
        : parseRequiredString(body.nombreFamilia, "nombreFamilia", 100),
      prefijo: body.prefijo === undefined
        ? undefined
        : parseRequiredString(body.prefijo, "prefijo", 1),
      estrategiaCodigo: parseOptionalEnum(
        body.estrategiaCodigo,
        "estrategiaCodigo",
        strategies
      ) as InventoryCodeStrategy | undefined,
      activo: parseOptionalBoolean(body.activo, "activo")
    };
    sendItem(res, await updateExistingInventoryCodeFamily(id, input));
  }
);
