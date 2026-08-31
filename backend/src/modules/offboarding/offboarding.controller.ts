import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseOptionalString,
  parsePositiveInteger,
  parseRequiredString
} from "../../shared/validation";
import {
  closeOffboardingProcess,
  findCollaboratorsForOffboarding,
  getOffboardingProcess,
  getOpenOffboardingProcesses,
  startOffboardingProcess
} from "./offboarding.service";

const authUserId = (req: Request): string => req.authUser!.id;

export const listOpenOffboardingController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    sendCollection(res, await getOpenOffboardingProcesses());
  }
);

export const searchOffboardingCollaboratorsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = parseRequiredString(req.query.q, "q", 180);
    sendCollection(res, await findCollaboratorsForOffboarding(query));
  }
);

export const getOffboardingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    sendItem(
      res,
      await getOffboardingProcess(parsePositiveInteger(req.params.id, "id"))
    );
  }
);

export const startOffboardingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);
    const process = await startOffboardingProcess({
      colaboradorId: parsePositiveInteger(
        body.colaboradorId,
        "colaboradorId"
      ),
      usuarioId: authUserId(req),
      observaciones: parseOptionalString(
        body.observaciones,
        "observaciones"
      )
    });
    sendItem(res, process, 201);
  }
);

export const closeOffboardingController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    sendItem(
      res,
      await closeOffboardingProcess({
        procesoId: parsePositiveInteger(req.params.id, "id"),
        usuarioId: authUserId(req)
      })
    );
  }
);
