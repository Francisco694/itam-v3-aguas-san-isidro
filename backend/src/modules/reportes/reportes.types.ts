export interface RangoReporte { desde:string; hasta:string; }
export interface IndicadorReporte { cantidad:number; valor:number; }
export interface ReporteInventario {
  periodo:RangoReporte;
  generadoEn:string;
  resumen:{
    total:IndicadorReporte; disponibles:IndicadorReporte; asignados:IndicadorReporte;
    asignadosColaboradores:IndicadorReporte; asignadosDepartamentos:IndicadorReporte;
    servicioTecnico:IndicadorReporte; extraviados:IndicadorReporte; bajas:IndicadorReporte;
  };
  movimientos:{
    registrados:number; asignaciones:number; devoluciones:number;
    enviosServicioTecnico:number; retornosServicioTecnico:number; bajas:number;
  };
  organizacion:Array<{departamentoId:string;departamento:string;dependencia:string|null;cantidad:number;valor:number}>;
}
