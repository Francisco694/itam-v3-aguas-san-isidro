import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { currentUserId } from "../../shared/auth-context";
import type {
  CustodiaDispositivoDetalleRow,
  AsociacionSimDispositivoRow,
  CustodiaDispositivoRow,
  CustodiaSimRow,
  NivelConfianza,
  TipoCierreCustodia
} from "./custodias.types";

export interface CrearCustodiaDispositivoInput {
  dispositivoId: string;
  colaboradorId?: string | number | null;
  departamentoId?: string | number | null;
  fechaInicio?: Date | string | null;
  tipoInicio:
    | "ASIGNACION"
    | "ASIGNACION_DEPARTAMENTO"
    | "IMPORTACION_HISTORICA"
    | "RECONSTRUCCION_HISTORICA"
    | "CORRECCION_ADMINISTRATIVA";
  origen: string;
  referenciaOrigen?: string | null;
  evidencia?: Record<string, unknown>;
  nivelConfianza: NivelConfianza;
  usuarioEjecutorId?: string | number | null;
}

export interface CerrarCustodiaDispositivoInput {
  tipoCierre: TipoCierreCustodia;
  fechaFin?: Date | string | null;
  fechaCierreRealConocida: boolean;
  evidencia?: Record<string, unknown>;
}

export const obtenerCustodiaVigenteDispositivo = async (
  dispositivoId: string,
  client: PoolClient,
  forUpdate = false
): Promise<CustodiaDispositivoRow | null> => {
  const result = await client.query<CustodiaDispositivoRow>(
    `
      SELECT *
      FROM itam.custodias_dispositivo
      WHERE dispositivo_id = $1
        AND vigente = TRUE
      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [dispositivoId]
  );
  return result.rows[0] ?? null;
};

export const crearCustodiaDispositivo = async (
  input: CrearCustodiaDispositivoInput,
  client: PoolClient
): Promise<CustodiaDispositivoRow> => {
  const result = await client.query<CustodiaDispositivoRow>(
    `
      INSERT INTO itam.custodias_dispositivo (
        dispositivo_id,
        colaborador_id,
        departamento_id,
        fecha_inicio,
        vigente,
        tipo_inicio,
        origen,
        referencia_origen,
        evidencia,
        nivel_confianza,
        usuario_ejecutor_id
      )
      VALUES ($1,$2,$3,$4,TRUE,$5,$6,$7,$8::JSONB,$9,$10)
      RETURNING *
    `,
    [
      input.dispositivoId,
      input.colaboradorId ?? null,
      input.departamentoId ?? null,
      input.fechaInicio ?? new Date(),
      input.tipoInicio,
      input.origen,
      input.referenciaOrigen ?? null,
      JSON.stringify(input.evidencia ?? {}),
      input.nivelConfianza,
      input.usuarioEjecutorId ?? currentUserId()
    ]
  );
  return result.rows[0]!;
};

export const cerrarCustodiaDispositivo = async (
  custodiaId: string,
  input: CerrarCustodiaDispositivoInput,
  client: PoolClient
): Promise<CustodiaDispositivoRow | null> => {
  const result = await client.query<CustodiaDispositivoRow>(
    `
      UPDATE itam.custodias_dispositivo
      SET vigente = FALSE,
          fecha_fin = $2,
          tipo_cierre = $3,
          fecha_cierre_real_conocida = $4,
          evidencia = evidencia || $5::JSONB,
          cerrado_en = NOW()
      WHERE id = $1
        AND vigente = TRUE
      RETURNING *
    `,
    [
      custodiaId,
      input.fechaFin ?? null,
      input.tipoCierre,
      input.fechaCierreRealConocida,
      JSON.stringify(input.evidencia ?? {})
    ]
  );
  return result.rows[0] ?? null;
};


export const listarCustodiasPorCodigoDispositivo = async (
  codigoInventario: number
): Promise<CustodiaDispositivoDetalleRow[]> => {
  const result = await pool.query<CustodiaDispositivoDetalleRow>(
    `
      SELECT
        custodia.*,
        dispositivo.codigo_inventario AS dispositivo_codigo_inventario,
        colaborador.rut AS colaborador_rut,
        colaborador.nombre AS colaborador_nombre,
        departamento.nombre AS departamento_nombre,
        usuario.nombre AS usuario_ejecutor_nombre
      FROM itam.custodias_dispositivo custodia
      INNER JOIN itam.dispositivos dispositivo
        ON dispositivo.id = custodia.dispositivo_id
      LEFT JOIN itam.colaboradores colaborador
        ON colaborador.id = custodia.colaborador_id
      LEFT JOIN itam.departamentos departamento
        ON departamento.id = custodia.departamento_id
      LEFT JOIN itam.usuarios usuario
        ON usuario.id = custodia.usuario_ejecutor_id
      WHERE dispositivo.codigo_inventario = $1
      ORDER BY custodia.vigente DESC,
               custodia.fecha_inicio DESC NULLS LAST,
               custodia.id DESC
    `,
    [codigoInventario]
  );
  return result.rows;
};
export const obtenerCustodiaVigenteSim = async (
  simId: string,
  client: PoolClient,
  forUpdate = false
): Promise<CustodiaSimRow | null> => {
  const result = await client.query<CustodiaSimRow>(
    `SELECT * FROM itam.custodias_sim
      WHERE sim_id=$1 AND vigente=TRUE
      LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [simId]
  );
  return result.rows[0] ?? null;
};

