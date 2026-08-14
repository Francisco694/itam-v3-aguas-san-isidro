import { Routes } from '@angular/router';
export const SIM_ROUTES:Routes=[
 {path:'',loadComponent:()=>import('./sim-list').then(m=>m.SimList)},
 {path:'nuevo',loadComponent:()=>import('./sim-form').then(m=>m.SimForm)},
 {path:':codigo/editar',loadComponent:()=>import('./sim-form').then(m=>m.SimForm)},
 {path:':codigo',loadComponent:()=>import('./sim-detail').then(m=>m.SimDetail)}
];
