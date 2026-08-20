export type TipoEntidad = 'DISPOSITIVO' | 'SIM';
export interface EstadoResumen { id: string; codigo: string; nombre: string; }
export interface DepartamentoResumen { id: string; nombre: string; }
export interface ColaboradorResumen { id: string; rut: string; nombre: string; cargo: string | null; localidad?: string | null; departamento?: DepartamentoResumen | null; }
export type InventoryCodeStrategy = 'REPEAT_PREFIX';
export interface AssociatedDeviceType { id: string; nombre: string; activo: boolean; }
export interface InventoryCodeFamily {
  id: string; tipoEntidad: TipoEntidad; tipoActivo: string | null; nombreFamilia: string;
  prefijo: string; activo: boolean; estrategiaCodigo: InventoryCodeStrategy; versionEsquema: number;
  ultimoOrdinal: number; proximoCodigoEstimado: number | null; tiposAsociados: AssociatedDeviceType[];
  creadoEn: string; actualizadoEn: string; tieneCodigosEmitidos: boolean;
  agrupaTipos: boolean; etiquetaOperativa: string | null;
}
export interface InventoryCodeFamilyInput { nombreFamilia: string; prefijo: string; estrategiaCodigo: InventoryCodeStrategy; activo?: boolean; }
export interface PrefixSuggestion { prefijo: string | null; disponible: boolean; mensaje: string; }
export type TipoCampoFormulario = 'text' | 'select' | 'number';
export interface CampoEspecificoFormulario { clave: string; etiqueta: string; tipo: TipoCampoFormulario; requerido: boolean; maxLength?: number; min?: number; max?: number; opciones?: string[]; }
export interface ConfiguracionFormularioTipo { mostrarMarca: boolean; mostrarModelo: boolean; mostrarNumeroSerie: boolean; camposEspecificos: CampoEspecificoFormulario[]; }
export interface FamiliaCodigoTipoDispositivo { id: string; nombre: string; prefijo: string; activo: boolean; estrategiaCodigo: InventoryCodeStrategy; agrupaTipos: boolean; etiquetaOperativa: string | null; }
export interface TipoDispositivo { id: string; nombre: string; descripcion: string | null; activo: boolean; requiereImei: boolean; configuracionFormulario: ConfiguracionFormularioTipo; familiaCodigoInventario: FamiliaCodigoTipoDispositivo | null; creadoEn: string; actualizadoEn: string; }
export interface TipoDispositivoInput { nombre: string; descripcion?: string | null; familiaCodigoInventarioId?: number | null; activo?: boolean; requiereImei?: boolean; }

export interface Estado extends EstadoResumen { tipoEntidad: TipoEntidad; descripcion: string | null; esTerminal: boolean; activo: boolean; creadoEn: string; }
export interface Departamento { id: string; nombre: string; activo: boolean; observaciones: string | null; dependencia_id?: number | null; dependencia_nombre?: string | null; creadoEn: string; actualizadoEn: string; }
export interface DepartamentoInput { nombre: string; activo?: boolean; observaciones?: string | null; dependencia_id?: number | null; }

export interface Colaborador {
  id: string; rut: string; nombre: string; cargo: string | null; departamento: DepartamentoResumen | null;
  localidad: string | null; activo: boolean; observaciones: string | null; creadoEn: string; actualizadoEn: string;
}
export interface ColaboradorFilters { nombre?: string; rut?: string; departamentoId?: number; activo?: boolean; }
export interface ColaboradorInput { rut: string; nombre: string; cargo?: string | null; departamentoId?: number | null; localidad?: string | null; activo?: boolean; observaciones?: string | null; }

