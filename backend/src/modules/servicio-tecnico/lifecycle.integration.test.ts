import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../../config/database";
import { ConflictError } from "../../shared/errors";
import { assertSinOrdenServicioAbierta } from "../dispositivos/dispositivos.service";
import { DECLARACION_OBLIGATORIA_TRABAJADOR } from "../actas-entrega/actas-entrega.service";

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
 const client=await pool.connect();try{await client.query("BEGIN");
  const device=await client.query<{id:string}>("SELECT d.id FROM itam.dispositivos d WHERE NOT EXISTS(SELECT 1 FROM itam.ordenes_servicio_tecnico o WHERE o.dispositivo_id=d.id AND o.estado NOT IN ('CERRADA','BAJA','REPARACION_RECHAZADA')) LIMIT 1");assert.ok(device.rows[0]);
  await client.query("INSERT INTO itam.ordenes_servicio_tecnico(dispositivo_id,falla_reportada,responsable_envio) VALUES($1,'TEST bloqueo','TEST')",[device.rows[0]!.id]);
  await assert.rejects(assertSinOrdenServicioAbierta(device.rows[0]!.id,client),(error:unknown)=>error instanceof ConflictError&&error.message.includes("orden de servicio"));
 }finally{await client.query("ROLLBACK");client.release()}
});

test("las migraciones 009 a 012 están registradas y completas",async()=>{
 const migrations=await pool.query<{version:string}>("SELECT version FROM itam.schema_migrations WHERE version IN ('009','010','011','012') ORDER BY version");
 assert.deepEqual(migrations.rows.map(row=>row.version),['009','010','011','012']);
 const tables=await pool.query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='itam' AND table_name IN ('entregas_temporales_servicio','comprobantes_devolucion','secuencias_comprobante_devolucion') ORDER BY table_name");
 assert.equal(tables.rowCount,3);
});

test("todas las actas vigentes de trabajadores conservan la declaración obligatoria completa",async()=>{
 const result=await pool.query<{declaracion:string}>("SELECT declaracion FROM itam.actas_entrega WHERE colaborador_id IS NOT NULL");
 assert.ok(result.rows.length>0);for(const row of result.rows)assert.equal(row.declaracion,DECLARACION_OBLIGATORIA_TRABAJADOR);
});

test("el correlativo CD es anual y transaccional",async()=>{
 const client=await pool.connect();try{await client.query("BEGIN");const year=2198;
  const first=await client.query<{ultimo_numero:number}>("INSERT INTO itam.secuencias_comprobante_devolucion(anio,ultimo_numero) VALUES($1,1) ON CONFLICT(anio) DO UPDATE SET ultimo_numero=itam.secuencias_comprobante_devolucion.ultimo_numero+1 RETURNING ultimo_numero",[year]);
  const second=await client.query<{ultimo_numero:number}>("INSERT INTO itam.secuencias_comprobante_devolucion(anio,ultimo_numero) VALUES($1,1) ON CONFLICT(anio) DO UPDATE SET ultimo_numero=itam.secuencias_comprobante_devolucion.ultimo_numero+1 RETURNING ultimo_numero",[year]);
  assert.equal(second.rows[0]!.ultimo_numero,first.rows[0]!.ultimo_numero+1);
 }finally{await client.query("ROLLBACK");client.release()}
});
