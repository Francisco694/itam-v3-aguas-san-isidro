import { Pipe, PipeTransform } from '@angular/core';
import { formatRut } from '../utils/rut';

@Pipe({
  name: 'rut',
  standalone: true,
})
export class RutPipe implements PipeTransform {
  transform(value: unknown): string {
    return formatRut(value);
  }
}
