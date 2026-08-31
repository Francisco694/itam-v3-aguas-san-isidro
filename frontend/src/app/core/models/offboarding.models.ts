import { Colaborador } from './itam.models';

export type OffboardingEstado = 'ABIERTO' | 'COMPLETADO';

export interface OffboardingUser {
  id: string;
  nombre: string;
  email: string;
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

export interface OffboardingProcessSummary {
  id: string;
  colaborador: Colaborador;
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

export interface OffboardingProcessDetail extends OffboardingProcessSummary {
  activosPendientes: OffboardingAsset[];
}

export interface OffboardingSearchResult {
  colaborador: Colaborador;
  equiposAsignados: number;
  valorAsignado: number;
  procesoAbiertoId: string | null;
}

export interface StartOffboardingInput {
  colaboradorId: number;
  observaciones?: string | null;
}
