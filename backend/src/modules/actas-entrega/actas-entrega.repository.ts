import type {PoolClient} from "pg";
import {pool} from "../../config/database";
import type {ActaDetalleRow,ActaRow} from "./actas-entrega.types";

const selectActa=`SELECT a.*,c.nombre colaborador_nombre,c.rut colaborador_rut,c.cargo colaborador_cargo,
 d.nombre departamento_nombre,r.nombre recepcionante_nombre,r.rut recepcionante_rut,r.cargo recepcionante_cargo
 FROM itam.actas_entrega a LEFT JOIN itam.colaboradores c ON c.id=a.colaborador_id
 LEFT JOIN itam.departamentos d ON d.id=a.departamento_id
 LEFT JOIN itam.colaboradores r ON r.id=a.recepcionante_id`;
export const listarActas=async():Promise<ActaRow[]>=>
 (await pool.query<ActaRow>(`${selectActa} ORDER BY a.fecha DESC`)).rows;
export const obtenerActa=async(id:number,client?:PoolClient):Promise<ActaRow|null>=>
 ((await (client??pool).query<ActaRow>(`${selectActa} WHERE a.id=$1`,[id])).rows[0]??null);
export const listarDetalleActa=async(id:number,client?:PoolClient):Promise<ActaDetalleRow[]>=>
 (await (client??pool).query<ActaDetalleRow>(`SELECT detalle.*,
   comprobante.id AS comprobante_id,
   comprobante.numero_comprobante,
   comprobante.fecha AS fecha_devolucion,
   comprobante.resultado AS resultado_devolucion,
   EXISTS(
     SELECT 1 FROM itam.historial_eventos historial
     WHERE historial.dispositivo_id=detalle.dispositivo_id
       AND historial.tipo_evento='DEVOLVER_DISPOSITIVO'
       AND historial.fecha_evento>=acta.fecha
   ) AS devuelto_historico
   FROM itam.actas_entrega_detalle detalle
   INNER JOIN itam.actas_entrega acta ON acta.id=detalle.acta_entrega_id
   LEFT JOIN itam.comprobantes_devolucion comprobante
     ON comprobante.acta_entrega_detalle_id=detalle.id
   WHERE detalle.acta_entrega_id=$1
   ORDER BY detalle.codigo_inventario`,[id])).rows;
