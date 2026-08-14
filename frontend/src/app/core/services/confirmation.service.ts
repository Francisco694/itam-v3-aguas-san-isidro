import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  confirm(message: string): boolean {
    return window.confirm(message);
  }
}
