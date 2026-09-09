export type ResultadoVerificacionFisica =
  | "PENDIENTE"
  | "VERIFICADO"
  | "REVISAR";

export interface RegistrarVerificacionFisicaInput {
  encontrado: boolean;
  identificadorComprobado?: string | null;
  observacion?: string | null;
  responsable: string;
}

export interface VerificacionFisica {
  id: string;
  dispositivoId: string;
  encontrado: boolean;
  identificadorComprobado: string | null;
  identificadorEsperado: string | null;
  resultado: ResultadoVerificacionFisica;
  observacion: string | null;
  usuario: { id: string; nombre: string; email: string } | null;
  fechaVerificacion: string;
}

export interface DispositivoVerificacionRow {
  id: string;
  estado_id: string;
  estado_codigo: string;
  tipo_nombre: string;
  numero_serie: string | null;
  imei: string | null;
  colaborador_id: string | null;
  departamento_id: string | null;
}

export interface VerificacionFisicaInsert {
  encontrado: boolean;
  identificadorComprobado: string | null;
  identificadorEsperado: string | null;
  resultado: ResultadoVerificacionFisica;
  observacion: string | null;
  responsable: string;
  motivo?: string | null;
}

export interface VerificacionFisicaRow {
  id: string;
  dispositivo_id: string;
  encontrado: boolean;
  identificador_comprobado: string | null;
  identificador_esperado: string | null;
  resultado: ResultadoVerificacionFisica;
  observacion: string | null;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  fecha_verificacion: Date | string;
}
