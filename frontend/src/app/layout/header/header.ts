import { Component, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDroplet, LucideMenu, LucidePackage, LucideUserMinus } from '@lucide/angular';
@Component({selector:'app-header',imports:[RouterLink,LucideDroplet,LucideMenu,LucidePackage,LucideUserMinus],template:`<header><div class="header-inner"><button class="menu" type="button" aria-label="Abrir menú" (click)="menu.emit()"><svg lucideMenu></svg></button><a class="brand" routerLink="/dashboard" aria-label="Inicio ITAM"><span class="brand__icon"><svg lucideDroplet></svg></span><span><strong>Aguas San Isidro</strong><small>SISTEMA ITAM v3.0</small></span></a><nav aria-label="Accesos rápidos"><a routerLink="/dispositivos"><svg lucidePackage></svg>Inventario</a><a routerLink="/offboarding"><svg lucideUserMinus></svg>Offboarding</a></nav><div class="avatar" title="Departamento de TI">TI</div></div></header>`,styleUrl:'./header.scss'})
export class Header { readonly menu=output<void>(); }
