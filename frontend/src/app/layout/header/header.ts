import { Component,inject,output } from '@angular/core';
import { Router,RouterLink } from '@angular/router';
import { LucideDroplet,LucideKeyRound,LucideLogOut,LucideMenu,LucidePackage,LucideUserCog,LucideUserMinus } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';
@Component({
 selector:'app-header',
 imports:[RouterLink,LucideDroplet,LucideKeyRound,LucideLogOut,LucideMenu,LucidePackage,LucideUserCog,LucideUserMinus],
 template:`<header><div class="header-inner"><button class="menu" type="button" aria-label="Abrir menú" (click)="menu.emit()"><svg lucideMenu></svg></button><a class="brand" routerLink="/dashboard" aria-label="Inicio ITAM"><span class="brand__icon"><svg lucideDroplet></svg></span><span><strong>Aguas San Isidro</strong><small>SISTEMA ITAM v3.0</small></span></a><nav aria-label="Accesos rápidos"><a routerLink="/dispositivos"><svg lucidePackage></svg>Inventario</a><a routerLink="/offboarding"><svg lucideUserMinus></svg>Offboarding</a>@if(auth.user()?.rol==='SUPER_USUARIO'){<a routerLink="/administracion/usuarios"><svg lucideUserCog></svg>Usuarios</a>}</nav><div class="user-actions"><a class="avatar" routerLink="/mi-acceso" [title]="auth.user()?.debeCambiarPin?'Debe personalizar su PIN':'Mi acceso'">{{initials()}}</a><a class="logout" routerLink="/mi-acceso" aria-label="Administrar mi PIN" title="Administrar mi PIN"><svg lucideKeyRound></svg></a><button class="logout" type="button" aria-label="Cerrar sesión" title="Cerrar sesión" (click)="logout()"><svg lucideLogOut></svg></button></div></div></header>`,
 styleUrls:['./header.scss','./header-auth.scss']
})
export class Header{
 readonly auth=inject(AuthService);private readonly router=inject(Router);readonly menu=output<void>();
 protected initials(){return(this.auth.user()?.nombre||'TI').split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase()}
 protected logout(){this.auth.logout().subscribe({next:()=>void this.router.navigate(['/login'])})}
}
