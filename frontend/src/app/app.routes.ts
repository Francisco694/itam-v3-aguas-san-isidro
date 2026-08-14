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
      { path: '**', loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound) }
    ]
  }
];
