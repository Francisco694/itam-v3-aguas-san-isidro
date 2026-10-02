import { Routes } from '@angular/router';
import { writeGuard } from '../../core/guards/auth.guard';
export const COLABORADORES_ROUTES: Routes = [
  { path:'',loadComponent:()=>import('./colaboradores-list').then(m=>m.ColaboradoresList) },
  { path:'nuevo',canActivate:[writeGuard],loadComponent:()=>import('./colaborador-form').then(m=>m.ColaboradorForm) },
  { path:':id',loadComponent:()=>import('./colaborador-detail').then(m=>m.ColaboradorDetail) },
  { path:':id/editar',canActivate:[writeGuard],loadComponent:()=>import('./colaborador-form').then(m=>m.ColaboradorForm) }
];
