export interface CrearActaInput {
  colaboradorId?:number|null; departamentoId?:number|null; recepcionanteId?:number|null;
  localidad?:string|null; responsableTi:string; observaciones?:string|null;
  declaracion?:string|null; dispositivosCodigos:number[];
}
export interface ActaRow {
  id:string;numero_acta:string;colaborador_id:string|null;colaborador_nombre:string|null;
  colaborador_rut:string|null;colaborador_cargo:string|null;departamento_id:string|null;
  departamento_nombre:string|null;recepcionante_id:string|null;recepcionante_nombre:string|null;
  recepcionante_rut:string|null;recepcionante_cargo:string|null;localidad:string|null;
  fecha:Date|string;estado:string;responsable_ti:string;observaciones:string|null;
  declaracion:string|null;creado_en:Date|string;actualizado_en:Date|string;
}
export interface ActaDetalleRow {
  id:string;dispositivo_id:string;codigo_inventario:number;tipo_dispositivo:string;
  marca:string|null;modelo:string|null;numero_serie:string|null;imei:string|null;
  valor_comercial:string|number;
}
