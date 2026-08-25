import type{PoolClient}from "pg";import{pool}from "../../config/database";
export const listarFacturas=async()=>(await pool.query(`SELECT * FROM itam.facturas_adquisicion ORDER BY fecha_factura DESC NULLS LAST,id DESC`)).rows;
export const obtenerFacturaRow=async(id:number,client?:PoolClient)=>(await(client??pool).query(`SELECT * FROM itam.facturas_adquisicion WHERE id=$1`,[id])).rows[0]??null;
export const obtenerDispositivosFactura=async(id:number,client?:PoolClient)=>(await(client??pool).query(`SELECT d.id,d.codigo_inventario,t.nombre tipo,d.marca,d.modelo FROM itam.dispositivos d JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id WHERE d.factura_adquisicion_id=$1 ORDER BY d.codigo_inventario`,[id])).rows;
