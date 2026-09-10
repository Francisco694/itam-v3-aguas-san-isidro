import { pool } from "../../config/database";
import type { StockAlertRow, UpdateStockAlertInput } from "./stock-alerts.types";

const stockAlertSelect = `
  SELECT tipo.id AS tipo_dispositivo_id,
         tipo.nombre AS tipo_dispositivo_nombre,
         COUNT(dispositivo.id) FILTER (
           WHERE estado.codigo = 'DISPONIBLE'
         ) AS disponibles,
         COALESCE(config.minimo_disponible, 0) AS minimo_disponible,
         COALESCE(config.alerta_activa, FALSE) AS alerta_activa,
         config.creado_por_usuario_id,
         creador.nombre AS creado_por_usuario_nombre,
         config.actualizado_por_usuario_id,
         actualizador.nombre AS actualizado_por_usuario_nombre,
         config.creado_en,
         config.actualizado_en
    FROM itam.tipos_dispositivo tipo
    LEFT JOIN itam.configuraciones_alerta_stock config
      ON config.tipo_dispositivo_id = tipo.id
    LEFT JOIN itam.dispositivos dispositivo
      ON dispositivo.tipo_dispositivo_id = tipo.id
    LEFT JOIN itam.estados estado
      ON estado.id = dispositivo.estado_id
    LEFT JOIN itam.usuarios creador
      ON creador.id = config.creado_por_usuario_id
    LEFT JOIN itam.usuarios actualizador
      ON actualizador.id = config.actualizado_por_usuario_id
   GROUP BY tipo.id, tipo.nombre, config.minimo_disponible,
            config.alerta_activa, config.creado_por_usuario_id, creador.nombre,
            config.actualizado_por_usuario_id, actualizador.nombre,
            config.creado_en, config.actualizado_en`;

export const listStockAlertRows = async (): Promise<StockAlertRow[]> =>
  (await pool.query<StockAlertRow>(`${stockAlertSelect}
    ORDER BY CASE UPPER(BTRIM(tipo.nombre))
      WHEN 'SMARTPHONE' THEN 0 WHEN 'NOTEBOOK' THEN 1 ELSE 2 END,
      tipo.nombre`)).rows;

export const updateStockAlertRow = async (
  tipoDispositivoId: number,
  input: UpdateStockAlertInput
): Promise<void> => {
  await pool.query(
    `INSERT INTO itam.configuraciones_alerta_stock(
       tipo_dispositivo_id, minimo_disponible, alerta_activa,
       creado_por_usuario_id, actualizado_por_usuario_id
     ) VALUES ($1,$2,$3,$4,$4)
     ON CONFLICT (tipo_dispositivo_id) DO UPDATE
       SET minimo_disponible = EXCLUDED.minimo_disponible,
           alerta_activa = EXCLUDED.alerta_activa,
           actualizado_por_usuario_id = EXCLUDED.actualizado_por_usuario_id`,
    [tipoDispositivoId, input.minimoDisponible, input.alertaActiva, input.usuarioId]
  );
};
