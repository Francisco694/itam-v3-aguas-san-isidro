import type {
  ErrorRequestHandler,
  RequestHandler
} from "express";
import { AppError, NotFoundError } from "./errors";

export const notFoundHandler: RequestHandler = (
  req,
  _res,
  next
) => {
  next(
    new NotFoundError(
      `Endpoint no encontrado: ${req.method} ${req.originalUrl}`
    )
  );
};

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    });
    return;
  }

  console.error("Error inesperado:", error);

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Ocurrió un error inesperado."
    }
  });
};
