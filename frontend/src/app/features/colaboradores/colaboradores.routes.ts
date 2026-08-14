import { Routes } from '@angular/router';
export const COLABORADORES_ROUTES: Routes = [
  { path:'',loadComponent:()=>import('./colaboradores-list').then(m=>m.ColaboradoresList) },
  { path:'nuevo',loadComponent:()=>import('./colaborador-form').then(m=>m.ColaboradorForm) },
  { path:':id',loadComponent:()=>import('./colaborador-detail').then(m=>m.ColaboradorDetail) },
  { path:':id/editar',loadComponent:()=>import('./colaborador-form').then(m=>m.ColaboradorForm) }
];
