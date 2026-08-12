import app from "./app";

const PORT = 3000;

app.listen(PORT, () => {
  console.log("========================================");
  console.log(" ITAM v3.0 - Aguas San Isidro");
  console.log(" Backend iniciado correctamente");
  console.log(` API: http://localhost:${PORT}`);
  console.log(` Health: http://localhost:${PORT}/api/v1/health`);
  console.log("========================================");
});