import { AsyncLocalStorage } from "node:async_hooks";

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  cargo: string | null;
  rol: "SUPER_USUARIO" | "USUARIO";
  debeCambiarPassword: boolean;
  debeCambiarPin: boolean;
}

const storage = new AsyncLocalStorage<AuthUser>();

export const runWithAuthUser = (
  user: AuthUser,
  next: () => void
): void => storage.run(user, next);

export const currentAuthUser = (): AuthUser | undefined =>
  storage.getStore();

export const currentUserId = (): string | null =>
  storage.getStore()?.id ?? null;
