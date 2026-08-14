export type TipoEntidad = 'DISPOSITIVO' | 'SIM';
export interface EstadoResumen { id: string; codigo: string; nombre: string; }
export interface DepartamentoResumen { id: string; nombre: string; }
export interface ColaboradorResumen { id: string; rut: string; nombre: string; cargo: string | null; localidad?: string | null; }

export interface Estado extends EstadoResumen { tipoEntidad: TipoEntidad; descripcion: string | null; esTerminal: boolean; activo: boolean; creadoEn: string; }
export interface Departamento { id: string; nombre: string; activo: boolean; observaciones: string | null; creadoEn: string; actualizadoEn: string; }
export interface DepartamentoInput { nombre: string; activo?: boolean; observaciones?: string | null; }

export interface Colaborador {
  id: string; rut: string; nombre: string; cargo: string | null; departamento: DepartamentoResumen | null;
  localidad: string | null; activo: boolean; observaciones: string | null; creadoEn: string; actualizadoEn: string;
}
export interface ColaboradorFilters { nombre?: string; rut?: string; departamentoId?: number; activo?: boolean; }
export interface ColaboradorInput { rut: string; nombre: string; cargo?: string | null; departamentoId?: number | null; localidad?: string | null; activo?: boolean; observaciones?: string | null; }

export interface SimAsociadaResumen { id: string; codigoInventario: number; iccidCodigoFabrica: string; numeroAsociado: string | null; compania: string | null; estado: EstadoResumen | null; }
export interface Dispositivo {
  id: string; codigoInventario: number; tipoDispositivo: string; marca: string | null; modelo: string | null;
  numeroSerie: string | null; imei: string | null; localidad: string | null; ubicacionDetalle: string | null;
  observaciones: string | null; fechaRegistro: string; creadoEn: string; actualizadoEn: string; estado: EstadoResumen;
  colaborador: ColaboradorResumen | null; departamento: DepartamentoResumen | null; recibidoPor: ColaboradorResumen | null; simAsociada: SimAsociadaResumen | null;
}
export interface DispositivoFilters { q?: string; tipo?: string; estado?: string; colaboradorId?: number; departamentoId?: number; localidad?: string; }
export interface DispositivoInput { codigoInventario?: number; tipoDispositivo: string; marca?: string | null; modelo?: string | null; numeroSerie?: string | null; imei?: string | null; localidad?: string | null; ubicacionDetalle?: string | null; observaciones?: string | null; responsable?: string; }
export interface ResponsableInput { responsable: string; observaciones?: string | null; }
export interface AsignarDispositivoColaboradorInput extends ResponsableInput { colaboradorId: number; }
export interface AsignarDispositivoDepartamentoInput extends ResponsableInput { departamentoId: number; recibidoPorId: number; localidad?: string | null; ubicacionDetalle?: string | null; }
export interface CambiarEstadoInput extends ResponsableInput { estadoId: number; }

export interface SimDispositivoResumen { id: string; codigoInventario: number; tipoDispositivo: string; marca: string | null; modelo: string | null; estado: EstadoResumen | null; }
export interface Sim {
  id: string; codigoInventario: number; iccidCodigoFabrica: string; numeroAsociado: string | null; compania: string | null;
  estado: EstadoResumen; colaborador: ColaboradorResumen | null; dispositivo: SimDispositivoResumen | null;
  observaciones: string | null; fechaRegistro: string; creadoEn: string; actualizadoEn: string;
}
export interface SimInput { codigoInventario?: number; iccidCodigoFabrica: string; numeroAsociado?: string | null; compania?: string | null; observaciones?: string | null; responsable?: string; }
export interface AsociarDispositivoInput extends ResponsableInput { dispositivoCodigoInventario: number; }
export interface AsignarSimColaboradorInput extends ResponsableInput { colaboradorId: number; }

export interface HistorialEvento {
  id: string; tipoEntidad: TipoEntidad; dispositivoId?: string; simId?: string; tipoEvento: string;
  estadoAnterior: EstadoResumen | null; estadoNuevo: EstadoResumen | null; responsable: string;
  observaciones: string | null; detalle: Record<string, unknown>; fechaEvento: string;
}
