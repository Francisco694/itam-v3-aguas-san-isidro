import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import type { OrdenServicioRow } from "./servicio-tecnico.types";

export const selectOrden = `
 SELECT o.*,d.codigo_inventario,t.nombre AS tipo_dispositivo,d.marca,d.modelo,
        d.valor_comercial,
        (SELECT COUNT(*) FROM itam.ordenes_servicio_tecnico prev
          WHERE prev.dispositivo_id=o.dispositivo_id AND prev.id<>o.id
            AND prev.estado IN ('CERRADA','BAJA')) AS reparaciones_anteriores,
        (SELECT COALESCE(SUM(prev.costo_final),0) FROM itam.ordenes_servicio_tecnico prev
          WHERE prev.dispositivo_id=o.dispositivo_id AND prev.costo_final IS NOT NULL) AS costo_acumulado
 FROM itam.ordenes_servicio_tecnico o
 JOIN itam.dispositivos d ON d.id=o.dispositivo_id
 JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id`;

export const listarOrdenes = async ():Promise<OrdenServicioRow[]> =>
  (await pool.query<OrdenServicioRow>(`${selectOrden} ORDER BY o.fecha_envio DESC`)).rows;

export const obtenerOrden = async (id:number,client?:PoolClient):Promise<OrdenServicioRow|null> =>
  ((await (client??pool).query<OrdenServicioRow>(`${selectOrden} WHERE o.id=$1 LIMIT 1`,[id])).rows[0]??null);

export const obtenerOrdenAbiertaPorDispositivo = async (
  dispositivoId:string,client:PoolClient
):Promise<OrdenServicioRow|null> =>
  ((await client.query<OrdenServicioRow>(`${selectOrden} WHERE o.dispositivo_id=$1
    AND o.estado NOT IN ('CERRADA','BAJA','REPARACION_RECHAZADA') LIMIT 1 FOR UPDATE OF o`,[dispositivoId])).rows[0]??null);
