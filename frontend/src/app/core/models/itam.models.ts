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

export interface SimAsociadaResumen { id: string; codigoInventario: number; iccidCodigoFabrica: string | null; numeroAsociado: string | null; compania: string | null; estado: EstadoResumen | null; }
export interface Dispositivo {
  id: string; codigoInventario: number; tipoDispositivo: string; marca: string | null; modelo: string | null;
  tipo: TipoDispositivo;
  numeroSerie: string | null; imei: string | null; localidad: string | null; ubicacionDetalle: string | null;
  observaciones: string | null; fechaRegistro: string; creadoEn: string; actualizadoEn: string; estado: EstadoResumen;
  atributosEspecificos: Record<string, string | number | null>;
  valorComercial: number;
  facturaAdquisicion:{id:string;numeroFactura:string;fechaFactura:string|null;proveedor:string|null;montoTotal:number|null;observaciones:string|null;referenciaDocumental:string|null;documento:FacturaDocumento|null}|null;
  colaborador: ColaboradorResumen | null; departamento: DepartamentoResumen | null; recibidoPor: ColaboradorResumen | null; simAsociada: SimAsociadaResumen | null; tipoCustodia: 'NONE'|'COLABORADOR'|'DEPARTAMENTO';
  ultimoResponsableConocido?:{tipo:'COLABORADOR'|'DEPARTAMENTO';nombre:string;rut:string|null;fechaMovimiento:string}|null;
  ultimoResultadoOffboarding: ResultadoOffboarding | null;
}
export interface DispositivoFilters { q?: string; tipo?: string; tipoDispositivoId?: number; familiaCodigoInventarioId?: number; estado?: string; colaboradorId?: number; departamentoId?: number; localidad?: string; }
export interface IndicadorEconomico { cantidad:number;valor:number; }
export interface ResumenGerencial {inventarioOperacional:IndicadorEconomico;disponibles:IndicadorEconomico;asignados:IndicadorEconomico;servicioTecnico:IndicadorEconomico;extraviados:IndicadorEconomico;bajas:IndicadorEconomico;}
export interface ReporteInventario {
  periodo:{desde:string;hasta:string};generadoEn:string;
  resumen:{total:IndicadorEconomico;disponibles:IndicadorEconomico;asignados:IndicadorEconomico;asignadosColaboradores:IndicadorEconomico;asignadosDepartamentos:IndicadorEconomico;servicioTecnico:IndicadorEconomico;extraviados:IndicadorEconomico;bajas:IndicadorEconomico};
  movimientos:{registrados:number;asignaciones:number;devoluciones:number;enviosServicioTecnico:number;retornosServicioTecnico:number;bajas:number};
  organizacion:Array<{departamentoId:string;departamento:string;dependencia:string|null;cantidad:number;valor:number}>;
}
export interface DispositivoInput { codigoInventario?: number; tipoDispositivoId: number; marca?: string | null; modelo?: string | null; numeroSerie?: string | null; imei?: string | null; valorComercial?: number; localidad?: string | null; ubicacionDetalle?: string | null; observaciones?: string | null; atributosEspecificos?: Record<string, string | number | null>; responsable?: string; }
export interface ResponsableInput { responsable: string; observaciones?: string | null; }
export interface AsignarDispositivoColaboradorInput extends ResponsableInput { colaboradorId: number; }
export interface AsignarDispositivoDepartamentoInput extends ResponsableInput { departamentoId: number; recibidoPorId: number; localidad?: string | null; ubicacionDetalle?: string | null; }
export interface CambiarEstadoInput extends ResponsableInput { estadoId: number; }
export interface DevolverDispositivoInput extends ResponsableInput { condicion?: string | null; resultado?: 'DEVUELTO'|'DANADO'; }
export interface ComprobanteDevolucionResumen {id:string;numeroComprobante:string;fecha:string;resultado:'DEVUELTO'|'DANADO';}
export interface ResultadoDevolucion {dispositivo:Dispositivo;comprobante:ComprobanteDevolucionResumen;}
export type ResultadoOffboarding='DEVUELTO'|'PENDIENTE'|'NO_ENTREGADO'|'EXTRAVIADO'|'ROBADO_HURTADO'|'DANADO';
export interface ResultadoOffboardingInput extends ResponsableInput { resultado:ResultadoOffboarding; condicion?:string|null; }
export type MotivoBaja='IRREPARABLE'|'REPARACION_NO_CONVENIENTE'|'MULTIPLES_REPARACIONES'|'OBSOLESCENCIA'|'DANO_FISICO'|'SIN_REPUESTOS'|'OTRO';
export interface DarBajaInput extends ResponsableInput { motivo:MotivoBaja; }
export interface FacturaDocumento{nombreOriginal:string;mimeType:'application/pdf'|'image/jpeg'|'image/png';tamanoBytes:number}
export interface FacturaAdquisicionInput{numeroFactura:string;fechaFactura?:string|null;proveedor?:string|null;montoTotal?:number|null;observaciones?:string|null;referenciaDocumental?:string|null;dispositivosCodigos:number[]}
export interface FacturaAdquisicion{ id:string;numeroFactura:string;fechaFactura:string|null;proveedor:string|null;montoTotal:number|null;observaciones:string|null;referenciaDocumental:string|null;documento:FacturaDocumento|null;dispositivos:Array<{id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null}>;creadoEn:string;actualizadoEn:string}

