export interface DepartamentoResumen {
  id: string;
  nombre: string;
}

export interface ColaboradorRow {
  id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
  localidad: string | null;
  activo: boolean;
  observaciones: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

export interface Colaborador {
  id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
  departamento: DepartamentoResumen | null;
  localidad: string | null;
  activo: boolean;
  observaciones: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ColaboradorFilters {
  nombre?: string;
  rut?: string;
  departamentoId?: number;
  activo?: boolean;
}

export interface CrearColaboradorInput {
  rut: string;
  nombre: string;
  cargo?: string | null;
  departamentoId?: number | null;
  localidad?: string | null;
  activo?: boolean;
  observaciones?: string | null;
}

export interface ActualizarColaboradorInput {
  rut?: string;
  nombre?: string;
  cargo?: string | null;
  departamentoId?: number | null;
  localidad?: string | null;
  activo?: boolean;
  observaciones?: string | null;
}
