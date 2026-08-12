import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "ITAM v3.0 API",
    status: "OK",
    timestamp: new Date().toISOString()
  });
});

export default app;