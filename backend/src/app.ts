import express from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
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
import inventoryCodeRoutes from "./modules/inventory-codes/inventory-code.routes";
import tiposDispositivoRoutes from "./modules/tipos-dispositivo/tipos-dispositivo.routes";
import servicioTecnicoRoutes from "./modules/servicio-tecnico/servicio-tecnico.routes";
import actasEntregaRoutes from "./modules/actas-entrega/actas-entrega.routes";
import comprobantesDevolucionRoutes from "./modules/comprobantes-devolucion/comprobantes-devolucion.routes";
import reportesRoutes from "./modules/reportes/reportes.routes";
import facturasAdquisicionRoutes from "./modules/facturas-adquisicion/facturas-adquisicion.routes";
import authRoutes from "./modules/auth/auth.routes";
import usuariosRoutes from "./modules/usuarios/usuarios.routes";
import { auditMutations, requireAuth } from "./shared/auth.middleware";

const app = express();

const configuredCorsOrigin =
  env.corsOrigin?.trim() ||
  (env.nodeEnv === "development"
    ? "http://localhost:4200"
    : undefined);

if (configuredCorsOrigin === "*") {
  throw new Error(
    "CORS_ORIGIN debe indicar un origen explícito; no se permite '*'."
  );
}

const corsOptions: CorsOptions = {
  origin: configuredCorsOrigin ?? false,
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use("/api/v1/auth",authRoutes);
app.use((req,res,next)=>req.path.startsWith("/api/v1/health")?next():requireAuth(req,res,next));
app.use(auditMutations);

app.use("/api/v1/estados", estadosRoutes);
app.use("/api/v1/departamentos", departamentosRoutes);
app.use("/api/v1/colaboradores", colaboradoresRoutes);
app.use("/api/v1/dispositivos", dispositivosRoutes);
app.use("/api/v1/sim", simRoutes);
app.use("/api/v1/familias-codigo", inventoryCodeRoutes);
app.use("/api/v1/tipos-dispositivo", tiposDispositivoRoutes);
app.use("/api/v1/servicio-tecnico", servicioTecnicoRoutes);
app.use("/api/v1/actas-entrega", actasEntregaRoutes);
app.use("/api/v1/comprobantes-devolucion", comprobantesDevolucionRoutes);
app.use("/api/v1/reportes",reportesRoutes);
app.use("/api/v1/facturas-adquisicion",facturasAdquisicionRoutes);
app.use("/api/v1/usuarios",usuariosRoutes);


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
