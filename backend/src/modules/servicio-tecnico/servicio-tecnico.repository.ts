import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import type { EntregaTemporalRow, OrdenServicioRow } from "./servicio-tecnico.types";

export const selectOrden = `
 SELECT o.*,d.codigo_inventario,t.nombre AS tipo_dispositivo,d.marca,d.modelo,
        d.numero_serie,d.imei,d.valor_comercial, custodio.nombre AS colaborador_nombre_al_ingreso,
        custodio.rut AS colaborador_rut_al_ingreso,
        departamento.nombre AS departamento_nombre_al_ingreso,
        recepcionante.nombre AS recibido_por_nombre_al_ingreso,
        (SELECT COUNT(*) FROM itam.ordenes_servicio_tecnico prev
          WHERE prev.dispositivo_id=o.dispositivo_id AND prev.id<>o.id
            AND prev.estado IN ('CERRADA','BAJA')) AS reparaciones_anteriores,
        (SELECT COALESCE(SUM(prev.costo_final),0) FROM itam.ordenes_servicio_tecnico prev
          WHERE prev.dispositivo_id=o.dispositivo_id AND prev.costo_final IS NOT NULL) AS costo_acumulado
 FROM itam.ordenes_servicio_tecnico o
 JOIN itam.dispositivos d ON d.id=o.dispositivo_id
 JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id
 LEFT JOIN itam.colaboradores custodio ON custodio.id=o.colaborador_id_al_ingreso
 LEFT JOIN itam.departamentos departamento ON departamento.id=o.departamento_id_al_ingreso
 LEFT JOIN itam.colaboradores recepcionante ON recepcionante.id=o.recibido_por_id_al_ingreso`;

export const listarOrdenes = async ():Promise<OrdenServicioRow[]> =>
  (await pool.query<OrdenServicioRow>(`${selectOrden} ORDER BY o.fecha_envio DESC`)).rows;

export const obtenerOrden = async (id:number,client?:PoolClient):Promise<OrdenServicioRow|null> =>
  ((await (client??pool).query<OrdenServicioRow>(`${selectOrden} WHERE o.id=$1 LIMIT 1`,[id])).rows[0]??null);

export const obtenerOrdenAbiertaPorDispositivo = async (
  dispositivoId:string,client:PoolClient
):Promise<OrdenServicioRow|null> =>
  ((await client.query<OrdenServicioRow>(`${selectOrden} WHERE o.dispositivo_id=$1
    AND o.estado NOT IN ('CERRADA','BAJA','REPARACION_RECHAZADA') LIMIT 1 FOR UPDATE OF o`,[dispositivoId])).rows[0]??null);

const selectTemporal=`SELECT entrega.*,dispositivo.codigo_inventario,tipo.nombre AS tipo_dispositivo,
 dispositivo.marca,dispositivo.modelo,colaborador.nombre AS colaborador_nombre,
 colaborador.rut AS colaborador_rut
 FROM itam.entregas_temporales_servicio entrega
 INNER JOIN itam.dispositivos dispositivo ON dispositivo.id=entrega.dispositivo_temporal_id
 INNER JOIN itam.tipos_dispositivo tipo ON tipo.id=dispositivo.tipo_dispositivo_id
 INNER JOIN itam.colaboradores colaborador ON colaborador.id=entrega.colaborador_id`;

export const listarEntregasTemporales=async(ordenId:string,client?:PoolClient):Promise<EntregaTemporalRow[]> =>
 (await(client??pool).query<EntregaTemporalRow>(`${selectTemporal} WHERE entrega.orden_servicio_id=$1 ORDER BY entrega.fecha_entrega DESC`,[ordenId])).rows;

export const obtenerEntregaTemporal=async(id:number,client:PoolClient):Promise<EntregaTemporalRow|null> =>
 ((await client.query<EntregaTemporalRow>(`${selectTemporal} WHERE entrega.id=$1 LIMIT 1 FOR UPDATE OF entrega`,[id])).rows[0]??null);
