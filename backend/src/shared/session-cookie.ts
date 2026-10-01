import type { CookieOptions, Request } from "express";

export const SESSION_COOKIE_MAX_AGE = 12 * 60 * 60 * 1000;

export const sessionCookieOptions = (
  request: Pick<Request, "secure">
): CookieOptions => ({
  httpOnly: true,
  sameSite: "lax",
  secure: request.secure,
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE
});
