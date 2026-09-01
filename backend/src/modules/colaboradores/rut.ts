const RUT_PATTERN = /^\d{7,8}[0-9K]$/;

export const normalizarRut = (value: string): string =>
  value.replace(/[.\-\s]/g, "").toUpperCase();

export const esRutValido = (value: string): boolean => {
  const rut = normalizarRut(value);
  if (!RUT_PATTERN.test(rut)) return false;

  const cuerpo = rut.slice(0, -1);
  const digitoIngresado = rut.slice(-1);
  let suma = 0;
  let multiplicador = 2;

  for (let indice = cuerpo.length - 1; indice >= 0; indice -= 1) {
    suma += Number(cuerpo[indice]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resultado = 11 - (suma % 11);
  const digitoEsperado = resultado === 11 ? "0" : resultado === 10 ? "K" : String(resultado);
  return digitoIngresado === digitoEsperado;
};

export const formatearRut = (value: string): string => {
  const rut = normalizarRut(value);
  if (rut.length < 2) return rut;
  const cuerpo = rut.slice(0, -1);
  const digito = rut.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoFormateado}-${digito}`;
};
