import type { Request, Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../shared/async-handler";
import { cookieValue, SESSION_COOKIE } from "../../shared/auth.middleware";
import { ValidationError } from "../../shared/errors";
import { sendItem } from "../../shared/responses";
import { parseBodyObject, parseRequiredString } from "../../shared/validation";
import {
  changeOwnPin,
  login,
  loginWithPin,
  logout
} from "./auth.service";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.nodeEnv === "production",
  path: "/",
  maxAge: 12 * 60 * 60 * 1000
};

const parsePin = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) {
    throw new ValidationError(`${field} debe contener exactamente 6 digitos.`);
  }
  return value;
};

const setSession = (res: Response, token: string): void => {
  res.cookie(SESSION_COOKIE, token, cookieOptions);
};

export const loginController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parseBodyObject(req.body);
    const result = await login(
      parseRequiredString(body.email, "email", 254),
      parseRequiredString(body.password, "password", 200)
    );
    setSession(res, result.token);
    sendItem(res, result.user);
  }
);

export const loginPinController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parseBodyObject(req.body);
    const result = await loginWithPin(
      parseRequiredString(body.email, "email", 254),
      parsePin(body.pin, "pin")
    );
    setSession(res, result.token);
    sendItem(res, result.user);
  }
);

export const meController = asyncHandler(
  async (req: Request, res: Response) => sendItem(res, req.authUser!)
);

export const changePinController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parseBodyObject(req.body);
    await changeOwnPin(
      req.authUser!.id,
      parsePin(body.currentPin, "currentPin"),
      parsePin(body.newPin, "newPin")
    );
    res.status(204).send();
  }
);

export const logoutController = asyncHandler(
  async (req: Request, res: Response) => {
    await logout(cookieValue(req.headers.cookie, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, {
      ...cookieOptions,
      maxAge: undefined
    });
    res.status(204).send();
  }
);
