export type UserRole = 'SUPER_USUARIO' | 'USUARIO';

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  cargo: string | null;
  rol: UserRole;
  debeCambiarPassword: boolean;
  debeCambiarPin: boolean;
}

export interface ManagedUser extends AuthUser {
  activo: boolean;
  pinConfigurado: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CreateUserInput {
  nombre: string;
  email: string;
  cargo: string;
  password: string;
  pin: string;
  rol: UserRole;
  activo: boolean;
}

export interface UpdateUserInput {
  nombre?: string;
  email?: string;
  cargo?: string | null;
  password?: string;
  pin?: string;
  rol?: UserRole;
  activo?: boolean;
}
