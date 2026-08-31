import type { Request } from "express";
import { AppError } from "./errors";

export const authenticatedActorName = (req: Request): string => {
  const name = req.authUser?.nombre.trim();

  if (!name) {
    throw new AppError(
      401,
      "UNAUTHORIZED",
      "La sesión no permite identificar al responsable TI."
    );
  }

  return name;
};
