export interface StockAlertRow {
  tipo_dispositivo_id: string;
  tipo_dispositivo_nombre: string;
  disponibles: string | number;
  minimo_disponible: number;
  alerta_activa: boolean;
  creado_por_usuario_id: string | null;
  creado_por_usuario_nombre: string | null;
  actualizado_por_usuario_id: string | null;
  actualizado_por_usuario_nombre: string | null;
  creado_en: Date | string | null;
  actualizado_en: Date | string | null;
}

export interface StockAlertConfiguration {
  tipoDispositivo: { id: string; nombre: string };
  disponibles: number;
  minimoDisponible: number;
  alertaActiva: boolean;
  enAlerta: boolean;
  mensaje: string | null;
  creadoPor: { id: string; nombre: string } | null;
  actualizadoPor: { id: string; nombre: string } | null;
  creadoEn: string | null;
  actualizadoEn: string | null;
}

export interface UpdateStockAlertInput {
  minimoDisponible: number;
  alertaActiva: boolean;
  usuarioId: number;
}