export interface SimDispositivoResumen { id: string; codigoInventario: number; tipoDispositivo: string; marca: string | null; modelo: string | null; estado: EstadoResumen | null; }
export interface Sim {
  id: string; codigoInventario: number; iccidCodigoFabrica: string | null; numeroAsociado: string | null; compania: string | null;
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
  usuarioEjecutor?:{id:string;nombre:string;email:string}|null;
  colaboradorHistorico?:{id:string;nombre:string;rut:string}|null;
}

export type TipoResponsableTrazabilidad='COLABORADOR'|'DEPARTAMENTO';
export type OrigenResponsableTrazabilidad='HISTORIAL'|'BAJA'|'COMPROBANTE';
export interface ResponsableTrazabilidad {tipo:TipoResponsableTrazabilidad;id:string;nombre:string;rut:string|null;}
export interface UltimoResponsableTrazabilidad extends ResponsableTrazabilidad {fechaUltimoMovimiento:string;origenDato:OrigenResponsableTrazabilidad;}
export interface MovimientoResponsable extends UltimoResponsableTrazabilidad {tipoEvento:string;estadoResultante:Pick<EstadoResumen,'codigo'|'nombre'>|null;observacion:string|null;}
export interface TrazabilidadDispositivo {dispositivo:Dispositivo;responsableActual:ResponsableTrazabilidad|null;ultimoResponsableConocido:UltimoResponsableTrazabilidad|null;historialResponsables:MovimientoResponsable[];eventos:HistorialEvento[];alertas:string[];}

export interface InventarioDepartamento { departamento: Departamento; resumen: { custodiaDirecta: number; conColaboradores: number; totalRelacionado: number }; custodiaDirecta: Dispositivo[]; activosColaboradores: Dispositivo[]; }

export interface ActivoColaborador {id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null;numeroSerie:string|null;imei:string|null;valorComercial:number;estado:{codigo:string;nombre:string};}
export interface HistorialActivoColaborador extends ActivoColaborador {fechaAsignacion:string;fechaDevolucion:string|null;tipoCierre:string|null;resultado:string;}
export interface InventarioColaborador {colaborador:Colaborador;valorTotalCustodia:number;equiposActuales:ActivoColaborador[];historialEquipos:HistorialActivoColaborador[];}
export type ClasificacionConciliada =
  | 'ACTUAL_CONFIRMADO'
  | 'ACTUAL_PROBABLE'
  | 'HISTORICO_CONFIRMADO'
  | 'HISTORICO_PROBABLE'
  | 'PENDIENTE_VALIDACION'
  | 'CONFLICTO_DATOS';
export interface ActivoConciliado {
  dispositivoId:string;codigoItam:number;tipoDispositivo:string;marca:string|null;modelo:string|null;
  imei:string|null;numeroSerie:string|null;fechaAsignacion:string;fechaSalida:string|null;
  estadoOriginal:{codigo:string;nombre:string};clasificacionConciliada:ClasificacionConciliada;
  motivoConciliacion:string;requiereValidacionManual:boolean;valorComercial:number;
}
export interface InventarioConciliadoColaborador {
  colaborador:Colaborador;actuales:ActivoConciliado[];historicos:ActivoConciliado[];
  pendientes:ActivoConciliado[];valorTotalActual:number;
}
export interface PendienteOffboarding {colaborador:Colaborador;activosPendientes:number;valorPendiente:number;estado:'PENDIENTE';}

