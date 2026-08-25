import { pool } from "../config/database";
import { hashPassword } from "../shared/password";

type UserRole = "SUPER_USUARIO" | "USUARIO";

interface BootstrapUser {
  nombre: string;
  email: string;
  password: string;
  rol: UserRole;
  cargo: string;
}

const roles = new Set<UserRole>(["SUPER_USUARIO", "USUARIO"]);

const requiredValue = (index: number, field: string): string => {
  const key = `BOOTSTRAP_USER_${index}_${field}`;
  const value = process.env[key];

  if (!value?.trim()) {
    throw new Error(`Defina ${key} solo para esta ejecución.`);
  }

  return field === "PASSWORD" ? value : value.trim();
};

const readUser = (index: number): BootstrapUser => {
  const rol = requiredValue(index, "ROLE") as UserRole;
  const password = requiredValue(index, "PASSWORD");

  if (!roles.has(rol)) {
    throw new Error(
      `BOOTSTRAP_USER_${index}_ROLE debe ser SUPER_USUARIO o USUARIO.`
    );
  }

  if (password.length < 8) {
    throw new Error(
      `BOOTSTRAP_USER_${index}_PASSWORD debe tener al menos 8 caracteres.`
    );
  }

  return {
    nombre: requiredValue(index, "NAME"),
    email: requiredValue(index, "EMAIL").toLowerCase(),
    password,
    rol,
    cargo: requiredValue(index, "CARGO")
  };
};

const bootstrapUsers = async (): Promise<void> => {
  const users = [1, 2, 3].map(readUser);
  let created = 0;
  let updated = 0;

  await pool.query("BEGIN");

  try {
    for (const user of users) {
      const existing = await pool.query(
        `SELECT id
           FROM itam.usuarios
          WHERE LOWER(BTRIM(email)) = LOWER(BTRIM($1))
          LIMIT 1`,
        [user.email]
      );

      await pool.query(
        `INSERT INTO itam.usuarios (
           nombre,
           email,
           password_hash,
           rol,
           cargo,
           activo,
           debe_cambiar_password
         )
         VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
         ON CONFLICT ((LOWER(BTRIM(email))))
         DO UPDATE SET
           nombre = EXCLUDED.nombre,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           rol = EXCLUDED.rol,
           cargo = EXCLUDED.cargo,
           activo = TRUE,
           debe_cambiar_password = TRUE`,
        [
          user.nombre,
          user.email,
          hashPassword(user.password),
          user.rol,
          user.cargo
        ]
      );

      if (existing.rowCount === 0) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    await pool.query("COMMIT");

    console.log(
      JSON.stringify({
        creados: created,
        actualizados: updated,
        correos: users.map((user) => user.email)
      })
    );
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
};

void bootstrapUsers()
  .catch(() => {
    console.error("No fue posible inicializar los usuarios.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
