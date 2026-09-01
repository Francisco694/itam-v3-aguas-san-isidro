import { ApiError } from '../../core/models/api.models';
import { FormControl } from '@angular/forms';
import { isCollaboratorRutConflict, rutValidator } from './colaborador-form';

describe('P1-10 formulario de colaborador', () => {
  it('interpreta el 409 RUT_ALREADY_EXISTS como conflicto visible del RUT', () => {
    const error = new ApiError(
      'RUT_ALREADY_EXISTS',
      'Ya existe un colaborador registrado con este RUT.',
      409
    );
    expect(isCollaboratorRutConflict(error)).toBe(true);
  });

  it('no confunde otros errores API con un RUT duplicado', () => {
    expect(isCollaboratorRutConflict(
      new ApiError('VALIDATION_ERROR','RUT invalido.',400)
    )).toBe(false);
  });

  it('valida el dígito verificador del RUT', () => {
    expect(rutValidator(new FormControl('11.184.473-9'))).toBeNull();
    expect(rutValidator(new FormControl('11.184.473-8'))).toEqual({ rutInvalid: true });
  });
});
