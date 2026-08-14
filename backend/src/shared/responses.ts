import type { Response } from "express";

export const sendItem = <T>(
  res: Response,
  data: T,
  statusCode = 200
): void => {
  res.status(statusCode).json({
    success: true,
    data
  });
};

export const sendCollection = <T>(
  res: Response,
  data: T[]
): void => {
  res.status(200).json({
    success: true,
    count: data.length,
    data
  });
};
