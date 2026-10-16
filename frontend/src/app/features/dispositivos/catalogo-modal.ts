import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  afterNextRender,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';

import { UserRole } from '../../core/models/auth.models';
import { CatalogoTecnico } from '../../core/models/itam.models';

@Component({
  selector: 'app-catalogo-modal',
  templateUrl: './catalogo-modal.html',
  styleUrl: './catalogo-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoModal {
  readonly modeloNombre = input.required<string>();
  readonly codigoActivo = input.required<string>();
  readonly rolUsuario = input<UserRole>('SOLO_LECTURA');
  readonly archivos = input<readonly CatalogoTecnico[]>([]);
  readonly cargando = input(false);
  readonly error = input<string | null>('');

  readonly cerrar = output<void>();
  readonly descargar = output<CatalogoTecnico>();
  readonly subirArchivo = output<File>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly esEditable = computed(() => this.rolUsuario() !== 'SOLO_LECTURA');

  constructor() {
    afterNextRender(() => this.panel().nativeElement.focus());
  }

  protected formatoTamano(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected formatoFecha(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-CL');
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.subirArchivo.emit(file);
    input.value = '';
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cerrar.emit();
  }
}
