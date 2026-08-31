import { computed, effect, Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, filter, of, Subscription } from 'rxjs';
import {
  SessionEndReason,
  SessionPolicy
} from '../models/auth.models';
import { AuthService } from './auth.service';

interface SessionSyncMessage {
  type: 'ACTIVITY' | 'SESSION_END';
  timestamp: number;
  reason?: SessionEndReason;
}

@Injectable({ providedIn: 'root' })
export class SessionIdleService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly channel =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel('itam-session');
  private readonly activityEvents = ['click', 'keydown', 'submit'] as const;

  readonly warningOpen = signal(false);
  readonly warningMinutes = signal(0);
  readonly remainingSeconds = signal(0);
  readonly continuing = signal(false);
  readonly countdown = computed(() => {
    const total = Math.max(0, this.remainingSeconds());
    const minutes = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const seconds = Math.floor(total % 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${seconds}`;
  });

  private policy: SessionPolicy | null = null;
  private lastActivityAt = 0;
  private lastBackendRefreshAt = 0;
  private lastBroadcastAt = 0;
  private timerId: number | null = null;
  private routerSubscription: Subscription | null = null;
  private sessionSubscription: Subscription;
  private tracking = false;
  private requestInFlight = false;
  private ending = false;
  private receivingMessage = false;

  private readonly activityListener = (): void => this.recordActivity();
  private readonly visibilityListener = (): void => {
    if (!document.hidden) this.checkTimeout();
  };
  private readonly unauthorizedListener = (event: Event): void => {
    if (this.ending || !this.auth.user()) return;
    const code = (event as CustomEvent<{ code?: string }>).detail?.code;
    this.completeSessionEnd(
      code === 'SESSION_EXPIRED_IDLE' ? 'idle' : 'invalid'
    );
  };
  private readonly channelListener = (
    event: MessageEvent<SessionSyncMessage>
  ): void => {
    const message = event.data;
    if (message.type === 'ACTIVITY' && this.tracking) {
      this.lastActivityAt = Math.max(this.lastActivityAt, message.timestamp);
      this.warningOpen.set(false);
      this.checkTimeout();
      return;
    }
    if (message.type === 'SESSION_END' && this.auth.user()) {
      this.receivingMessage = true;
      this.auth.clearLocalSession(message.reason ?? 'invalid');
      this.receivingMessage = false;
      void this.navigateToLogin(message.reason ?? 'invalid');
    }
  };

  constructor() {
    this.channel?.addEventListener('message', this.channelListener);
    window.addEventListener(
      'itam:session-unauthorized',
      this.unauthorizedListener as EventListener
    );
    this.sessionSubscription = this.auth.sessionEnded.subscribe((reason) => {
      this.stopTracking();
      if (!this.receivingMessage) {
        this.channel?.postMessage({
          type: 'SESSION_END',
          reason,
          timestamp: Date.now()
        } satisfies SessionSyncMessage);
      }
    });

    effect(() => {
      const user = this.auth.user();
      queueMicrotask(() => {
        if (user) this.startTracking();
        else this.stopTracking();
      });
    });
  }

  continueSession(): void {
    if (this.continuing() || this.ending) return;
    this.continuing.set(true);
    this.requestInFlight = true;
    this.auth.refreshSession().subscribe({
      next: (policy) => {
        const now = Date.now();
        this.policy = policy;
        this.warningMinutes.set(policy.idleWarningMinutes);
        this.lastActivityAt = now;
        this.lastBackendRefreshAt = now;
        this.warningOpen.set(false);
        this.continuing.set(false);
        this.requestInFlight = false;
        this.broadcastActivity(now, true);
        this.checkTimeout();
      },
      error: () => {
        this.continuing.set(false);
        this.requestInFlight = false;
        if (this.auth.user()) this.warningOpen.set(true);
      }
    });
  }

  closeSession(): void {
    this.endSession('logout');
  }

  private startTracking(): void {
    if (this.tracking) return;
    this.tracking = true;
    this.ending = false;
    this.policy = null;
    this.lastActivityAt = Date.now();
    this.lastBackendRefreshAt = 0;
    this.lastBroadcastAt = 0;
    this.warningMinutes.set(0);
    this.warningOpen.set(false);
    this.activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, this.activityListener)
    );
    document.addEventListener('visibilitychange', this.visibilityListener);
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.recordActivity());
    this.timerId = window.setInterval(() => this.checkTimeout(), 1000);
    this.refreshBackend(true);
  }

  private stopTracking(): void {
    if (!this.tracking) return;
    this.tracking = false;
    this.warningOpen.set(false);
    this.continuing.set(false);
    this.policy = null;
    this.activityEvents.forEach((eventName) =>
      window.removeEventListener(eventName, this.activityListener)
    );
    document.removeEventListener('visibilitychange', this.visibilityListener);
    this.routerSubscription?.unsubscribe();
    this.routerSubscription = null;
    if (this.timerId !== null) window.clearInterval(this.timerId);
    this.timerId = null;
  }

  private recordActivity(): void {
    if (!this.tracking || this.ending) return;
    const now = Date.now();
    this.lastActivityAt = now;
    this.warningOpen.set(false);
    this.broadcastActivity(now);
    this.refreshBackend(false);
  }

  private broadcastActivity(timestamp: number, force = false): void {
    if (!force && timestamp - this.lastBroadcastAt < 10_000) return;
    this.lastBroadcastAt = timestamp;
    this.channel?.postMessage({
      type: 'ACTIVITY',
      timestamp
    } satisfies SessionSyncMessage);
  }

  private refreshBackend(force: boolean): void {
    if (this.requestInFlight || !this.tracking) return;
    const now = Date.now();
    const refreshInterval = this.policy
      ? Math.max(60_000, this.policy.idleWarningMinutes * 60_000)
      : 0;
    if (
      !force &&
      (!this.policy || now - this.lastBackendRefreshAt < refreshInterval)
    ) {
      return;
    }
    this.requestInFlight = true;
    this.auth.refreshSession().subscribe({
      next: (policy) => {
        this.policy = policy;
        this.warningMinutes.set(policy.idleWarningMinutes);
        this.lastBackendRefreshAt = Date.now();
        this.requestInFlight = false;
        this.checkTimeout();
      },
      error: () => {
        this.requestInFlight = false;
      }
    });
  }

  private checkTimeout(): void {
    if (!this.tracking || !this.policy || this.ending) return;
    const elapsed = Date.now() - this.lastActivityAt;
    const timeout = this.policy.idleTimeoutMinutes * 60_000;
    const warningAt =
      timeout - this.policy.idleWarningMinutes * 60_000;
    const remaining = Math.max(0, Math.ceil((timeout - elapsed) / 1000));
    this.remainingSeconds.set(remaining);

    if (elapsed >= timeout) {
      this.endSession('idle');
      return;
    }
    this.warningOpen.set(elapsed >= warningAt);
  }

  private endSession(reason: 'idle' | 'logout'): void {
    if (this.ending) return;
    this.ending = true;
    this.warningOpen.set(false);
    this.auth
      .logout(reason)
      .pipe(
        catchError(() => {
          this.auth.clearLocalSession(reason);
          return of(undefined);
        })
      )
      .subscribe({
        complete: () => void this.navigateToLogin(reason)
      });
  }

  private completeSessionEnd(reason: SessionEndReason): void {
    if (this.ending) return;
    this.ending = true;
    this.auth.clearLocalSession(reason);
    void this.navigateToLogin(reason);
  }

  private navigateToLogin(reason: SessionEndReason): Promise<boolean> {
    return this.router.navigate(['/login'], {
      queryParams:
        reason === 'idle'
          ? { reason: 'idle' }
          : reason === 'invalid'
            ? { reason: 'session' }
            : undefined,
      replaceUrl: true
    });
  }
}
