import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'departamentos', loadChildren: () => import('./features/departamentos/departamentos.routes').then((m) => m.DEPARTAMENTOS_ROUTES) },
      { path: 'colaboradores', loadChildren: () => import('./features/colaboradores/colaboradores.routes').then((m) => m.COLABORADORES_ROUTES) },
      { path: 'dispositivos', loadChildren: () => import('./features/dispositivos/dispositivos.routes').then((m) => m.DISPOSITIVOS_ROUTES) },
      { path: 'sim', loadChildren: () => import('./features/sim/sim.routes').then((m) => m.SIM_ROUTES) },
      { path: 'estados', loadComponent: () => import('./features/estados/estados-list').then((m) => m.EstadosList) },
      { path: 'tipos-dispositivo', loadComponent: () => import('./features/tipos-dispositivo/tipos-dispositivo-list').then((m) => m.TiposDispositivoList) },
      { path: 'familias-codigo', loadComponent: () => import('./features/familias-codigo/familias-codigo-list').then((m) => m.FamiliasCodigoList) },
      { path: 'offboarding', loadComponent: () => import('./features/offboarding/offboarding').then((m) => m.Offboarding) },
      { path: 'servicio-tecnico', loadComponent: () => import('./features/servicio-tecnico/servicio-tecnico').then((m) => m.ServicioTecnico) },
      { path: 'actas', loadComponent: () => import('./features/actas/actas').then((m) => m.Actas) },
      { path: '**', loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound) }
    ]
  }
];
