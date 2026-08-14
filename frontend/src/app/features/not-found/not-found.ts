import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-not-found', imports: [RouterLink], template: `<section class="card not-found"><span>404</span><h1>Página no encontrada</h1><p>La ruta solicitada no existe en ITAM.</p><a class="btn btn--primary" routerLink="/dashboard">Volver al dashboard</a></section>`, styles: [`.not-found{text-align:center;padding:5rem 2rem}.not-found span{color:var(--color-primary);font-size:3rem;font-weight:900}.not-found h1{margin:.5rem 0}.not-found p{color:var(--color-muted);margin:0 0 1.5rem}`] })
export class NotFound {}
