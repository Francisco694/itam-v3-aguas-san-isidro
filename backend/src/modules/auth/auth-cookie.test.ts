import assert from "node:assert/strict";
import test from "node:test";
import app from "../../app";
import { sessionCookieOptions } from "../../shared/session-cookie";

test("la cookie HTTP no usa Secure y conserva sus protecciones", () => {
  const options = sessionCookieOptions({ secure: false });

  assert.equal(options.secure, false);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
});

test("la cookie HTTPS usa Secure cuando Express detecta el proxy", () => {
  const options = sessionCookieOptions({ secure: true });

  assert.equal(options.secure, true);
  assert.equal(app.get("trust proxy"), "loopback");
});
