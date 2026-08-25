import app from "./app";
import { pool } from "./config/database";
import { env } from "./config/env";

const startServer = async (): Promise<void> => {
  try {
    await pool.query("SELECT 1");

    console.log("PostgreSQL conectado correctamente");

    app.listen(env.port, env.host, () => {
      console.log("========================================");
      console.log(" ITAM v3.0 - Aguas San Isidro");
      console.log(" Backend iniciado correctamente");
      console.log(` API: http://${env.host}:${env.port}`);
      console.log(
        ` Health: http://${env.host}:${env.port}/api/v1/health`
      );
      console.log(
        ` Database: http://${env.host}:${env.port}/api/v1/health/database`
      );
      console.log("========================================");
    });
  } catch (error) {
    console.error(
      "No fue posible conectar con PostgreSQL."
    );

    console.error(error);

    process.exit(1);
  }
};

startServer();
