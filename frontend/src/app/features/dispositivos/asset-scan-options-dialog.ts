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

import { Dispositivo } from '../../core/models/itam.models';
import { formatRut } from '../../shared/utils/rut';

type Tono = 'verde' | 'azul' | 'naranja' | 'rojo' | 'gris' | 'violeta';

/** Mismos colores que los filtros del inventario. Clave = código de estado en BD. */
const TONOS: Record<string, Tono> = {
  DISPONIBLE: 'verde',
  ASIGNADO: 'azul',
  PRESTAMO_TEMPORAL: 'violeta',
  SERVICIO_TECNICO: 'naranja',
  RETENIDO_REVISION: 'violeta',
  EXTRAVIADO: 'rojo',
  DADO_BAJA: 'gris',
};

/**
 * Modal que se abre tras escanear el QR de un equipo.
 * Deja elegir entre la Ficha y Custodia o el Catálogo Técnico.
 * No navega ni hace llamadas HTTP: solo emite eventos para que el padre decida.
 */
@Component({
  selector: 'app-asset-scan-options-dialog',
  templateUrl: './asset-scan-options-dialog.html',
  styleUrl: './asset-scan-options-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetScanOptionsDialog {
  readonly dispositivo = input.required<Dispositivo>();

  readonly verFicha = output<number>();
  readonly verCatalogo = output<number>();
  readonly cerrar = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly tituloId = 'asset-scan-title';
  protected readonly preguntaId = 'asset-scan-question';

  protected readonly nombre = computed(() => {
    const d = this.dispositivo();
    return [d.marca, d.modelo].filter(Boolean).join(' ') || d.tipoDispositivo;
  });

  protected readonly codigo = computed(() => `ITAM-${this.dispositivo().codigoInventario}`);

  protected readonly estado = computed(() => {
    // Ajusta si EstadoResumen usa otros nombres de campo.
    const e = this.dispositivo().estado as { codigo?: string; nombre?: string } | null;
    const clave = (e?.codigo ?? '').toUpperCase();
    return { etiqueta: e?.nombre ?? clave, tono: TONOS[clave] ?? 'gris' };
  });

  protected readonly responsable = computed(() => {
    const d = this.dispositivo();
    if (d.colaborador) {
      return { nombre: d.colaborador.nombre, rut: formatRut(d.colaborador.rut) };
    }
    if (d.departamento) {
      return { nombre: `Departamento ${d.departamento.nombre}`, rut: null };
    }
    return null;
  });

  protected readonly ubicacion = computed(() => {
    const d = this.dispositivo();
    return [d.localidad, d.ubicacionDetalle].filter(Boolean).join(' – ') || null;
  });

  constructor() {
    afterNextRender(() => this.panel().nativeElement.focus());
  }

  protected onVerFicha(): void {
    this.verFicha.emit(this.dispositivo().codigoInventario);
  }

  protected onVerCatalogo(): void {
    this.verCatalogo.emit(this.dispositivo().codigoInventario);
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cerrar.emit();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.cerrar.emit();
  }
}
