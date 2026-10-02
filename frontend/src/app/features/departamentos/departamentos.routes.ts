import { Routes } from '@angular/router';
import { writeGuard } from '../../core/guards/auth.guard';
export const DEPARTAMENTOS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./departamentos-list').then((m) => m.DepartamentosList) },
  { path: 'nuevo', canActivate:[writeGuard], loadComponent: () => import('./departamento-form').then((m) => m.DepartamentoForm) },
  { path: ':id/editar', canActivate:[writeGuard], loadComponent: () => import('./departamento-form').then((m) => m.DepartamentoForm) },
  { path: ':id', loadComponent: () => import('./departamento-detail').then((m) => m.DepartamentoDetail) }
];
