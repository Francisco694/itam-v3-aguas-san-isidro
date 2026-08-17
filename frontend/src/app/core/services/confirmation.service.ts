import { Injectable, signal } from '@angular/core';

export interface ConfirmationRequest { title: string; message: string; confirmLabel: string; tone: 'default' | 'danger'; }

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  readonly request = signal<ConfirmationRequest | null>(null);
  private resolver: ((accepted: boolean) => void) | null = null;

  confirm(message: string, options: Partial<Omit<ConfirmationRequest, 'message'>> = {}): Promise<boolean> {
    this.resolver?.(false);
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.request.set({ title: options.title ?? 'Confirmar operación', message, confirmLabel: options.confirmLabel ?? 'Confirmar', tone: options.tone ?? 'default' });
    });
  }
  resolve(accepted: boolean): void { this.resolver?.(accepted); this.resolver = null; this.request.set(null); }
}
