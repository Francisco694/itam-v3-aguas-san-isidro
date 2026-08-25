import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  output,
  signal
} from '@angular/core';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { LucideCamera, LucideRefreshCw, LucideX } from '@lucide/angular';

export const parseItamQrValue = (rawValue: string): number | null => {
  const value = rawValue.trim();
  if (!value) return null;
  let path = value;
  if (!value.startsWith('/')) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
        return null;
      }
      path = url.pathname;
    } catch {
      return null;
    }
  }
  const match = /^\/dispositivos\/([1-9]\d*)\/?$/.exec(path);
  if (!match) return null;
  const code = Number(match[1]);
  return Number.isSafeInteger(code) ? code : null;
};

@Component({
  selector: 'app-qr-scanner',
  imports: [LucideCamera, LucideRefreshCw, LucideX],
  template: `
    <div class="overlay" (click)="cancelScan()">
      <section
        class="scanner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        (click)="$event.stopPropagation()"
      >
        <header>
          <div>
            <h2 id="qr-title">Escanear QR del activo</h2>
            <p>Centre la etiqueta ITAM dentro del recuadro.</p>
          </div>
          <button type="button" aria-label="Cerrar lector QR" (click)="cancelScan()">
            <svg lucideX></svg>
          </button>
        </header>

        @if (!secureContext) {
          <div class="scanner-message">
            <svg lucideCamera></svg>
            <strong>Camara no disponible en esta conexion</strong>
            <p>
              El acceso a la camara requiere una conexion segura HTTPS.
              Puede continuar utilizando la busqueda manual.
            </p>
          </div>
        } @else if (error()) {
          <div class="scanner-message scanner-message--error">
            <svg lucideCamera></svg>
            <strong>No fue posible leer el QR</strong>
            <p>{{ error() }}</p>
          </div>
        } @else {
          <div class="video-frame">
            <video #video muted playsinline></video>
            <span aria-hidden="true"></span>
          </div>
          <p class="privacy">
            La camara solo se usa para leer el codigo. ITAM no guarda imagenes ni video.
          </p>
        }

        <footer>
          @if (secureContext && error()) {
            <button class="btn btn--secondary" type="button" (click)="retry()">
              <svg lucideRefreshCw></svg> Intentar nuevamente
            </button>
          }
          <button class="btn btn--ghost" type="button" (click)="cancelScan()">
            Cancelar
          </button>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    .overlay{align-items:center;background:rgba(15,23,42,.72);display:flex;inset:0;justify-content:center;padding:1rem;position:fixed;z-index:1200}.scanner{background:#fff;border-radius:1.25rem;box-shadow:0 24px 70px rgba(15,23,42,.4);max-width:38rem;overflow:hidden;width:100%}.scanner header{align-items:flex-start;background:var(--navy);color:#fff;display:flex;gap:1rem;justify-content:space-between;padding:1.25rem}.scanner h2{font-size:1.15rem;margin:0}.scanner header p{color:#bae6fd;font-size:.82rem;margin:.3rem 0 0}.scanner header button{align-items:center;background:rgba(255,255,255,.12);border:0;border-radius:.6rem;color:#fff;cursor:pointer;display:flex;height:2.25rem;justify-content:center;width:2.25rem}.scanner header svg{height:1.1rem;width:1.1rem}.video-frame{aspect-ratio:4/3;background:#020617;overflow:hidden;position:relative}.video-frame video{height:100%;object-fit:cover;width:100%}.video-frame span{border:3px solid var(--cyan);border-radius:1rem;box-shadow:0 0 0 999px rgba(2,6,23,.3);inset:18%;position:absolute}.privacy{color:var(--slate-500);font-size:.76rem;margin:.8rem 1.25rem}.scanner-message{align-items:center;display:flex;flex-direction:column;padding:2.5rem 1.5rem;text-align:center}.scanner-message svg{color:var(--corporate-blue);height:2.5rem;width:2.5rem}.scanner-message strong{margin-top:.8rem}.scanner-message p{color:var(--slate-500);line-height:1.5;max-width:28rem}.scanner-message--error svg{color:#b91c1c}.scanner footer{border-top:1px solid var(--gray-200);display:flex;gap:.6rem;justify-content:flex-end;padding:1rem 1.25rem}.scanner footer svg{height:1rem;width:1rem}@media(max-width:560px){.overlay{align-items:flex-end;padding:0}.scanner{border-radius:1.25rem 1.25rem 0 0}.scanner footer{flex-direction:column}.scanner footer .btn{justify-content:center;width:100%}}
  `]
})
export class QrScanner implements AfterViewInit, OnDestroy {
  @ViewChild('video') private video?: ElementRef<HTMLVideoElement>;
  readonly scanned = output<number>();
  readonly cancelled = output<void>();
  protected readonly error = signal('');
  protected readonly secureContext = window.isSecureContext;
  private readonly reader = new BrowserQRCodeReader(undefined, {
    delayBetweenScanAttempts: 250,
    delayBetweenScanSuccess: 800
  });
  private controls?: IScannerControls;

  ngAfterViewInit(): void {
    if (this.secureContext) void this.start();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  @HostListener('document:keydown.escape')
  protected cancelScan(): void {
    this.stop();
    this.cancelled.emit();
  }

  protected retry(): void {
    this.error.set('');
    void this.start();
  }

  private async start(): Promise<void> {
    this.stop();
    const video = this.video?.nativeElement;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      this.error.set(
        'Este navegador no ofrece acceso compatible a la camara. Puede buscar el activo manualmente.'
      );
      return;
    }
    try {
      this.controls = await this.reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        video,
        (result, _decodeError, controls) => {
          if (!result) return;
          const code = parseItamQrValue(result.getText());
          controls.stop();
          this.controls = undefined;
          if (code === null) {
            this.error.set(
              'El codigo QR leido no corresponde a un activo ITAM valido.'
            );
            return;
          }
          this.scanned.emit(code);
        }
      );
    } catch (accessError) {
      const denied =
        accessError instanceof DOMException &&
        ['NotAllowedError', 'SecurityError'].includes(accessError.name);
      this.error.set(
        denied
          ? 'No fue posible acceder a la camara. Puede habilitar el permiso del navegador o buscar el activo manualmente.'
          : 'No fue posible iniciar la camara. Puede buscar el activo manualmente.'
      );
    }
  }

  private stop(): void {
    this.controls?.stop();
    this.controls = undefined;
  }
}