export const crearCustodiaSim = async (
  input: Omit<CrearCustodiaDispositivoInput, "dispositivoId"> & { simId: string },
  client: PoolClient
): Promise<CustodiaSimRow> => {
  const result = await client.query<CustodiaSimRow>(
    `INSERT INTO itam.custodias_sim(
       sim_id,colaborador_id,departamento_id,fecha_inicio,vigente,tipo_inicio,
       origen,referencia_origen,evidencia,nivel_confianza,usuario_ejecutor_id
     ) VALUES($1,$2,$3,$4,TRUE,$5,$6,$7,$8::JSONB,$9,$10)
     RETURNING *`,
    [input.simId,input.colaboradorId ?? null,input.departamentoId ?? null,
     input.fechaInicio ?? new Date(),input.tipoInicio,input.origen,
     input.referenciaOrigen ?? null,JSON.stringify(input.evidencia ?? {}),
     input.nivelConfianza,input.usuarioEjecutorId ?? currentUserId()]
  );
  return result.rows[0]!;
};

export const cerrarCustodiaSim = async (
  custodiaId: string,
  input: CerrarCustodiaDispositivoInput,
  client: PoolClient
): Promise<CustodiaSimRow | null> => {
  const result = await client.query<CustodiaSimRow>(
    `UPDATE itam.custodias_sim
        SET vigente=FALSE,fecha_fin=$2,tipo_cierre=$3,
            fecha_cierre_real_conocida=$4,evidencia=evidencia || $5::JSONB,
            cerrado_en=NOW()
      WHERE id=$1 AND vigente=TRUE RETURNING *`,
    [custodiaId,input.fechaFin ?? null,input.tipoCierre,
     input.fechaCierreRealConocida,JSON.stringify(input.evidencia ?? {})]
  );
  return result.rows[0] ?? null;
};

export const obtenerAsociacionVigenteSim = async (
  simId: string,
  client: PoolClient,
  forUpdate = false
): Promise<AsociacionSimDispositivoRow | null> => {
  const result = await client.query<AsociacionSimDispositivoRow>(
    `SELECT * FROM itam.asociaciones_sim_dispositivo
      WHERE sim_id=$1 AND vigente=TRUE
      LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [simId]
  );
  return result.rows[0] ?? null;
};

export const obtenerAsociacionVigenteDispositivo = async (
  dispositivoId: string,
  client: PoolClient
): Promise<AsociacionSimDispositivoRow | null> => {
  const result = await client.query<AsociacionSimDispositivoRow>(
    `SELECT * FROM itam.asociaciones_sim_dispositivo
      WHERE dispositivo_id=$1 AND vigente=TRUE LIMIT 1`,
    [dispositivoId]
  );
  return result.rows[0] ?? null;
};

export const crearAsociacionSimDispositivo = async (
  simId: string,
  dispositivoId: string,
  evidencia: Record<string, unknown>,
  client: PoolClient
): Promise<AsociacionSimDispositivoRow> => {
  const result = await client.query<AsociacionSimDispositivoRow>(
    `INSERT INTO itam.asociaciones_sim_dispositivo(
       sim_id,dispositivo_id,fecha_inicio,vigente,origen,evidencia,
       nivel_confianza,usuario_ejecutor_id
     ) VALUES($1,$2,NOW(),TRUE,'API',$3::JSONB,'ALTA',$4)
     RETURNING *`,
    [simId,dispositivoId,JSON.stringify(evidencia),currentUserId()]
  );
  return result.rows[0]!;
};

export const cerrarAsociacionSimDispositivo = async (
  asociacionId: string,
  evidencia: Record<string, unknown>,
  client: PoolClient
): Promise<AsociacionSimDispositivoRow | null> => {
  const result = await client.query<AsociacionSimDispositivoRow>(
    `UPDATE itam.asociaciones_sim_dispositivo
        SET vigente=FALSE,fecha_fin=NOW(),evidencia=evidencia || $2::JSONB,
            cerrado_en=NOW()
      WHERE id=$1 AND vigente=TRUE RETURNING *`,
    [asociacionId,JSON.stringify(evidencia)]
  );
  return result.rows[0] ?? null;
};