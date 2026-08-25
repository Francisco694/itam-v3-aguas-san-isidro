export interface FacturaAdquisicionInput {
  numeroFactura: string;
  fechaFactura?: string | null;
  proveedor?: string | null;
  montoTotal?: number | null;
  observaciones?: string | null;
  referenciaDocumental?: string | null;
  dispositivosCodigos: number[];
}

export interface FacturaDocumento {
  nombreOriginal: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png";
  tamanoBytes: number;
}

export interface FacturaDocumentoAlmacenado extends FacturaDocumento {
  nombreAlmacenado: string;
  ruta: string;
}

export interface FacturaAdquisicion {
  id: string;
  numeroFactura: string;
  fechaFactura: string | null;
  proveedor: string | null;
  montoTotal: number | null;
  observaciones: string | null;
  referenciaDocumental: string | null;
  documento: FacturaDocumento | null;
  dispositivos: Array<{
    id: string;
    codigoInventario: number;
    tipo: string;
    marca: string | null;
    modelo: string | null;
  }>;
  creadoEn: string;
  actualizadoEn: string;
}
