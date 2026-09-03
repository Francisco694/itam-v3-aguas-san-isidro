import { Routes } from '@angular/router';
export const DISPOSITIVOS_ROUTES:Routes=[
 {path:'',loadComponent:()=>import('./dispositivos-list').then(m=>m.DispositivosList)},
 {path:'nuevo',loadComponent:()=>import('./dispositivo-form').then(m=>m.DispositivoForm)},
 {path:':id/editar',loadComponent:()=>import('./dispositivo-form').then(m=>m.DispositivoForm)},
 {path:':id',loadComponent:()=>import('./dispositivo-detail').then(m=>m.DispositivoDetail)}
];
