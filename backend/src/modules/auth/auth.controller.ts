import type { Request, Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../shared/async-handler";
import { cookieValue, SESSION_COOKIE } from "../../shared/auth.middleware";
import { ValidationError } from "../../shared/errors";
import { sendItem } from "../../shared/responses";
import { parseBodyObject, parseRequiredString } from "../../shared/validation";
import {
  changeOwnPassword,
  changeOwnPin,
  login,
  loginWithPin,
  logout,
  refreshSession
} from "./auth.service";
import { sessionCookieOptions } from "../../shared/session-cookie";

const parsePin = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) {
    throw new ValidationError(`${field} debe contener exactamente 6 digitos.`);
  }
  return value;
};

const parsePassword = (value: unknown, field: string): string => {
  const password = parseRequiredString(value, field, 200);
  if (password.length < 12) {
    throw new ValidationError(`${field} debe contener al menos 12 caracteres.`);
  }
  return password;
};

const setSession = (req: Request, res: Response, token: string): void => {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
};

export const loginController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parseBodyObject(req.body);
    const result = await login(
      parseRequiredString(body.email, "email", 254),
      parseRequiredString(body.password, "password", 200)
    );
    setSession(req, res, result.token);
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
    setSession(req, res, result.token);
    sendItem(res, result.user);
  }
);

export const meController = asyncHandler(
  async (req: Request, res: Response) => sendItem(res, req.authUser!)
);

export const refreshSessionController = asyncHandler(
  async (req: Request, res: Response) => {
    await refreshSession(cookieValue(req.headers.cookie, SESSION_COOKIE));
    sendItem(res, {
      idleTimeoutMinutes: env.session.idleTimeoutMinutes,
      idleWarningMinutes: env.session.idleWarningMinutes
    });
  }
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

export const changePasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = parseBodyObject(req.body);
    await changeOwnPassword(
      req.authUser!.id,
      parseRequiredString(body.currentPassword,"currentPassword",200),
      parsePassword(body.newPassword,"newPassword")
    );
    res.status(204).send();
  }
);

export const logoutController = asyncHandler(
  async (req: Request, res: Response) => {
    await logout(cookieValue(req.headers.cookie, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, {
      ...sessionCookieOptions(req),
      maxAge: undefined
    });
    res.status(204).send();
  }
);
