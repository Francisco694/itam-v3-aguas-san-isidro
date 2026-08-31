import { Component, inject } from '@angular/core';
import {
  LucideClock3,
  LucideLogOut,
  LucideShieldAlert
} from '@lucide/angular';
import { SessionIdleService } from '../../../core/services/session-idle.service';

@Component({
  selector: 'app-session-idle-dialog',
  imports: [LucideClock3, LucideLogOut, LucideShieldAlert],
  template: `
    @if (session.warningOpen()) {
      <div class="session-backdrop">
        <section
          class="session-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="session-warning-title"
          aria-describedby="session-warning-description"
        >
          <span class="session-dialog__icon" aria-hidden="true">
            <svg lucideShieldAlert></svg>
          </span>
          <p class="session-dialog__eyebrow">Seguridad de la sesión</p>
          <h2 id="session-warning-title">
            Tu sesión está por expirar por inactividad.
          </h2>
          <p id="session-warning-description">
            Tu sesión se cerrará en {{ session.warningMinutes() }} minutos si no
            registras actividad.
          </p>
          <div class="session-countdown" aria-live="polite">
            <svg lucideClock3></svg>
            <span>Tiempo restante</span>
            <strong>{{ session.countdown() }}</strong>
          </div>
          <footer>
            <button
              class="btn btn--secondary"
              type="button"
              [disabled]="session.continuing()"
              (click)="session.closeSession()"
            >
              <svg lucideLogOut></svg>
              Cerrar sesión
            </button>
            <button
              class="btn btn--primary"
              type="button"
              [disabled]="session.continuing()"
              (click)="session.continueSession()"
            >
              {{ session.continuing() ? 'Renovando…' : 'Continuar sesión' }}
            </button>
          </footer>
        </section>
      </div>
    }
  `,
  styles: [`
    .session-backdrop{align-items:center;background:rgba(3,4,94,.6);display:flex;inset:0;justify-content:center;padding:1rem;position:fixed;z-index:1400}
    .session-dialog{animation:slide-up .25s ease;background:#fff;border-radius:1.15rem;box-shadow:0 24px 70px rgba(2,6,23,.32);max-height:calc(100dvh - 2rem);max-width:30rem;overflow:auto;padding:1.6rem;text-align:center;width:100%}
    .session-dialog__icon{align-items:center;background:#fff7ed;border-radius:50%;color:var(--warning);display:flex;height:3.5rem;justify-content:center;margin:0 auto 1rem;width:3.5rem}
    .session-dialog__icon svg{height:1.6rem;width:1.6rem}
    .session-dialog__eyebrow{color:var(--warning);font-size:.65rem;font-weight:850;letter-spacing:.1em;margin:0 0 .4rem;text-transform:uppercase}
    h2{color:var(--navy);font-size:1.25rem;line-height:1.25;margin:0}
    #session-warning-description{color:var(--slate-500);line-height:1.5;margin:.65rem 0 1.1rem}
    .session-countdown{align-items:center;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:.8rem;display:grid;gap:.2rem;grid-template-columns:auto 1fr auto;padding:.8rem;text-align:left}
    .session-countdown svg{color:var(--blue);height:1.1rem;width:1.1rem}
    .session-countdown span{color:var(--slate-500);font-size:.75rem}
    .session-countdown strong{color:var(--navy);font-family:var(--font-mono,"SFMono-Regular",Consolas,monospace);font-size:1.1rem}
    footer{display:grid;gap:.65rem;grid-template-columns:1fr 1fr;margin-top:1.2rem}
    @media(max-width:480px){.session-backdrop{align-items:flex-end;padding:.75rem}.session-dialog{border-radius:1rem;padding:1.25rem;width:calc(100vw - 1.5rem)}footer{grid-template-columns:1fr}.btn{width:100%}}
  `]
})
export class SessionIdleDialog {
  protected readonly session = inject(SessionIdleService);
}
