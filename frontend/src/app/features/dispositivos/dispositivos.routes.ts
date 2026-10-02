import { Routes } from '@angular/router';
import { writeGuard } from '../../core/guards/auth.guard';
export const DISPOSITIVOS_ROUTES:Routes=[
 {path:'',loadComponent:()=>import('./dispositivos-list').then(m=>m.DispositivosList)},
 {path:'nuevo',canActivate:[writeGuard],loadComponent:()=>import('./dispositivo-form').then(m=>m.DispositivoForm)},
 {path:':codigo/editar',canActivate:[writeGuard],loadComponent:()=>import('./dispositivo-form').then(m=>m.DispositivoForm)},
 {path:':codigo',loadComponent:()=>import('./dispositivo-detail').then(m=>m.DispositivoDetail)}
];
