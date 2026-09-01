import { formatRut, formattedRutCaret, isValidRut, normalizeRut } from './rut';

describe('utilidades RUT', () => {
  it('normaliza el almacenamiento y conserva K mayúscula', () => {
    expect(normalizeRut(' 12.345.678-k ')).toBe('12345678K');
  });

  it('formatea el RUT canónico para presentación', () => {
    expect(formatRut('111844739')).toBe('11.184.473-9');
  });

  it('valida el dígito verificador y calcula una posición de cursor estable', () => {
    expect(isValidRut('11.184.473-9')).toBe(true);
    expect(isValidRut('11.184.473-8')).toBe(false);
    expect(formattedRutCaret('11.184.473-9', 5)).toBe(6);
  });
});
