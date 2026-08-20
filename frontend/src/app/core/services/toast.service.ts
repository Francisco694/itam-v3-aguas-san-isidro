import { Injectable, signal } from '@angular/core';
export type ToastTone = 'success' | 'error' | 'warning' | 'info';
export interface Toast { id: number; tone: ToastTone; title: string; message?: string; }
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]); private nextId = 1;
  show(tone: ToastTone, title: string, message?: string): void { const id = this.nextId++; this.toasts.update((items) => [...items, { id, tone, title, message }]); window.setTimeout(() => this.dismiss(id), 4500); }
  success(title: string, message?: string) { this.show('success', title, message); }
  error(title: string, message?: string) { this.show('error', title, message); }
  warning(title: string, message?: string) { this.show('warning', title, message); }
  dismiss(id: number) { this.toasts.update((items) => items.filter((item) => item.id !== id)); }
}
