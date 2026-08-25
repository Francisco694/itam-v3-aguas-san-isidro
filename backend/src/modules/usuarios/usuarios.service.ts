import { pool } from "../../config/database";
import {
  ConflictError,
  NotFoundError,
  isUniqueViolation
} from "../../shared/errors";
import { hashPassword, hashPin } from "../../shared/password";

type UserRole = "SUPER_USUARIO" | "USUARIO";

interface UserRow {
  id: string | number;
  nombre: string;
  email: string;
  cargo: string | null;
  rol: UserRole;
  activo: boolean;
  pin_configurado: boolean;
  debe_cambiar_password: boolean;
  debe_cambiar_pin: boolean;
  creado_en: string;
  actualizado_en: string;
}

interface CreateUserInput {
  nombre: string;
  email: string;
  cargo: string;
  password: string;
  pin: string;
  rol: UserRole;
  activo?: boolean;
}

interface UpdateUserInput {
  nombre?: string | null;
  email?: string | null;
  cargo?: string | null;
  password?: string;
  pin?: string;
  rol?: UserRole;
  activo?: boolean;
}

const projection = `
  id, nombre, email, cargo, rol, activo,
  pin_hash IS NOT NULL AS pin_configurado,
  debe_cambiar_password, debe_cambiar_pin,
  creado_en, actualizado_en
`;

const safe = (row: UserRow) => ({
  id: String(row.id),
  nombre: row.nombre,
  email: row.email,
  cargo: row.cargo,
  rol: row.rol,
  activo: row.activo,
  pinConfigurado: row.pin_configurado,
  debeCambiarPassword: row.debe_cambiar_password,
  debeCambiarPin: row.debe_cambiar_pin,
  creadoEn: row.creado_en,
  actualizadoEn: row.actualizado_en
});

export const listarUsuarios = async () => {
  const result = await pool.query<UserRow>(
    `SELECT ${projection} FROM itam.usuarios ORDER BY nombre`
  );
  return result.rows.map(safe);
};

export const crearUsuario = async (input: CreateUserInput) => {
  try {
    const result = await pool.query<UserRow>(
      `INSERT INTO itam.usuarios(
         nombre, email, cargo, password_hash, pin_hash, rol, activo,
         debe_cambiar_password, debe_cambiar_pin
       ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE), TRUE, TRUE)
       RETURNING ${projection}`,
      [
        input.nombre,
        input.email,
        input.cargo,
        hashPassword(input.password),
        hashPin(input.pin),
        input.rol,
        input.activo ?? null
      ]
    );
    return safe(result.rows[0]!);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Ya existe un usuario con ese correo.");
    }
    throw error;
  }
};

export const actualizarUsuario = async (
  id: number,
  input: UpdateUserInput
) => {
  try {
    const result = await pool.query<UserRow>(
      `UPDATE itam.usuarios
          SET nombre = COALESCE($2, nombre),
              email = COALESCE($3, email),
              cargo = CASE WHEN $4::boolean THEN $5 ELSE cargo END,
              password_hash = COALESCE($6, password_hash),
              pin_hash = COALESCE($7, pin_hash),
              rol = COALESCE($8, rol),
              activo = COALESCE($9, activo),
              debe_cambiar_password =
                CASE WHEN $6::text IS NULL THEN debe_cambiar_password ELSE TRUE END,
              debe_cambiar_pin =
                CASE WHEN $7::text IS NULL THEN debe_cambiar_pin ELSE TRUE END,
              pin_intentos_fallidos =
                CASE WHEN $7::text IS NULL THEN pin_intentos_fallidos ELSE 0 END,
              pin_bloqueado_hasta =
                CASE WHEN $7::text IS NULL THEN pin_bloqueado_hasta ELSE NULL END
        WHERE id = $1
        RETURNING ${projection}`,
      [
        id,
        input.nombre ?? null,
        input.email ?? null,
        input.cargo !== undefined,
        input.cargo ?? null,
        input.password ? hashPassword(input.password) : null,
        input.pin ? hashPin(input.pin) : null,
        input.rol ?? null,
        input.activo ?? null
      ]
    );
    if (!result.rows[0]) {
      throw new NotFoundError("Usuario no encontrado.");
    }
    return safe(result.rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Ya existe un usuario con ese correo.");
    }
    throw error;
  }
};
