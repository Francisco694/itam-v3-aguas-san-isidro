import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { pool } from "../config/database";
import { env } from "../config/env";
import { AppError } from "./errors";
import { runWithAuthUser, type AuthUser } from "./auth-context";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

interface SessionRow {
  id: string | number;
  nombre: string;
  email: string;
  cargo: string | null;
  rol: AuthUser["rol"];
  debe_cambiar_password: boolean;
  debe_cambiar_pin: boolean;
  usuario_activo: boolean;
  revocado_en: Date | string | null;
  absoluto_vigente: boolean;
  inactividad_vigente: boolean;
  requiere_actualizacion: boolean;
}

export const SESSION_COOKIE = "itam_session";

export const cookieValue = (
  header: string | undefined,
  name: string
): string | undefined =>
  header
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(name + "="))
    ?.slice(name.length + 1);

export const tokenHash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const credentialChangeEndpoints = new Set([
  "GET /api/v1/auth/me",
  "POST /api/v1/auth/refresh-session",
  "POST /api/v1/auth/change-password",
  "POST /api/v1/auth/change-pin",
  "POST /api/v1/auth/logout"
]);

export const credentialChangeEndpointAllowed = (
  method: string,
  originalUrl: string
): boolean => credentialChangeEndpoints.has(
  `${method.toUpperCase()} ${originalUrl.split("?")[0]}`
);

export const mustRestrictForCredentialChange = (
  user: Pick<AuthUser,"debeCambiarPassword"|"debeCambiarPin">,
  method: string,
  originalUrl: string
): boolean => (user.debeCambiarPassword || user.debeCambiarPin) &&
  !credentialChangeEndpointAllowed(method,originalUrl);

const revokeIdleSession = async (
  sessionHash: string
): Promise<void> => {
  await pool.query(
    `WITH revoked AS (
       UPDATE itam.sesiones_usuario
          SET revocado_en = NOW()
        WHERE token_hash = $1 AND revocado_en IS NULL
        RETURNING usuario_id
     )
     INSERT INTO itam.auditoria_operaciones(
       usuario_ejecutor_id, metodo, ruta, codigo_respuesta,
       tipo_entidad, entidad_id, detalle
     )
     SELECT usuario_id, 'SYSTEM', '/api/v1/auth/session-idle', 401,
            'AUTH', usuario_id::TEXT,
            jsonb_build_object('evento', 'SESSION_EXPIRED_IDLE')
       FROM revoked`,
    [sessionHash]
  );
};

const updateActivityIfDue = async (sessionHash: string): Promise<void> => {
  await pool.query(
    `UPDATE itam.sesiones_usuario
        SET ultima_actividad = NOW()
      WHERE token_hash = $1
        AND revocado_en IS NULL
        AND expira_en > NOW()
        AND ultima_actividad >
            NOW() - ($2 * INTERVAL '1 minute')
        AND ultima_actividad <=
            NOW() - ($3 * INTERVAL '1 minute')`,
    [
      sessionHash,
      env.session.idleTimeoutMinutes,
      env.session.activityRefreshMinutes
    ]
  );
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
    if (!token) {
      throw new AppError(401, "AUTH_REQUIRED", "Debe iniciar sesion.");
    }

    const sessionHash = tokenHash(token);
    const result = await pool.query<SessionRow>(
      `SELECT u.id, u.nombre, u.email, u.cargo, u.rol,
              u.debe_cambiar_password, u.debe_cambiar_pin,
              u.activo AS usuario_activo, s.revocado_en,
              s.expira_en > NOW() AS absoluto_vigente,
              s.ultima_actividad >
                NOW() - ($2 * INTERVAL '1 minute') AS inactividad_vigente,
              s.ultima_actividad <=
                NOW() - ($3 * INTERVAL '1 minute') AS requiere_actualizacion
         FROM itam.sesiones_usuario s
         JOIN itam.usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = $1
        LIMIT 1`,
      [
        sessionHash,
        env.session.idleTimeoutMinutes,
        env.session.activityRefreshMinutes
      ]
    );
    const row = result.rows[0];

    if (!row || row.revocado_en || !row.absoluto_vigente || !row.usuario_activo) {
      throw new AppError(
        401,
        "INVALID_SESSION",
        "La sesion no es valida o expiro."
      );
    }

    if (!row.inactividad_vigente) {
      await revokeIdleSession(sessionHash);
      throw new AppError(
        401,
        "SESSION_EXPIRED_IDLE",
        "Tu sesion expiro por inactividad. Vuelve a ingresar."
      );
    }

    if (
      row.requiere_actualizacion &&
      req.path !== "/refresh-session"
    ) {
      await updateActivityIfDue(sessionHash);
    }

    const user: AuthUser = {
      id: String(row.id),
      nombre: row.nombre,
      email: row.email,
      cargo: row.cargo ?? null,
      rol: row.rol,
      debeCambiarPassword: Boolean(row.debe_cambiar_password),
      debeCambiarPin: Boolean(row.debe_cambiar_pin)
    };
    req.authUser = user;
    if (mustRestrictForCredentialChange(user,req.method,req.originalUrl)) {
      throw new AppError(
        403,
        "CREDENTIAL_CHANGE_REQUIRED",
        "Debe actualizar sus credenciales antes de continuar."
      );
    }
    runWithAuthUser(user, next);
  } catch (error) {
    next(error);
  }
};

export const requireRole =
  (role: AuthUser["rol"]): RequestHandler =>
  (req, _res, next) =>
    req.authUser?.rol === role
      ? next()
      : next(
          new AppError(
            403,
            "FORBIDDEN",
            "No tiene permisos para realizar esta operacion."
          )
        );

export const auditMutations: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  res.on("finish", () => {
    void pool
      .query(
        `INSERT INTO itam.auditoria_operaciones(
           usuario_ejecutor_id, metodo, ruta, codigo_respuesta,
           tipo_entidad, entidad_id, detalle
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [
          req.authUser?.id ?? null,
          req.method,
          req.baseUrl + req.path,
          res.statusCode,
          req.baseUrl.split("/").pop() ?? null,
          req.params.id ?? req.params.codigo ?? null,
          JSON.stringify({ query: req.query })
        ]
      )
      .catch((error) =>
        console.error("No fue posible registrar auditoria:", error)
      );
  });
  next();
};
