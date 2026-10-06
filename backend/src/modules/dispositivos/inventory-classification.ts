export type InventoryClassification = "INVENTARIO" | "HISTORICO";

export const classifyInventoryRecord = (
  origen: string | null | undefined,
  verificacion: string | null | undefined
): InventoryClassification | null => {
  if (origen === "MANUAL") return "INVENTARIO";
  if (origen === "IMPORTADO" && verificacion === "VERIFICADO") return "INVENTARIO";
  if (origen === "IMPORTADO") return "HISTORICO";
  return null;
};

export const isInventoryClassification = (
  origen: string | null | undefined,
  verificacion: string | null | undefined
): boolean => classifyInventoryRecord(origen, verificacion) === "INVENTARIO";

export const isHistoricalClassification = (
  origen: string | null | undefined,
  verificacion: string | null | undefined
): boolean => classifyInventoryRecord(origen, verificacion) === "HISTORICO";

/**
 * Derives the permanent provenance from the first structured inventory event.
 * The event history remains the source of truth; this helper only centralizes
 * the SQL expression used by the read paths.
 */
export const buildOrigenRegistroSql = (
  ingresoAlias = "ingreso_inventario"
): string => `CASE
  WHEN ${ingresoAlias}.tipo_evento IN ('IMPORTAR_DISPOSITIVO','REGISTRO_IMPORTADO')
    OR ${ingresoAlias}.detalle ? 'source'
    OR ${ingresoAlias}.detalle ? 'importKey'
    OR ${ingresoAlias}.detalle ? 'historicalCode'
    OR COALESCE(${ingresoAlias}.responsable,'') ILIKE 'Importador%'
    OR COALESCE(${ingresoAlias}.observaciones,'') ILIKE 'Origen:%'
  THEN 'IMPORTADO'
  WHEN ${ingresoAlias}.tipo_evento IN ('ALTA_DISPOSITIVO','EQUIPO_CREADO','DISPOSITIVO_CREADO','EQUIPO_INCORPORADO_AL_INVENTARIO')
  THEN 'MANUAL'
  ELSE 'DESCONOCIDO'
END`;

export const buildInventoryClassificationSql = (
  origenExpression: string,
  verificacionExpression: string
): string => `(
  (${origenExpression}) = 'MANUAL'
  OR (
    (${origenExpression}) = 'IMPORTADO'
    AND ${verificacionExpression} = 'VERIFICADO'
  )
)`;

export const buildHistoricalClassificationSql = (
  origenExpression: string,
  verificacionExpression: string
): string => `(
  (${origenExpression}) = 'IMPORTADO'
  AND COALESCE(${verificacionExpression}, 'PENDIENTE') <> 'VERIFICADO'
)`;
