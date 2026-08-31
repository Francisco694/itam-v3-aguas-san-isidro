import { environment } from '../../../environments/environment';

export type ItamQrEntity = 'DISPOSITIVO' | 'SIM';

export interface ItamQrTarget {
  entity: ItamQrEntity | null;
  code: number;
}

export const buildItamQrValue = (code: number): string => `/q/${code}`;

export const itamQrAllowedOrigins = (
  configuredBaseUrl = environment.assetDetailBaseUrl,
  currentOrigin = window.location.origin
): ReadonlySet<string> => {
  const origins = new Set<string>([new URL(currentOrigin).origin]);
  const configured = configuredBaseUrl.trim();
  if (configured) {
    try {
      origins.add(new URL(configured, currentOrigin).origin);
    } catch {
      // Una base mal configurada nunca amplía los orígenes confiables.
    }
  }
  return origins;
};

export const parseItamQrValue = (
  rawValue: string,
  allowedOrigins: ReadonlySet<string> = itamQrAllowedOrigins()
): ItamQrTarget | null => {
  const value = rawValue.trim();
  if (!value) return null;

  let path = value;
  if (!value.startsWith('/')) {
    try {
      const url = new URL(value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.search ||
        url.hash ||
        !allowedOrigins.has(url.origin)
      ) {
        return null;
      }
      path = url.pathname;
    } catch {
      return null;
    }
  }

  const permanentMatch = /^\/q\/([1-9]\d*)$/.exec(path);
  if (permanentMatch) {
    const code = Number(permanentMatch[1]);
    return Number.isSafeInteger(code) ? { entity: null, code } : null;
  }

  const legacyMatch = /^\/(dispositivos|sim)\/([1-9]\d*)\/?$/.exec(path);
  if (!legacyMatch) return null;
  const code = Number(legacyMatch[2]);
  if (!Number.isSafeInteger(code)) return null;
  return {
    entity: legacyMatch[1] === 'sim' ? 'SIM' : 'DISPOSITIVO',
    code
  };
};
