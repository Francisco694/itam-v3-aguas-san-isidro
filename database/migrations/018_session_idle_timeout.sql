
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'itam'
  AND table_name = 'sesiones_usuario'
  AND column_name = 'ultima_actividad';