import { pool } from "../../config/database";

export const consultarResumenReporte=async()=>{
 const result=await pool.query(`
  SELECT
   COUNT(*) cantidad_total,COALESCE(SUM(d.valor_comercial),0) valor_total,
   COUNT(*) FILTER(WHERE e.codigo='DISPONIBLE') cantidad_disponible,
   COALESCE(SUM(d.valor_comercial) FILTER(WHERE e.codigo='DISPONIBLE'),0) valor_disponible,
   COUNT(*) FILTER(WHERE e.codigo='ASIGNADO') cantidad_asignada,
   COALESCE(SUM(d.valor_comercial) FILTER(WHERE e.codigo='ASIGNADO'),0) valor_asignado,
   COUNT(*) FILTER(WHERE d.colaborador_id IS NOT NULL) cantidad_colaborador,
   COALESCE(SUM(d.valor_comercial) FILTER(WHERE d.colaborador_id IS NOT NULL),0) valor_colaborador,
   COUNT(*) FILTER(WHERE d.departamento_id IS NOT NULL) cantidad_departamento,
   COALESCE(SUM(d.valor_comercial) FILTER(WHERE d.departamento_id IS NOT NULL),0) valor_departamento,
   COUNT(*) FILTER(WHERE e.codigo='SERVICIO_TECNICO') cantidad_servicio,
   COALESCE(SUM(d.valor_comercial) FILTER(WHERE e.codigo='SERVICIO_TECNICO'),0) valor_servicio,
   COUNT(*) FILTER(WHERE e.codigo='EXTRAVIADO') cantidad_extraviada,
   COALESCE(SUM(d.valor_comercial) FILTER(WHERE e.codigo='EXTRAVIADO'),0) valor_extraviado,
   COUNT(*) FILTER(WHERE e.codigo='DADO_BAJA') cantidad_baja,
   COALESCE((SELECT SUM(valor_comercial_momento) FROM itam.bajas_dispositivo),0) valor_baja
  FROM itam.dispositivos d JOIN itam.estados e ON e.id=d.estado_id`);
 return result.rows[0]!;
};

export const consultarMovimientosReporte=async(desde:string,hasta:string)=>{
 const result=await pool.query(`
  SELECT
   COUNT(*) FILTER(WHERE tipo_evento='ALTA_DISPOSITIVO') registrados,
   COUNT(*) FILTER(WHERE tipo_evento IN ('ASIGNAR_COLABORADOR','ASIGNAR_DEPARTAMENTO')) asignaciones,
   COUNT(*) FILTER(WHERE tipo_evento='DEVOLVER_DISPOSITIVO') devoluciones,
   COUNT(*) FILTER(WHERE tipo_evento='ENVIAR_SERVICIO_TECNICO') envios_servicio,
   COUNT(*) FILTER(WHERE tipo_evento='RETORNO_POST_SERVICIO_TECNICO') retornos_servicio,
   COUNT(*) FILTER(WHERE tipo_evento IN ('DAR_BAJA','DAR_BAJA_DESDE_SERVICIO')) bajas
  FROM itam.historial_eventos
  WHERE fecha_evento >= $1::date AND fecha_evento < ($2::date + INTERVAL '1 day')`,[desde,hasta]);
 return result.rows[0]!;
};

export const consultarOrganizacionReporte=async()=>{
 const result=await pool.query(`
  WITH RECURSIVE arbol AS (
   SELECT id AS descendiente_id,id AS ancestro_id FROM itam.departamentos
   UNION ALL
   SELECT arbol.descendiente_id,padre.dependencia_id
   FROM arbol JOIN itam.departamentos padre ON padre.id=arbol.ancestro_id
   WHERE padre.dependencia_id IS NOT NULL
  ), custodia AS (
   SELECT d.id,d.valor_comercial,COALESCE(d.departamento_id,c.departamento_id) departamento_id
   FROM itam.dispositivos d LEFT JOIN itam.colaboradores c ON c.id=d.colaborador_id
   WHERE COALESCE(d.departamento_id,c.departamento_id) IS NOT NULL
  )
  SELECT dep.id departamento_id,dep.nombre departamento,superior.nombre dependencia,
   COUNT(custodia.id) cantidad,COALESCE(SUM(custodia.valor_comercial),0) valor
  FROM itam.departamentos dep
  LEFT JOIN itam.departamentos superior ON superior.id=dep.dependencia_id
  LEFT JOIN arbol ON arbol.ancestro_id=dep.id
  LEFT JOIN custodia ON custodia.departamento_id=arbol.descendiente_id
  GROUP BY dep.id,dep.nombre,superior.nombre ORDER BY dep.nombre`);
 return result.rows;
};
