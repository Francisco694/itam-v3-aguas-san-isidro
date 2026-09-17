/**
 * Clasificación de verificación basada únicamente en evidencia estructurada.
 *
 * Esta función no modifica datos: recibe el dispositivo, sus eventos y las
 * verificaciones existentes y devuelve la decisión que puede aplicar el
 * proceso de backfill.
 */

export type VerificationResult = "PENDIENTE" | "VERIFICADO" | "REVISAR";

const manualRegistrationEventTypes = new Set([
  "ALTA_DISPOSITIVO",
  "EQUIPO_CREADO",
  "DISPOSITIVO_CREADO",
  "EQUIPO_INCORPORADO_AL_INVENTARIO"
]);

export interface VerificationEventEvidence {
  id: string;
  tipoEvento: string;
  fechaEvento: Date | string;
  usuarioEjecutorId: string | null;
  responsable: string;
  detalle: Record<string, unknown>;
}

export interface ExistingVerificationEvidence {
  id: string;
  resultado: VerificationResult;
}

export interface VerificationDeviceEvidence {
  id: string;
  codigoInventario: number;
  imei: string | null;
  numeroSerie: string | null;
  eventos: VerificationEventEvidence[];
  verificaciones: ExistingVerificationEvidence[];
}

export interface VerificationDecision {
  resultado: VerificationResult;
  motivo: string;
  categoria: "MANUAL" | "IMPORTADO_PENDIENTE" | "REVISAR_EXISTENTE" | "SIN_EVIDENCIA";
  eventoEvidencia: VerificationEventEvidence | null;
  verificacionExistenteId: string | null;
}

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();

const eventDate = (event: VerificationEventEvidence): number => {
  const timestamp = new Date(event.fechaEvento).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
/**
 * Los importadores escriben un origen estructurado en detalle.source/importKey
 * y dejan usuario_ejecutor_id en NULL. También se conserva el tipo de evento
 * IMPORTAR_DISPOSITIVO para las cargas históricas anteriores.
 */
export const esEventoImportado = (event: VerificationEventEvidence): boolean => {
  const source = text(event.detalle.source).toUpperCase();
  const importKey = text(event.detalle.importKey);
  const historicalCode = text(event.detalle.historicalCode);
  const responsible = text(event.responsable).toUpperCase();
  return event.tipoEvento === "IMPORTAR_DISPOSITIVO"
    || importKey.length > 0
    || source.length > 0
    || historicalCode.length > 0
    || responsible.startsWith("IMPORTADOR ");
};

const firstEvent = (events: VerificationEventEvidence[]): VerificationEventEvidence | null =>
  [...events].sort((left, right) => eventDate(left) - eventDate(right) || Number(left.id) - Number(right.id))[0] ?? null;

const latestEvent = (events: VerificationEventEvidence[]): VerificationEventEvidence | null =>
  [...events].sort((left, right) => eventDate(right) - eventDate(left) || Number(right.id) - Number(left.id))[0] ?? null;

/**
 * Determina el estado conservando la regla de negocio: el alta manual es una
 * verificación válida. Las operaciones posteriores a una importación no la
 * sustituyen; los resultados explícitos REVISAR/VERIFICADO se conservan.
 */
export const calcularEstadoVerificacion = (
  dispositivo: VerificationDeviceEvidence
): VerificationDecision => {
  const eventos = [...dispositivo.eventos].sort(
    (left, right) => eventDate(left) - eventDate(right) || Number(left.id) - Number(right.id)
  );
  const altaManualEvidence = eventos.find((event) =>
    manualRegistrationEventTypes.has(event.tipoEvento)
    && event.usuarioEjecutorId !== null
    && !esEventoImportado(event)
  );
  const revisar = dispositivo.verificaciones.find((item) => item.resultado === "REVISAR");
  if (revisar && !altaManualEvidence) {
    return {
      resultado: "REVISAR",
      motivo: "Se conserva una revisión física existente.",
      categoria: "REVISAR_EXISTENTE",
      eventoEvidencia: null,
      verificacionExistenteId: revisar.id
    };
  }

  const verificado = dispositivo.verificaciones.find((item) => item.resultado === "VERIFICADO");
  if (verificado) {
    return {
      resultado: "VERIFICADO",
      motivo: "Se conserva una verificación física existente.",
      categoria: "MANUAL",
      eventoEvidencia: null,
      verificacionExistenteId: verificado.id
    };
  }

  const altaManual = eventos.find((event) =>
    event.tipoEvento === "ALTA_DISPOSITIVO"
    && event.usuarioEjecutorId !== null
    && !esEventoImportado(event)
  );
  if (altaManual) {
    return {
      resultado: "VERIFICADO",
      motivo: "Equipo creado manualmente; el registro de alta acredita la verificación.",
      categoria: "MANUAL",
      eventoEvidencia: altaManual,
      verificacionExistenteId: dispositivo.verificaciones.find((item) => item.resultado === "PENDIENTE")?.id ?? null
    };
  }

  const importados = eventos.filter(esEventoImportado);
  const ultimaImportacion = importados.reduce<VerificationEventEvidence | null>(
    (latest, event) => !latest || eventDate(event) > eventDate(latest) ? event : latest,
    null
  );
  const fechaLimite = ultimaImportacion ? eventDate(ultimaImportacion) : -Infinity;
  const operacionPosterior = eventos
    .filter((event) => eventDate(event) > fechaLimite && event.usuarioEjecutorId !== null && !esEventoImportado(event))
    .sort((left, right) => eventDate(right) - eventDate(left) || Number(right.id) - Number(left.id))[0] ?? null;

  if (operacionPosterior) {
    return {
      resultado: "PENDIENTE",
      motivo: "Equipo importado con actividad posterior; esa actividad no sustituye la verificación física explícita.",
      categoria: "IMPORTADO_PENDIENTE",
      eventoEvidencia: operacionPosterior,
      verificacionExistenteId: dispositivo.verificaciones.find((item) => item.resultado === "PENDIENTE")?.id ?? null
    };
  }

  if (importados.length > 0) {
    return {
      resultado: "PENDIENTE",
      motivo: "Equipo importado sin verificación física explícita.",
      categoria: "IMPORTADO_PENDIENTE",
      eventoEvidencia: latestEvent(importados),
      verificacionExistenteId: dispositivo.verificaciones.find((item) => item.resultado === "PENDIENTE")?.id ?? null
    };
  }

  return {
    resultado: "PENDIENTE",
    motivo: "No existe evidencia estructurada suficiente para verificar el equipo.",
    categoria: "SIN_EVIDENCIA",
    eventoEvidencia: firstEvent(eventos),
    verificacionExistenteId: dispositivo.verificaciones.find((item) => item.resultado === "PENDIENTE")?.id ?? null
  };
};