export type EstadoOrdenServicio='PENDIENTE_DIAGNOSTICO'|'COTIZACION_RECIBIDA'|'REPARACION_APROBADA'|'REPARACION_RECHAZADA'|'EN_REPARACION'|'REPARACION_TERMINADA'|'CERRADA'|'BAJA';
export interface EntregaTemporal {id:string;ordenServicioId:string;dispositivo:{id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null};colaborador:{id:string;nombre:string;rut:string};fechaEntrega:string;responsableEntrega:string;observacionesEntrega:string|null;fechaDevolucion:string|null;responsableDevolucion:string|null;observacionesDevolucion:string|null;estado:'ABIERTA'|'CERRADA'|'CANCELADA';}
export interface OrdenServicio {id:string;dispositivo:{id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null;valorComercial:number};proveedor:string|null;fechaEnvio:string;fallaReportada:string;observacionesEnvio:string|null;diagnostico:string|null;descripcionReparacion:string|null;montoCotizacion:number|null;decision:string|null;motivoDecision:string|null;observacionDecision:string|null;fechaDecision:string|null;responsableDecision:string|null;costoFinal:number|null;fechaRetorno:string|null;resultado:string|null;estado:EstadoOrdenServicio;responsableEnvio:string;reparacionesAnteriores:number;costoAcumulado:number;custodiaAlIngreso:{tipo:'COLABORADOR'|'DEPARTAMENTO';colaborador:{id:string;nombre:string;rut:string}|null;departamento:{id:string;nombre:string}|null;recibidoPor:{id:string;nombre:string}|null}|null;entregasTemporales:EntregaTemporal[];creadoEn:string;actualizadoEn:string;}
export interface CrearOrdenServicioInput {dispositivoCodigo:number;proveedor?:string|null;fechaEnvio?:string|null;fallaReportada:string;observaciones?:string|null;responsable:string;}
export interface CotizacionOrdenInput {diagnostico:string;descripcionReparacion:string;montoCotizacion:number;proveedor?:string|null;responsable:string;}
export interface DecisionOrdenInput {decision:'APROBAR'|'RECHAZAR'|'DAR_BAJA';motivo?:string|null;observaciones?:string|null;responsable:string;}
export interface CerrarOrdenInput {costoFinal:number;fechaRetorno?:string|null;resultado:string;responsable:string;}
export interface EntregarTemporalInput {dispositivoCodigo:number;responsable:string;observaciones?:string|null;}
export interface CerrarTemporalInput {responsable:string;observaciones?:string|null;}

export interface DevolucionActaDetalle {id:string;numeroComprobante:string;fecha:string;resultado:string;}
export interface ActaDispositivo {id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null;numeroSerie:string|null;imei:string|null;valorComercial:number;devuelto:boolean;devolucion:DevolucionActaDetalle|null;}
export interface ActaEntrega {id:string;numeroActa:string;colaborador:ColaboradorResumen|null;departamento:DepartamentoResumen|null;recepcionante:ColaboradorResumen|null;localidad:string|null;fecha:string;estado:string;estadoDocumental:'VIGENTE'|'DEVOLUCION_PARCIAL'|'CERRADA'|'ANULADA';responsableTi:string;observaciones:string|null;declaracion:string|null;valorTotal:number;dispositivos:ActaDispositivo[];creadoEn:string;actualizadoEn:string;}
export interface CrearActaInput {colaboradorId?:number|null;departamentoId?:number|null;recepcionanteId?:number|null;localidad?:string|null;responsableTi:string;observaciones?:string|null;declaracion?:string|null;dispositivosCodigos:number[];}

export interface ComprobanteDevolucion {id:string;numeroComprobante:string;fecha:string;resultado:'DEVUELTO'|'DANADO';condicion:string|null;observaciones:string|null;responsableTi:string;origen:'INVENTARIO'|'OFFBOARDING';actaEntrega:{id:string;numeroActa:string}|null;colaborador:{id:string;nombre:string;rut:string}|null;departamento:{id:string;nombre:string}|null;devueltoPor:{id:string;nombre:string;rut:string}|null;dispositivo:{id:string;codigoInventario:number;tipo:string;marca:string|null;modelo:string|null;numeroSerie:string|null;imei:string|null};creadoEn:string;}