export interface SimAsociadaResumen { id: string; codigoInventario: number; iccidCodigoFabrica: string; numeroAsociado: string | null; compania: string | null; estado: EstadoResumen | null; }
export interface Dispositivo {
  id: string; codigoInventario: number; tipoDispositivo: string; marca: string | null; modelo: string | null;
  tipo: TipoDispositivo;
  numeroSerie: string | null; imei: string | null; localidad: string | null; ubicacionDetalle: string | null;
  observaciones: string | null; fechaRegistro: string; creadoEn: string; actualizadoEn: string; estado: EstadoResumen;
  atributosEspecificos: Record<string, string | number | null>;
  valorComercial: number;
  colaborador: ColaboradorResumen | null; departamento: DepartamentoResumen | null; recibidoPor: ColaboradorResumen | null; simAsociada: SimAsociadaResumen | null; tipoCustodia: 'NONE'|'COLABORADOR'|'DEPARTAMENTO';
  ultimoResultadoOffboarding: ResultadoOffboarding | null;
}
export interface DispositivoFilters { q?: string; tipo?: string; tipoDispositivoId?: number; familiaCodigoInventarioId?: number; estado?: string; colaboradorId?: number; departamentoId?: number; localidad?: string; }
export interface IndicadorEconomico { cantidad:number;valor:number; }
export interface ResumenGerencial {inventario:IndicadorEconomico;disponibles:IndicadorEconomico;asignados:IndicadorEconomico;extraviados:IndicadorEconomico;bajas:IndicadorEconomico;}
export interface DispositivoInput { codigoInventario?: number; tipoDispositivoId: number; marca?: string | null; modelo?: string | null; numeroSerie?: string | null; imei?: string | null; valorComercial?: number; localidad?: string | null; ubicacionDetalle?: string | null; observaciones?: string | null; atributosEspecificos?: Record<string, string | number | null>; responsable?: string; }
export interface ResponsableInput { responsable: string; observaciones?: string | null; }
export interface AsignarDispositivoColaboradorInput extends ResponsableInput { colaboradorId: number; }
export interface AsignarDispositivoDepartamentoInput extends ResponsableInput { departamentoId: number; recibidoPorId: number; localidad?: string | null; ubicacionDetalle?: string | null; }
export interface CambiarEstadoInput extends ResponsableInput { estadoId: number; }
export interface DevolverDispositivoInput extends ResponsableInput { condicion?: string | null; resultado?: 'DEVUELTO'|'DANADO'; }
export type ResultadoOffboarding='DEVUELTO'|'PENDIENTE'|'NO_ENTREGADO'|'EXTRAVIADO'|'ROBADO_HURTADO'|'DANADO';
export interface ResultadoOffboardingInput extends ResponsableInput { resultado:ResultadoOffboarding; condicion?:string|null; }
export type MotivoBaja='IRREPARABLE'|'REPARACION_NO_CONVENIENTE'|'MULTIPLES_REPARACIONES'|'OBSOLESCENCIA'|'DANO_FISICO'|'SIN_REPUESTOS'|'OTRO';
export interface DarBajaInput extends ResponsableInput { motivo:MotivoBaja; }

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

export interface InventarioDepartamento { departamento: Departamento; resumen: { custodiaDirecta: number; conColaboradores: number; totalRelacionado: number }; custodiaDirecta: Dispositivo[]; activosColaboradores: Dispositivo[]; }

export interface ActivoColaborador {id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null;numeroSerie:string|null;imei:string|null;valorComercial:number;estado:{codigo:string;nombre:string};}
export interface HistorialActivoColaborador extends ActivoColaborador {fechaAsignacion:string;fechaDevolucion:string|null;resultado:string;}
export interface InventarioColaborador {colaborador:Colaborador;valorTotalCustodia:number;equiposActuales:ActivoColaborador[];historialEquipos:HistorialActivoColaborador[];}
export interface PendienteOffboarding {colaborador:Colaborador;activosPendientes:number;valorPendiente:number;estado:'PENDIENTE';}

export type EstadoOrdenServicio='PENDIENTE_DIAGNOSTICO'|'COTIZACION_RECIBIDA'|'REPARACION_APROBADA'|'REPARACION_RECHAZADA'|'EN_REPARACION'|'REPARACION_TERMINADA'|'CERRADA'|'BAJA';
export interface OrdenServicio {id:string;dispositivo:{id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null;valorComercial:number};proveedor:string|null;fechaEnvio:string;fallaReportada:string;diagnostico:string|null;descripcionReparacion:string|null;montoCotizacion:number|null;decision:string|null;motivoDecision:string|null;observacionDecision:string|null;fechaDecision:string|null;responsableDecision:string|null;costoFinal:number|null;fechaRetorno:string|null;resultado:string|null;estado:EstadoOrdenServicio;responsableEnvio:string;reparacionesAnteriores:number;costoAcumulado:number;creadoEn:string;actualizadoEn:string;}
export interface CrearOrdenServicioInput {dispositivoCodigo:number;proveedor?:string|null;fallaReportada:string;responsable:string;}
export interface CotizacionOrdenInput {diagnostico:string;descripcionReparacion:string;montoCotizacion:number;proveedor?:string|null;responsable:string;}
export interface DecisionOrdenInput {decision:'APROBAR'|'RECHAZAR'|'DAR_BAJA';motivo?:string|null;observaciones?:string|null;responsable:string;}
export interface CerrarOrdenInput {costoFinal:number;fechaRetorno?:string|null;resultado:string;responsable:string;}

export interface ActaDispositivo {id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null;numeroSerie:string|null;imei:string|null;valorComercial:number;}
export interface ActaEntrega {id:string;numeroActa:string;colaborador:ColaboradorResumen|null;departamento:DepartamentoResumen|null;recepcionante:ColaboradorResumen|null;localidad:string|null;fecha:string;estado:string;responsableTi:string;observaciones:string|null;declaracion:string|null;valorTotal:number;dispositivos:ActaDispositivo[];creadoEn:string;actualizadoEn:string;}
export interface CrearActaInput {colaboradorId?:number|null;departamentoId?:number|null;recepcionanteId?:number|null;localidad?:string|null;responsableTi:string;observaciones?:string|null;declaracion?:string|null;dispositivosCodigos:number[];}
