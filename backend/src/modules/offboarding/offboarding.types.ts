export type OffboardingEstado = "ABIERTO" | "COMPLETADO";

export interface OffboardingCollaborator {
  id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
  departamento: { id: string; nombre: string } | null;
  localidad: string | null;
  activo: boolean;
  observaciones: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface OffboardingUser {
  id: string;
  nombre: string;
  email: string;
}

export interface OffboardingProcessRow {
  id: string;
  colaborador_id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
  localidad: string | null;
  colaborador_activo: boolean;
  colaborador_observaciones: string | null;
  colaborador_creado_en: Date | string;
  colaborador_actualizado_en: Date | string;
  fecha_inicio: Date | string;
  estado: OffboardingEstado;
  usuario_inicio_id: string;
  usuario_inicio_nombre: string;
  usuario_inicio_email: string;
  observaciones: string | null;
  fecha_cierre: Date | string | null;
  usuario_cierre_id: string | null;
  usuario_cierre_nombre: string | null;
  usuario_cierre_email: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
  equipos_pendientes: string;
  valor_pendiente: string;
  valor_recuperado: string;
}

export interface OffboardingAssetRow {
  id: string;
  codigo_inventario: number;
  tipo_id: string;
  tipo_nombre: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  imei: string | null;
  valor_comercial: string;
  estado_id: string;
  estado_codigo: string;
  estado_nombre: string;
}

export interface OffboardingSearchRow {
  colaborador_id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
  localidad: string | null;
  colaborador_activo: boolean;
  colaborador_observaciones: string | null;
  colaborador_creado_en: Date | string;
  colaborador_actualizado_en: Date | string;
  equipos_asignados: string;
  valor_asignado: string;
  proceso_abierto_id: string | null;
}

export interface OffboardingProcessSummary {
  id: string;
  colaborador: OffboardingCollaborator;
  fechaInicio: string;
  estado: OffboardingEstado;
  usuarioInicio: OffboardingUser;
  observaciones: string | null;
  fechaCierre: string | null;
  usuarioCierre: OffboardingUser | null;
  creadoEn: string;
  actualizadoEn: string;
  equiposPendientes: number;
  valorPendiente: number;
  valorRecuperado: number;
  valorTotal: number;
}

export interface OffboardingAsset {
  id: string;
  codigoInventario: number;
  tipo: { id: string; nombre: string };
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  imei: string | null;
  valorComercial: number;
  estado: { id: string; codigo: string; nombre: string };
}

export interface OffboardingProcessDetail extends OffboardingProcessSummary {
  activosPendientes: OffboardingAsset[];
}

export interface OffboardingSearchResult {
  colaborador: OffboardingCollaborator;
  equiposAsignados: number;
  valorAsignado: number;
  procesoAbiertoId: string | null;
}

export interface StartOffboardingInput {
  colaboradorId: number;
  usuarioId: string;
  observaciones?: string | null;
}

export interface CloseOffboardingInput {
  procesoId: number;
  usuarioId: string;
}
