import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pool } from "./config/database";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

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
        databaseTime:
          result.rows[0].database_time
      });
    } catch (error) {
      console.error(
        "Error comprobando PostgreSQL:",
        error
      );

      res.status(503).json({
        success: false,
        service: "PostgreSQL",
        status: "UNAVAILABLE"
      });
    }
  }
);

export default app;