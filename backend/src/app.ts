import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pool } from "./config/database";
import { env } from "./config/env";
import {
  errorHandler,
  notFoundHandler
} from "./shared/error.middleware";
import estadosRoutes from "./modules/estados/estados.routes";
import departamentosRoutes from "./modules/departamentos/departamentos.routes";
import colaboradoresRoutes from "./modules/colaboradores/colaboradores.routes";
import dispositivosRoutes from "./modules/dispositivos/dispositivos.routes";
import simRoutes from "./modules/sim/sim.routes";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin:
      env.corsOrigin
        ? env.corsOrigin
        : env.nodeEnv === "development"
          ? "http://localhost:4200"
          : false
  })
);
app.use(express.json());

app.use("/api/v1/estados", estadosRoutes);
app.use("/api/v1/departamentos", departamentosRoutes);
app.use("/api/v1/colaboradores", colaboradoresRoutes);
app.use("/api/v1/dispositivos", dispositivosRoutes);
app.use("/api/v1/sim", simRoutes);


// ============================================================
// HEALTH CHECK - API
// ============================================================

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "ITAM v3.0 API",
    status: "OK",
    timestamp: new Date().toISOString()
  });
});


// ============================================================
// HEALTH CHECK - DATABASE
// ============================================================

app.get(
  "/api/v1/health/database",
  async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          NOW() AS database_time,
          current_database() AS database,
          current_user AS user
      `);

      res.status(200).json({
        success: true,
        service: "PostgreSQL",
        status: "OK",
        database: result.rows[0].database,
        user: result.rows[0].user,
        databaseTime: result.rows[0].database_time
      });

    } catch (error) {
      console.error(
        "Error comprobando PostgreSQL:",
        error
      );

      res.status(503).json({
        success: false,
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "PostgreSQL no se encuentra disponible."
        }
      });
    }
  }
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
