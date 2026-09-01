const RUT_PATTERN = /^\d{7,8}[0-9K]$/;

export const normalizeRut = (value: string): string =>
  value.replace(/[.\-\s]/g, '').toUpperCase();

export const formatRut = (value: string): string => {
  const rut = normalizeRut(value).replace(/[^0-9K]/g, '').slice(0, 9);
  if (rut.length < 2) return rut;
  const body = rut.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${rut.slice(-1)}`;
};

export const isValidRut = (value: string): boolean => {
  const rut = normalizeRut(value);
  if (!RUT_PATTERN.test(rut)) return false;
  const body = rut.slice(0, -1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  const expected = result === 11 ? '0' : result === 10 ? 'K' : String(result);
  return rut.slice(-1) === expected;
};
