import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import type { ComprobanteDevolucionRow, CrearComprobanteInput } from "./comprobantes-devolucion.types";

const selectComprobante = `SELECT comprobante.*, dispositivo.codigo_inventario,
 tipo.nombre AS tipo_dispositivo, dispositivo.marca, dispositivo.modelo,
 dispositivo.numero_serie, dispositivo.imei, detalle.acta_entrega_id,
 acta.numero_acta, colaborador.nombre AS colaborador_nombre,
 colaborador.rut AS colaborador_rut, departamento.nombre AS departamento_nombre,
 devuelto_por.nombre AS devuelto_por_nombre, devuelto_por.rut AS devuelto_por_rut
 FROM itam.comprobantes_devolucion comprobante
 INNER JOIN itam.dispositivos dispositivo ON dispositivo.id=comprobante.dispositivo_id
 INNER JOIN itam.tipos_dispositivo tipo ON tipo.id=dispositivo.tipo_dispositivo_id
 LEFT JOIN itam.actas_entrega_detalle detalle ON detalle.id=comprobante.acta_entrega_detalle_id
 LEFT JOIN itam.actas_entrega acta ON acta.id=detalle.acta_entrega_id
 LEFT JOIN itam.colaboradores colaborador ON colaborador.id=comprobante.colaborador_id
 LEFT JOIN itam.departamentos departamento ON departamento.id=comprobante.departamento_id
 LEFT JOIN itam.colaboradores devuelto_por ON devuelto_por.id=comprobante.devuelto_por_id`;

export const buscarActaDetalleVigente = async (
  dispositivoId:string,colaboradorId:string|null,departamentoId:string|null,client:PoolClient
):Promise<string|null> => {
  const result=await client.query<{id:string}>(`SELECT detalle.id
   FROM itam.actas_entrega_detalle detalle
   INNER JOIN itam.actas_entrega acta ON acta.id=detalle.acta_entrega_id
   WHERE detalle.dispositivo_id=$1 AND acta.estado='EMITIDA'
     AND (($2::bigint IS NOT NULL AND acta.colaborador_id=$2)
       OR ($3::bigint IS NOT NULL AND acta.departamento_id=$3))
     AND NOT EXISTS (SELECT 1 FROM itam.comprobantes_devolucion comprobante
       WHERE comprobante.acta_entrega_detalle_id=detalle.id)
   ORDER BY acta.fecha DESC,acta.id DESC LIMIT 1 FOR UPDATE OF detalle`,
   [dispositivoId,colaboradorId,departamentoId]);
  return result.rows[0]?.id??null;
};

export const crearComprobante = async (input:CrearComprobanteInput,client:PoolClient):Promise<ComprobanteDevolucionRow> => {
  const year=new Date().getFullYear();
  const sequence=await client.query<{ultimo_numero:number}>(`INSERT INTO itam.secuencias_comprobante_devolucion(anio,ultimo_numero)
    VALUES($1,1) ON CONFLICT(anio) DO UPDATE SET ultimo_numero=itam.secuencias_comprobante_devolucion.ultimo_numero+1 RETURNING ultimo_numero`,[year]);
  const numero=`CD-${year}-${String(sequence.rows[0]!.ultimo_numero).padStart(6,"0")}`;
  const inserted=await client.query<{id:string}>(`INSERT INTO itam.comprobantes_devolucion(
    numero_comprobante,dispositivo_id,acta_entrega_detalle_id,colaborador_id,
    departamento_id,devuelto_por_id,condicion,resultado,observaciones,responsable_ti,origen)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,[
      numero,input.dispositivoId,input.actaEntregaDetalleId,input.colaboradorId,
      input.departamentoId,input.devueltoPorId,input.condicion??null,input.resultado,
      input.observaciones??null,input.responsableTi,input.origen]);
  return (await obtenerComprobantePorId(inserted.rows[0]!.id,client))!;
};

export const obtenerComprobantePorId=async(id:string,client?:PoolClient):Promise<ComprobanteDevolucionRow|null> =>
 ((await(client??pool).query<ComprobanteDevolucionRow>(`${selectComprobante} WHERE comprobante.id=$1 LIMIT 1`,[id])).rows[0]??null);
export const listarComprobantes=async():Promise<ComprobanteDevolucionRow[]> =>
 (await pool.query<ComprobanteDevolucionRow>(`${selectComprobante} ORDER BY comprobante.fecha DESC,comprobante.id DESC`)).rows;

