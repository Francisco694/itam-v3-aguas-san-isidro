import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../../config/database";
import { ConflictError } from "../../shared/errors";
import { asignarAColaborador } from "../dispositivos/dispositivos.service";

after(async()=>{await pool.end()});

test("la migración patrimonial agrega valor comercial no negativo",async()=>{
 const result=await pool.query<{version:string}>("SELECT version FROM itam.schema_migrations WHERE version='008'");assert.equal(result.rows[0]?.version,"008");
 const client=await pool.connect();try{await client.query("BEGIN");await assert.rejects(client.query("UPDATE itam.dispositivos SET valor_comercial=-1 WHERE id=(SELECT id FROM itam.dispositivos LIMIT 1)"),(e:unknown)=>(e as {code?:string}).code==="23514");}finally{await client.query("ROLLBACK");client.release()}
});

test("la recepción departamental conserva departamento y persona receptora",async()=>{
 const columns=await pool.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='itam' AND table_name='dispositivos' AND column_name IN ('departamento_id','recibido_por_id')");assert.deepEqual(new Set(columns.rows.map(r=>r.column_name)),new Set(["departamento_id","recibido_por_id"]));
});

test("las órdenes técnicas persisten diagnóstico, cotización y costos",async()=>{
 const columns=await pool.query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='itam' AND table_name='ordenes_servicio_tecnico'");const names=new Set(columns.rows.map(r=>r.column_name));for(const name of ["diagnostico","monto_cotizacion","decision","costo_final","estado"])assert.ok(names.has(name));
});

test("PostgreSQL rechaza montos negativos de cotización",async()=>{
 const client=await pool.connect();try{await client.query("BEGIN");const device=await client.query<{id:string}>("SELECT id FROM itam.dispositivos LIMIT 1");await assert.rejects(client.query("INSERT INTO itam.ordenes_servicio_tecnico(dispositivo_id,falla_reportada,responsable_envio,monto_cotizacion) VALUES($1,'TEST falla','TEST',-1)",[device.rows[0]!.id]),(e:unknown)=>(e as {code?:string}).code==="23514");}finally{await client.query("ROLLBACK");client.release()}
});

test("un dispositivo no admite dos órdenes técnicas abiertas",async()=>{
 const client=await pool.connect();try{await client.query("BEGIN");const device=await client.query<{id:string}>("SELECT d.id FROM itam.dispositivos d WHERE NOT EXISTS(SELECT 1 FROM itam.ordenes_servicio_tecnico o WHERE o.dispositivo_id=d.id) LIMIT 1");await client.query("INSERT INTO itam.ordenes_servicio_tecnico(dispositivo_id,falla_reportada,responsable_envio) VALUES($1,'TEST 1','TEST')",[device.rows[0]!.id]);await assert.rejects(client.query("INSERT INTO itam.ordenes_servicio_tecnico(dispositivo_id,falla_reportada,responsable_envio) VALUES($1,'TEST 2','TEST')",[device.rows[0]!.id]),(e:unknown)=>(e as {code?:string}).code==="23505");}finally{await client.query("ROLLBACK");client.release()}
});

test("la baja exige motivo controlado y valor histórico",async()=>{
 const client=await pool.connect();try{await client.query("BEGIN");const device=await client.query<{id:string}>("SELECT d.id FROM itam.dispositivos d WHERE NOT EXISTS(SELECT 1 FROM itam.bajas_dispositivo b WHERE b.dispositivo_id=d.id) LIMIT 1");await assert.rejects(client.query("INSERT INTO itam.bajas_dispositivo(dispositivo_id,motivo,valor_comercial_momento,responsable) VALUES($1,'INVALIDO',0,'TEST')",[device.rows[0]!.id]),(e:unknown)=>(e as {code?:string}).code==="23514");}finally{await client.query("ROLLBACK");client.release()}
});

test("la numeración anual de actas es correlativa y transaccional",async()=>{
 const client=await pool.connect();try{await client.query("BEGIN");const year=2199;const first=await client.query<{ultimo_numero:number}>("INSERT INTO itam.secuencias_acta_entrega(anio,ultimo_numero) VALUES($1,1) ON CONFLICT(anio) DO UPDATE SET ultimo_numero=itam.secuencias_acta_entrega.ultimo_numero+1 RETURNING ultimo_numero",[year]);const second=await client.query<{ultimo_numero:number}>("INSERT INTO itam.secuencias_acta_entrega(anio,ultimo_numero) VALUES($1,1) ON CONFLICT(anio) DO UPDATE SET ultimo_numero=itam.secuencias_acta_entrega.ultimo_numero+1 RETURNING ultimo_numero",[year]);assert.equal(second.rows[0]!.ultimo_numero,first.rows[0]!.ultimo_numero+1);}finally{await client.query("ROLLBACK");client.release()}
});

test("un acta admite varios equipos sin duplicar el mismo activo",async()=>{
 const constraints=await pool.query<{constraint_name:string}>("SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema='itam' AND table_name='actas_entrega_detalle' AND constraint_type='UNIQUE'");assert.ok(constraints.rows.some(r=>r.constraint_name==='uq_acta_detalle_dispositivo'));
});

test("una orden tecnica abierta bloquea la asignacion del dispositivo",async()=>{
 const open=await pool.query<{codigo_inventario:number}>("SELECT d.codigo_inventario FROM itam.dispositivos d JOIN itam.ordenes_servicio_tecnico o ON o.dispositivo_id=d.id WHERE o.estado NOT IN ('CERRADA','BAJA','REPARACION_RECHAZADA') LIMIT 1");
 const person=await pool.query<{id:string}>("SELECT id FROM itam.colaboradores WHERE activo=true LIMIT 1");
 assert.ok(open.rows[0]);assert.ok(person.rows[0]);
 await assert.rejects(
  asignarAColaborador(open.rows[0]!.codigo_inventario,{colaboradorId:Number(person.rows[0]!.id),responsable:"TEST",observaciones:"TEST bloqueo"}),
  (error:unknown)=>error instanceof ConflictError&&error.message.includes("orden de servicio")
 );
});
