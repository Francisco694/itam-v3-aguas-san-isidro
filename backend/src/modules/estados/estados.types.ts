export const tiposEntidad = ["DISPOSITIVO", "SIM"] as const;

export type TipoEntidad = (typeof tiposEntidad)[number];

export interface EstadoRow {
  id: string;
  tipo_entidad: TipoEntidad;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  es_terminal: boolean;
  activo: boolean;
  creado_en: Date | string;
}

export interface Estado {
  id: string;
  tipoEntidad: TipoEntidad;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esTerminal: boolean;
  activo: boolean;
  creadoEn: string;
}

export interface EstadoFilters {
  tipoEntidad?: TipoEntidad;
}
