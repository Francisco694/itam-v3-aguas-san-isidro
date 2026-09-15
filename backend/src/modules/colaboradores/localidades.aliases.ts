const LOCALIDADES_ALIASES: Readonly<Record<string, string>> = {
  "LABRA-OF-CENTRAL": "Labranza Casa Central",
  "LABRA-RE-PTAS": "Labranza PTAS",
  "RE-LABRA-104": "Labranza Recinto 104",
  "RE-PH-1": "Padre Hurtado 1",
  "RE-PH-2": "Padre Hurtado 2",
  "PICHI-OSMO": "Pichidangui Osmosis",
  "MOLLES-OSMO": "Los Molles Osmosis",
  "R-OF-PICHI": "Pichidangui Oficina",
  "PILLAN-RE-PTAS": "Pillanlelbún PTAS",
  "SAN RAMON": "San Ramón",
  "TODAS": "Todas las localidades",
  "LABRANZA": "Labranza",
  "OFFICINA CENTRAL": "Oficina Central"
};

const normalizarClaveLocalidad = (localidad: string): string =>
  localidad
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const resolverNombreLocalidad = (
  localidadCodigo: string | null
): string | null => {
  if (localidadCodigo === null) {
    return null;
  }

  return LOCALIDADES_ALIASES[normalizarClaveLocalidad(localidadCodigo)]
    ?? localidadCodigo;
};
