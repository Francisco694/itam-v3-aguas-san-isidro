import { toIsoDateTime } from "../../shared/dates";
import { listarEstados } from "./estados.repository";
import type {
  Estado,
  EstadoFilters,
  EstadoRow
} from "./estados.types";

export const mapEstado = (row: EstadoRow): Estado => ({
  id: row.id,
  tipoEntidad: row.tipo_entidad,
  codigo: row.codigo,
  nombre: row.nombre,
  descripcion: row.descripcion,
  esTerminal: row.es_terminal,
  activo: row.activo,
  creadoEn: toIsoDateTime(row.creado_en)
});

export const obtenerEstados = async (
  filters: EstadoFilters
): Promise<Estado[]> => {
  const rows = await listarEstados(filters);

  return rows.map(mapEstado);
};
