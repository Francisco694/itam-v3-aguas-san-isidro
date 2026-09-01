import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/models/api.models';
import { Departamento } from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';
import { formatRut, formattedRutCaret, isValidRut, normalizeRut } from '../../shared/utils/rut';

export const isCollaboratorRutConflict = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status === 409 &&
  error.code === 'RUT_ALREADY_EXISTS';

export const rutValidator = (control: AbstractControl): ValidationErrors | null =>
  control.value && !isValidRut(control.value) ? { rutInvalid: true } : null;

@Component({selector:'app-colaborador-form',imports:[ReactiveFormsModule,RouterLink,PageHeader,ViewState],template:`
<app-page-header [title]="id?'Editar colaborador':'Nuevo colaborador'" subtitle="Información real utilizada para custodias y asignaciones." />
@if(loading()){<section class="card"><app-view-state kind="loading" title="Cargando colaborador" /></section>}@else{<form class="card form-card" [formGroup]="form" (ngSubmit)="submit()">@if(apiError()){<div class="notice notice--error">{{apiError()}}</div>}
<div class="form-grid"><div class="field"><label for="rut">RUT *</label><input id="rut" formControlName="rut" maxlength="20" autocomplete="off" (input)="formatRutField($event)" [class.invalid]="invalid('rut')" />@if(form.controls.rut.hasError('rutAlreadyExists')){<p class="field-error">Ya existe un colaborador registrado con este RUT.</p>}@else if(form.controls.rut.hasError('rutInvalid')&&invalid('rut')){<p class="field-error">El RUT ingresado no es válido.</p>}@else if(invalid('rut')){<p class="field-error">El RUT es obligatorio (máximo 20 caracteres).</p>}</div><div class="field"><label for="nombre">Nombre *</label><input id="nombre" formControlName="nombre" maxlength="180" [class.invalid]="invalid('nombre')" />@if(invalid('nombre')){<p class="field-error">El nombre es obligatorio (máximo 180 caracteres).</p>}</div><div class="field"><label for="cargo">Cargo</label><input id="cargo" formControlName="cargo" maxlength="150" /></div><div class="field"><label for="departamento">Departamento</label><select id="departamento" formControlName="departamentoId"><option value="">Sin departamento</option>@for(item of departments();track item.id){<option [value]="item.id">{{item.nombre}}</option>}</select></div><div class="field span-2"><label for="localidad">Localidad</label><input id="localidad" formControlName="localidad" maxlength="120" /></div><div class="field span-2"><label for="observaciones">Observaciones</label><textarea id="observaciones" formControlName="observaciones"></textarea></div><label class="checkbox span-2"><input type="checkbox" formControlName="activo" /> Colaborador activo</label></div>
<div class="form-actions"><a class="btn btn--secondary" routerLink="/colaboradores">Cancelar</a><button class="btn btn--primary" [disabled]="submitting()" type="submit">{{submitting()?'Guardando…':'Guardar colaborador'}}</button></div></form>}`,styles:[`.form-card{max-width:52rem;padding:1.4rem}`]})
export class ColaboradorForm implements OnInit{
 private readonly fb=inject(FormBuilder);private readonly service=inject(ColaboradoresService);private readonly deptService=inject(DepartamentosService);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);
 protected id='';protected readonly departments=signal<Departamento[]>([]);protected readonly loading=signal(false);protected readonly submitting=signal(false);protected readonly apiError=signal('');
 protected readonly form=this.fb.nonNullable.group({rut:['',[Validators.required,Validators.maxLength(20),rutValidator]],nombre:['',[Validators.required,Validators.maxLength(180)]],cargo:['',[Validators.maxLength(150)]],departamentoId:[''],localidad:['',[Validators.maxLength(120)]],activo:[true],observaciones:['']});
 ngOnInit(){this.deptService.listar().subscribe({next:i=>this.departments.set(i)});this.id=this.route.snapshot.paramMap.get('id')||'';if(this.id){this.loading.set(true);this.service.obtener(this.id).subscribe({next:i=>{this.form.patchValue({rut:formatRut(i.rut),nombre:i.nombre,cargo:i.cargo||'',departamentoId:i.departamento?.id||'',localidad:i.localidad||'',activo:i.activo,observaciones:i.observaciones||''});this.loading.set(false)},error:e=>{this.apiError.set(errorMessage(e));this.loading.set(false)}})}}
 protected invalid(name:'rut'|'nombre'){const c=this.form.controls[name];return c.invalid&&(c.dirty||c.touched)}
 protected formatRutField(event:Event){const input=event.target as HTMLInputElement;const canonicalBeforeCaret=normalizeRut(input.value.slice(0,input.selectionStart??input.value.length)).length;const formatted=formatRut(input.value);this.form.controls.rut.setValue(formatted,{emitEvent:false});const caret=formattedRutCaret(formatted,canonicalBeforeCaret);requestAnimationFrame(()=>input.setSelectionRange(caret,caret))}
 protected submit(){if(this.form.invalid){this.form.markAllAsTouched();return}this.submitting.set(true);this.apiError.set('');const v=this.form.getRawValue();const input={rut:normalizeRut(v.rut),nombre:v.nombre.trim(),cargo:v.cargo.trim()||null,departamentoId:v.departamentoId?Number(v.departamentoId):null,localidad:v.localidad.trim()||null,activo:v.activo,observaciones:v.observaciones.trim()||null};const request=this.id?this.service.actualizar(this.id,input):this.service.crear(input);request.subscribe({next:item=>this.router.navigate(['/colaboradores',item.id]),error:e=>{if(isCollaboratorRutConflict(e)){const rut=this.form.controls.rut;rut.setErrors({...rut.errors,rutAlreadyExists:true});rut.markAsTouched()}this.apiError.set(errorMessage(e));this.submitting.set(false)}})}
}
