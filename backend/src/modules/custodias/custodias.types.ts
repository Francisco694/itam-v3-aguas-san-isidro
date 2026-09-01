export type NivelConfianza = "ALTA" | "MEDIA" | "BAJA" | "MANUAL";

export type TipoCierreCustodia =
  | "DEVOLUCION"
  | "REASIGNACION"
  | "BAJA"
  | "EXTRAVIO"
  | "OFFBOARDING"
  | "CONCILIACION_HISTORICA"
  | "CORRECCION_ADMINISTRATIVA";

export interface CustodiaDispositivoRow {
  id: string;
  dispositivo_id: string;
  colaborador_id: string | null;
  departamento_id: string | null;
  fecha_inicio: Date | string | null;
  fecha_fin: Date | string | null;
  vigente: boolean;
  tipo_inicio: string;
  tipo_cierre: TipoCierreCustodia | null;
  fecha_cierre_real_conocida: boolean;
  origen: string;
  referencia_origen: string | null;
  evidencia: Record<string, unknown>;
  nivel_confianza: NivelConfianza;
  cerrado_en: Date | string | null;
}

export interface CustodiaDispositivoDetalleRow extends CustodiaDispositivoRow {
  dispositivo_codigo_inventario: number;
  colaborador_rut: string | null;
  colaborador_nombre: string | null;
  departamento_nombre: string | null;
  usuario_ejecutor_nombre: string | null;
}

export interface CustodiaDispositivoDetalle {
  id: string;
  dispositivoCodigoInventario: number;
  vigente: boolean;
  fechaInicio: string | null;
  fechaFin: string | null;
  tipoInicio: string;
  tipoCierre: TipoCierreCustodia | null;
  fechaCierreRealConocida: boolean;
  origen: string;
  referenciaOrigen: string | null;
  evidencia: Record<string, unknown>;
  nivelConfianza: NivelConfianza;
  custodio: {
    tipo: "COLABORADOR" | "DEPARTAMENTO";
    id: string;
    nombre: string;
    rut?: string;
  };
  usuarioEjecutor: string | null;
  cerradoEn: string | null;
}
export interface CustodiaSimRow {
  id: string;
  sim_id: string;
  colaborador_id: string | null;
  departamento_id: string | null;
  fecha_inicio: Date | string | null;
  fecha_fin: Date | string | null;
  vigente: boolean;
  tipo_inicio: string;
  tipo_cierre: TipoCierreCustodia | null;
  fecha_cierre_real_conocida: boolean;
  evidencia: Record<string, unknown>;
}

export interface AsociacionSimDispositivoRow {
  id: string;
  sim_id: string;
  dispositivo_id: string;
  fecha_inicio: Date | string | null;
  fecha_fin: Date | string | null;
  vigente: boolean;
  evidencia: Record<string, unknown>;
}