import { Routes } from '@angular/router';
import { writeGuard } from '../../core/guards/auth.guard';
export const SIM_ROUTES:Routes=[
 {path:'',loadComponent:()=>import('./sim-list').then(m=>m.SimList)},
 {path:'nuevo',canActivate:[writeGuard],loadComponent:()=>import('./sim-form').then(m=>m.SimForm)},
 {path:':codigo/editar',canActivate:[writeGuard],loadComponent:()=>import('./sim-form').then(m=>m.SimForm)},
 {path:':codigo',loadComponent:()=>import('./sim-detail').then(m=>m.SimDetail)}
];
