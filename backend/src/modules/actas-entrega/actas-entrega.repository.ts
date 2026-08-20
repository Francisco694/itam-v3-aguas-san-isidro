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
 (await (client??pool).query<ActaDetalleRow>(`SELECT * FROM itam.actas_entrega_detalle WHERE acta_entrega_id=$1 ORDER BY codigo_inventario`,[id])).rows;
