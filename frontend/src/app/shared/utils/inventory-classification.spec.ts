import { describe, expect, it } from 'vitest';
import {
  belongsToInventoryView,
  isHistoricalPending,
  isInventoryValidated,
} from './inventory-classification';

const device = (
  origenRegistro: 'MANUAL' | 'IMPORTADO',
  resultado?: 'PENDIENTE' | 'VERIFICADO' | 'REVISAR',
  estadoCodigo = 'DISPONIBLE',
) => ({
  origenRegistro,
  verificacionFisica: resultado ? { resultado } : null,
  estadoCodigo,
});

describe('clasificación Inventario vs Histórico', () => {
  it('mantiene un legacy pendiente exclusivamente en Histórico', () => {
    const item = device('IMPORTADO', 'PENDIENTE');
    expect(isHistoricalPending(item)).toBe(true);
    expect(belongsToInventoryView(item, 'HISTORICO')).toBe(true);
    expect(belongsToInventoryView(item, 'REAL')).toBe(false);
  });

  it('mantiene un legacy REVISAR exclusivamente en Histórico', () => {
    const item = device('IMPORTADO', 'REVISAR');
    expect(belongsToInventoryView(item, 'HISTORICO')).toBe(true);
    expect(belongsToInventoryView(item, 'REAL')).toBe(false);
  });

  it('incorpora un legacy verificado asignado exclusivamente en Inventario', () => {
    const item = device('IMPORTADO', 'VERIFICADO', 'ASIGNADO');
    expect(isInventoryValidated(item)).toBe(true);
    expect(belongsToInventoryView(item, 'REAL')).toBe(true);
    expect(belongsToInventoryView(item, 'HISTORICO')).toBe(false);
  });

  it('incorpora un legacy verificado dado de baja sin cambiar su estado', () => {
    const item = device('IMPORTADO', 'VERIFICADO', 'DADO_BAJA');
    expect(item.estadoCodigo).toBe('DADO_BAJA');
    expect(belongsToInventoryView(item, 'REAL')).toBe(true);
    expect(belongsToInventoryView(item, 'HISTORICO')).toBe(false);
  });

  it('mantiene un manual dado de baja en Inventario sin cambiar su estado', () => {
    const item = device('MANUAL', 'VERIFICADO', 'DADO_BAJA');
    expect(item.estadoCodigo).toBe('DADO_BAJA');
    expect(belongsToInventoryView(item, 'REAL')).toBe(true);
    expect(belongsToInventoryView(item, 'HISTORICO')).toBe(false);
  });
});
