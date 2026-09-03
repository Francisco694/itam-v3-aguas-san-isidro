import { ConfiguracionFormularioTipo, TipoDispositivo } from '../../core/models/itam.models';
import { ApiError } from '../../core/models/api.models';
import { allowsDeviceCreation, assetFieldVisibility, deviceConflictMessage, operationalTypeOptions, typesForOperationalGroup } from './dispositivo-form';

const defaultConfig: ConfiguracionFormularioTipo = {
  mostrarMarca: true, mostrarModelo: true, mostrarNumeroSerie: true,
  camposEspecificos: []
};

const type = (
  name: string,
  options: {
    family?: boolean;
    grouped?: boolean;
    requiresImei?: boolean;
    config?: ConfiguracionFormularioTipo;
  } = {}
): TipoDispositivo => ({
  id: name, nombre: name, descripcion: null, activo: true,
  requiereImei: options.requiresImei ?? false,
  configuracionFormulario: options.config ?? defaultConfig,
  familiaCodigoInventario: options.family === false ? null : {
    id: options.grouped ? '6' : '1', nombre: options.grouped ? 'Periféricos' : name,
    prefijo: options.grouped ? '6' : '1', activo: true,
    estrategiaCodigo: 'REPEAT_PREFIX', agrupaTipos: options.grouped ?? false,
    etiquetaOperativa: options.grouped ? 'Periférico' : null
  },
  creadoEn: '2026-08-17T00:00:00.000Z', actualizadoEn: '2026-08-17T00:00:00.000Z'
});

describe('formulario dinámico de activos', () => {
  it('mantiene el código automático bloqueando tipos sin familia activa', () => {
    expect(allowsDeviceCreation(type('Legacy', { family: false }))).toBe(false);
  });

  it('muestra un conflicto claro para IMEI duplicado', () => {
    expect(deviceConflictMessage(
      new ApiError('CONFLICT', 'Ya existe un recurso con alguno de los identificadores informados.', 409),
      { imei: '123456789012345', numeroSerie: '' },
    )).toBe('Ya existe un dispositivo registrado con este IMEI.');
  });

  it('muestra un conflicto claro para número de serie duplicado', () => {
    expect(deviceConflictMessage(
      new ApiError('CONFLICT', 'Ya existe un recurso con alguno de los identificadores informados.', 409),
      { imei: '', numeroSerie: 'SERIE-001' },
    )).toBe('Ya existe un dispositivo registrado con este número de serie.');
  });

  it('conserva visible el tipo legado del equipo durante su edición', () => {
    const legacy = type('Legacy', { family: false });
    expect(operationalTypeOptions([legacy], legacy.id)).toEqual([{ value: 'Legacy', label: 'Legacy' }]);
  });

  it('Smartphone muestra IMEI y los campos técnicos comunes', () => {
    expect(assetFieldVisibility(type('Smartphone', { requiresImei: true }))).toMatchObject({
      marca: true, modelo: true, numeroSerie: true, imei: true
    });
  });

  it('Notebook, Monitor y PC muestran serie pero no IMEI', () => {
    for (const name of ['Notebook', 'Monitor', 'PC']) {
      expect(assetFieldVisibility(type(name))).toMatchObject({ numeroSerie: true, imei: false });
    }
  });

  it('el selector operacional no muestra prefijos ni familias técnicas', () => {
    const options = operationalTypeOptions([type('Notebook'), type('Smartphone', { requiresImei: true })]);
    expect(options.map((option) => option.label)).toEqual(['Notebook', 'Smartphone']);
    expect(JSON.stringify(options)).not.toContain('prefijo');
    expect(JSON.stringify(options)).not.toContain('familia');
  });

  it('Periférico agrupa Mouse, Teclado y Cable en un segundo selector', () => {
    const types = ['Mouse', 'Teclado', 'Cable'].map((name) => type(name, { grouped: true }));
    expect(operationalTypeOptions(types)).toEqual([{ value: 'group:6', label: 'Periférico' }]);
    expect(typesForOperationalGroup(types, '6').map((item) => item.nombre)).toEqual(['Cable', 'Mouse', 'Teclado']);
  });

  it('Mouse muestra Marca y Modelo sin atributos adicionales', () => {
    const visibility = assetFieldVisibility(type('Mouse', { grouped: true }));
    expect(visibility).toMatchObject({ marca: true, modelo: true, imei: false });
    expect(visibility.camposEspecificos).toEqual([]);
  });

  it('Teclado permite Part Number y número de serie', () => {
    const keyboard = type('Teclado', { grouped: true, config: {
      ...defaultConfig,
      camposEspecificos: [{ clave: 'partNumber', etiqueta: 'Part Number', tipo: 'text', requerido: false }]
    } });
    const visibility = assetFieldVisibility(keyboard);
    expect(visibility.numeroSerie).toBe(true);
    expect(visibility.camposEspecificos.map((field) => field.clave)).toContain('partNumber');
  });

  it('Cable exige tipo de cable y no muestra número de serie', () => {
    const cable = type('Cable', { grouped: true, config: {
      mostrarMarca: true, mostrarModelo: true, mostrarNumeroSerie: false,
      camposEspecificos: [{ clave: 'tipoCable', etiqueta: 'Tipo de cable', tipo: 'select', requerido: true, opciones: ['HDMI'] }]
    } });
    const visibility = assetFieldVisibility(cable);
    expect(visibility.numeroSerie).toBe(false);
    expect(visibility.camposEspecificos[0]).toMatchObject({ clave: 'tipoCable', requerido: true });
  });
});
