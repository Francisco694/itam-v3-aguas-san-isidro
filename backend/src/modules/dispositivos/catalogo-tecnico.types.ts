export type CatalogoTecnicoMime = "application/pdf";

export interface CatalogoTecnicoAlmacenado {
  nombreOriginal: string;
  nombreAlmacenado: string;
  mimeType: CatalogoTecnicoMime;
  tamanoBytes: number;
  ruta: string;
}

export interface CatalogoTecnicoRow {
  id: string | number;
  dispositivo_id: string | number;
  nombre_original: string;
  nombre_almacenado: string;
  mime_type: CatalogoTecnicoMime;
  tamano_bytes: string | number;
  ruta: string;
  subido_por: string;
  creado_en: Date | string;
}

export interface CatalogoTecnico {
  id: string;
  dispositivoId: string;
  nombreOriginal: string;
  mimeType: CatalogoTecnicoMime;
  tamanoBytes: number;
  subidoPor: string;
  creadoEn: string;
}
