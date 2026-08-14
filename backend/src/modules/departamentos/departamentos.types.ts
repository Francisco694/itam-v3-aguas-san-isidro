export interface DepartamentoRow {
  id: string;
  nombre: string;
  activo: boolean;
  observaciones: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

export interface Departamento {
  id: string;
  nombre: string;
  activo: boolean;
  observaciones: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearDepartamentoInput {
  nombre: string;
  activo?: boolean;
  observaciones?: string | null;
}

export interface ActualizarDepartamentoInput {
  nombre?: string;
  activo?: boolean;
  observaciones?: string | null;
}
