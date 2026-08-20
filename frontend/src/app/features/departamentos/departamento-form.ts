import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Departamento } from '../../core/models/itam.models';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({ selector:'app-departamento-form',imports:[ReactiveFormsModule,RouterLink,PageHeader,ViewState],template:`
<app-page-header [title]="id?'Editar departamento':'Nuevo departamento'" subtitle="Los campos y límites reflejan las validaciones de la API." />
@if(loading()){<section class="card"><app-view-state kind="loading" title="Cargando departamento" /></section>}@else{<form class="card form-card" [formGroup]="form" (ngSubmit)="submit()">
@if(apiError()){<div class="notice notice--error">{{apiError()}}</div>}
<div class="form-grid"><div class="field span-2"><label for="nombre">Nombre *</label><input id="nombre" formControlName="nombre" maxlength="120" [class.invalid]="invalid('nombre')" />@if(invalid('nombre')){<p class="field-error">El nombre es obligatorio (máximo 120 caracteres).</p>}</div>
<div class="field span-2"><label for="dependencia">Dependencia</label><select id="dependencia" formControlName="dependencia_id"><option value="">Nivel principal / Sin dependencia</option>@for(department of availableDependencies();track department.id){<option [value]="department.id">{{department.nombre}}</option>}</select></div>
<div class="field span-2"><label for="observaciones">Observaciones</label><textarea id="observaciones" formControlName="observaciones"></textarea></div><label class="checkbox span-2"><input type="checkbox" formControlName="activo" /> Departamento activo</label></div>
<div class="form-actions"><a class="btn btn--secondary" routerLink="/departamentos">Cancelar</a><button class="btn btn--primary" type="submit" [disabled]="submitting()">{{submitting()?'Guardando…':'Guardar departamento'}}</button></div></form>}` ,styles:[`.form-card{max-width:48rem;padding:1.4rem}`]})
export class DepartamentoForm implements OnInit {
 private readonly fb=inject(FormBuilder);private readonly service=inject(DepartamentosService);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);
 protected readonly loading=signal(false);protected readonly submitting=signal(false);protected readonly apiError=signal('');protected id='';
 protected readonly dependencies=signal<Departamento[]>([]);
 protected readonly form=this.fb.nonNullable.group({nombre:['',[Validators.required,Validators.maxLength(120)]],dependencia_id:[''],observaciones:[''],activo:[true]});
 ngOnInit(){this.id=this.route.snapshot.paramMap.get('id')||'';this.service.listar().subscribe({next:items=>this.dependencies.set(items.filter(item=>item.activo)),error:e=>this.apiError.set(errorMessage(e))});if(this.id){this.loading.set(true);this.service.obtener(this.id).subscribe({next:item=>{this.form.patchValue({nombre:item.nombre,dependencia_id:item.dependencia_id?.toString()||'',observaciones:item.observaciones||'',activo:item.activo});this.loading.set(false)},error:e=>{this.apiError.set(errorMessage(e));this.loading.set(false)}})}}
 protected availableDependencies(){return this.dependencies().filter(item=>item.id!==this.id)}
 protected invalid(name:'nombre'){const c=this.form.controls[name];return c.invalid&&(c.dirty||c.touched)}
 protected submit(){if(this.form.invalid){this.form.markAllAsTouched();return}this.submitting.set(true);this.apiError.set('');const raw=this.form.getRawValue();const input={nombre:raw.nombre,activo:raw.activo,observaciones:raw.observaciones.trim()||null,dependencia_id:raw.dependencia_id?Number(raw.dependencia_id):null};const request=this.id?this.service.actualizar(this.id,input):this.service.crear(input);request.subscribe({next:()=>this.router.navigate(['/departamentos']),error:e=>{this.apiError.set(errorMessage(e));this.submitting.set(false)}})}
}
