import { Routes } from '@angular/router';
export const DEPARTAMENTOS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./departamentos-list').then((m) => m.DepartamentosList) },
  { path: 'nuevo', loadComponent: () => import('./departamento-form').then((m) => m.DepartamentoForm) },
  { path: ':id/editar', loadComponent: () => import('./departamento-form').then((m) => m.DepartamentoForm) }
];
