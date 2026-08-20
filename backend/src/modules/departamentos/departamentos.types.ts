export interface DepartamentoRow {
  id: string;
  nombre: string;
  activo: boolean;
  observaciones: string | null;
  dependencia_id: string | null;
  dependencia_nombre: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

export interface Departamento {
  id: string;
  nombre: string;
  activo: boolean;
  observaciones: string | null;
  dependencia_id: number | null;
  dependencia_nombre: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearDepartamentoInput {
  nombre: string;
  activo?: boolean;
  observaciones?: string | null;
  dependencia_id?: number | null;
}

export interface ActualizarDepartamentoInput {
  nombre?: string;
  activo?: boolean;
  observaciones?: string | null;
  dependencia_id?: number | null;
}

export interface InventarioDepartamento {
  departamento: Departamento;
  resumen: {
    custodiaDirecta: number;
    conColaboradores: number;
    totalRelacionado: number;
  };
  custodiaDirecta: import("../dispositivos/dispositivos.types").DispositivoResumen[];
  activosColaboradores: import("../dispositivos/dispositivos.types").DispositivoResumen[];
}
