import { NotFoundError } from "../../shared/errors";
import { toIsoDateTime } from "../../shared/dates";
import { obtenerDispositivoPorCodigo } from "../dispositivos/dispositivos.repository";
import { listarCustodiasPorCodigoDispositivo } from "./custodias.repository";
import type {
  CustodiaDispositivoDetalle,
  CustodiaDispositivoDetalleRow
} from "./custodias.types";

const mapCustodia = (
  row: CustodiaDispositivoDetalleRow
): CustodiaDispositivoDetalle => ({
  id: row.id,
  dispositivoCodigoInventario: row.dispositivo_codigo_inventario,
  vigente: row.vigente,
  fechaInicio: row.fecha_inicio ? toIsoDateTime(row.fecha_inicio) : null,
  fechaFin: row.fecha_fin ? toIsoDateTime(row.fecha_fin) : null,
  tipoInicio: row.tipo_inicio,
  tipoCierre: row.tipo_cierre,
  fechaCierreRealConocida: row.fecha_cierre_real_conocida,
  origen: row.origen,
  referenciaOrigen: row.referencia_origen,
  evidencia: row.evidencia,
  nivelConfianza: row.nivel_confianza,
  custodio: row.colaborador_id
    ? {
        tipo: "COLABORADOR",
        id: row.colaborador_id,
        nombre: row.colaborador_nombre!,
        rut: row.colaborador_rut!
      }
    : {
        tipo: "DEPARTAMENTO",
        id: row.departamento_id!,
        nombre: row.departamento_nombre!
      },
  usuarioEjecutor: row.usuario_ejecutor_nombre,
  cerradoEn: row.cerrado_en ? toIsoDateTime(row.cerrado_en) : null
});

export const obtenerCustodiasDispositivo = async (
  codigoInventario: number
): Promise<CustodiaDispositivoDetalle[]> => {
  if (!(await obtenerDispositivoPorCodigo(codigoInventario))) {
    throw new NotFoundError("Dispositivo no encontrado.");
  }
  return (await listarCustodiasPorCodigoDispositivo(codigoInventario)).map(
    mapCustodia
  );
};