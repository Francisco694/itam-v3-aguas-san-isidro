import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AssetLabel } from './asset-label';
vi.mock('qrcode',()=>({default:{toCanvas:vi.fn().mockResolvedValue(undefined)}}));

describe('AssetLabel', () => {
  it('prepara un QR conservando el mismo código ITAM visible', async () => {
    const fixture = TestBed.createComponent(AssetLabel);
    fixture.componentRef.setInput('code', 1001);
    fixture.componentRef.setInput('assetType', 'SMARTPHONE');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const canvas = element.querySelector('canvas');
    expect(element.textContent).toContain('1001');
    expect(element.textContent).toContain('SMARTPHONE');
    expect(canvas).not.toBeNull();
  });
});
