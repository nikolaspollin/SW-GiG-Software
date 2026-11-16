import { TestBed } from '@angular/core/testing';
import { ItemEditor } from './item-editor';
import { Product } from './cart-api';

/** Checks selection output and form limits. */
describe('ItemEditor', () => {
  const product: Product = {
    id: 'pasta',
    name: 'Pasta',
    price: 12.5,
    active: true,
    available: true,
    extras: { cheese: { id: 'cheese', name: 'Cheese', surcharge: 1.5, maximumQuantity: 2 } },
  };

  /** Creates an editor with the sample product. */
  function editor() {
    const fixture = TestBed.createComponent(ItemEditor);
    fixture.componentRef.setInput('product', product);
    fixture.detectChanges();
    return fixture;
  }

  /** Emits quantities, extras and notes without client-calculated prices. */
  it('emits quantities, extras and notes without client-calculated prices', () => {
    const fixture = editor();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.values.set({ quantity: 2, note: 'No salt' });
    fixture.componentInstance.extraQuantities.set({ cheese: 2 });
    fixture.componentInstance.submit(new Event('submit'));
    expect(saved).toHaveBeenCalledWith({
      productId: 'pasta',
      quantity: 2,
      note: 'No salt',
      extras: [{ extraId: 'cheese', quantity: 2 }],
    });
  });

  /** Blocks invalid quantities, extra limits, long notes and busy submissions. */
  it('blocks invalid quantities, extra limits, long notes and busy submissions', () => {
    const fixture = editor();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    for (const quantity of [0, 100, 1.5]) {
      fixture.componentInstance.values.set({ quantity, note: '' });
      fixture.componentInstance.submit(new Event('submit'));
    }
    fixture.componentInstance.values.set({ quantity: 1, note: 'x'.repeat(501) });
    fixture.componentInstance.submit(new Event('submit'));
    fixture.componentInstance.values.set({ quantity: 1, note: '' });
    fixture.componentInstance.extraQuantities.set({ cheese: 3 });
    fixture.componentInstance.submit(new Event('submit'));
    fixture.componentInstance.extraQuantities.set({});
    fixture.componentRef.setInput('busy', true);
    fixture.componentInstance.submit(new Event('submit'));
    expect(saved).not.toHaveBeenCalled();
  });

  /** Resets inputs when switching products while the editor is open. */
  it('resets inputs when switching products while the editor is open', () => {
    const fixture = editor();
    fixture.componentInstance.values.set({ quantity: 3, note: 'Pasta note' });
    fixture.componentInstance.extraQuantities.set({ cheese: 2 });
    fixture.componentRef.setInput('product', { ...product, id: 'water', extras: {} });
    fixture.detectChanges();
    expect(fixture.componentInstance.values()).toEqual({ quantity: 1, note: '' });
    expect(fixture.componentInstance.extraQuantities()).toEqual({});
  });
});
