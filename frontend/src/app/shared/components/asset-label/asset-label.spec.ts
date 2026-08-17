import { TestBed } from '@angular/core/testing';
import { AssetLabel } from './asset-label';

describe('AssetLabel', () => {
  it('renderiza Code 128 con el mismo código ITAM visible', async () => {
    const fixture = TestBed.createComponent(AssetLabel);
    fixture.componentRef.setInput('code', 1001);
    fixture.componentRef.setInput('assetType', 'SMARTPHONE');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const svg = element.querySelector('svg');
    expect(element.textContent).toContain('1001');
    expect(element.textContent).toContain('SMARTPHONE');
    expect(svg?.querySelectorAll('rect').length).toBeGreaterThan(1);
  });
});
