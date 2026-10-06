import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { AsociarLineaDispositivoInput, AsignarDispositivoColaboradorInput, AsignarDispositivoDepartamentoInput, CambiarEstadoInput, DarBajaInput, DevolverDispositivoInput, Dispositivo, DispositivoFilters, DispositivoInput, FiltroVerificacionDispositivo, HistorialEvento, LineaMovilResumen, ResultadoDevolucion, ResultadoOffboardingInput, ResumenGerencial, TipoIdentificadorDispositivo, TrazabilidadDispositivo, ValidacionIdentificadorDispositivo, VerificacionFisica, VerificacionFisicaResumen } from '../models/itam.models';

interface LineaMovilApiRow {
  id: string | number;
  numero_telefonico?: string;
  numeroTelefonico?: string;
  estado: LineaMovilResumen['estado'];
  dispositivo_id?: string | number | null;
  dispositivoId?: string | number | null;
  sim_id?: string | null;
  simId?: string | null;
  colaborador_id?: string | null;
  colaboradorId?: string | null;
}

const firstNonEmptyDashboardArray = (...candidates: unknown[]): unknown[] => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  return [];
};

const normalizeDashboardSummary = (response: unknown): ResumenGerencial => {
  const outer = response && typeof response === 'object'
    ? response as Record<string, unknown>
    : {};
  const payload = outer['data'] && typeof outer['data'] === 'object'
    ? outer['data'] as Record<string, unknown>
    : outer;
  const verificadosPorTipo = firstNonEmptyDashboardArray(
    payload['verificadosPorTipo'],
    payload['inventarioActivoRealVerificadoPorTipo'],
  );
  const historicoRegistradoPorTipo = firstNonEmptyDashboardArray(
    payload['historicoRegistradoPorTipo'],
    payload['historicoPorTipo'],
  );
  return {
    ...payload,
    verificadosPorTipo,
    inventarioActivoRealVerificadoPorTipo: verificadosPorTipo,
    historicoRegistradoPorTipo,
  } as unknown as ResumenGerencial;
};

@Injectable({ providedIn: 'root' })
export class DispositivosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/dispositivos`;
  listar(filters: DispositivoFilters = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params = params.set(key, String(value)); });
    return this.http.get<ApiCollectionResponse<Dispositivo>>(this.url, { params }).pipe(map((r) => r.data));
  }
  resumenGerencial(){return this.http.get<ApiItemResponse<ResumenGerencial>>(`${this.url}/resumen-gerencial`).pipe(map(normalizeDashboardSummary));}
  obtener(codigo: string | number) { return this.item(this.http.get<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}`)); }
  buscarPorCodigoInventario(codigo: number, filters: Pick<DispositivoFilters, 'verificacion' | 'origenRegistro' | 'clasificacion'> = {}) {
    return this.listar({ q: String(codigo), ...filters }).pipe(map((items) => {
      const item = items.find((candidate) => candidate.codigoInventario === codigo);
      if (!item) throw new Error('Dispositivo no encontrado.');
      return item;
    }));
  }
  crear(input: DispositivoInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(this.url, input)); }
  actualizar(codigo: number, input: Partial<DispositivoInput>) { return this.item(this.http.patch<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}`, input)); }
  validarIdentificadorDispositivo(tipo: TipoIdentificadorDispositivo, valor: string, excludeCodigoInventario?: number) {
    let params = new HttpParams().set('tipo', tipo).set('valor', valor);
    if (excludeCodigoInventario !== undefined) params = params.set('excludeCodigoInventario', String(excludeCodigoInventario));
    return this.http.get<ApiItemResponse<ValidacionIdentificadorDispositivo>>(`${this.url}/validar-identificador`, { params }).pipe(map((response) => response.data));
  }
  asociarLinea(codigo: number, input: AsociarLineaDispositivoInput) {
    const endpoint = `${this.url}/${codigo}/asociar-linea`;
    console.log('[asociar-linea] URL', endpoint);
    console.log('[asociar-linea] payload', input);
    return this.http.post<ApiItemResponse<LineaMovilApiRow>>(endpoint, input).pipe(
      tap({
        next: (response) => console.log('[asociar-linea] respuesta', response),
        error: (error) => console.error('[asociar-linea] error', error)
      }),
      map((response) => ({
        id: String(response.data.id),
        numeroTelefonico: response.data.numeroTelefonico ?? response.data.numero_telefonico ?? '',
        estado: response.data.estado,
        dispositivoId: response.data.dispositivoId === undefined
          ? response.data.dispositivo_id === null || response.data.dispositivo_id === undefined ? null : String(response.data.dispositivo_id)
          : response.data.dispositivoId === null ? null : String(response.data.dispositivoId),
        simId: response.data.simId ?? response.data.sim_id ?? null,
        colaboradorId: response.data.colaboradorId ?? response.data.colaborador_id ?? null
      }))
    );
  }
  asignarColaborador(codigo: number, input: AsignarDispositivoColaboradorInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}/asignar-colaborador`, input)); }
  asignarDepartamento(codigo: number, input: AsignarDispositivoDepartamentoInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}/asignar-departamento`, input)); }
  devolver(codigo: number, input: DevolverDispositivoInput) { return this.http.post<ApiItemResponse<ResultadoDevolucion>>(`${this.url}/${codigo}/devolver`, input).pipe(map(r=>r.data)); }
  registrarResultadoOffboarding(codigo:number,input:ResultadoOffboardingInput){return this.http.post<ApiItemResponse<Dispositivo|ResultadoDevolucion>>(`${this.url}/${codigo}/resultado-offboarding`,input).pipe(map(r=>r.data));}
  darBaja(codigo:number,input:DarBajaInput){return this.item(this.http.post<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}/dar-baja`,input));}
  cambiarEstado(codigo: number, input: CambiarEstadoInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}/cambiar-estado`, input)); }
  historial(codigo: number) { return this.http.get<ApiCollectionResponse<HistorialEvento>>(`${this.url}/${codigo}/historial`).pipe(map((r) => r.data)); }
  verificarManual(codigo: number) { return this.http.post<ApiItemResponse<VerificacionFisica>>(`${this.url}/${codigo}/verificacion-manual`, {}).pipe(map((r) => r.data)); }
  verificaciones(codigo: number) { return this.http.get<ApiCollectionResponse<VerificacionFisica>>(`${this.url}/${codigo}/verificaciones-fisicas`).pipe(map((r) => r.data)); }
  trazabilidad(codigo: string | number) { return this.http.get<ApiItemResponse<TrazabilidadDispositivo>>(`${this.url}/${codigo}/trazabilidad`).pipe(map((r) => r.data)); }
  private item<T>(request: Observable<ApiItemResponse<T>>) { return request.pipe(map((response) => response.data)); }
}
