import { CurrencyPipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { form, FormField, max, maxLength, min, required, validate } from '@angular/forms/signals';
import { CartItem, ItemInput, Product } from './cart-api';

/** Edits one product’s servings, extras and note. */
@Component({
  selector: 'app-item-editor',
  imports: [CurrencyPipe, FormField],
  template: `
    <section aria-labelledby="editor-title">
      <h2 id="editor-title" tabindex="-1" #heading>
        {{ initial() ? 'Edit' : 'Add' }} {{ product().name }}
      </h2>
      <p>
        Base price: {{ product().price | currency: 'EUR' }}. Extra quantities apply to each serving.
      </p>
      <form (submit)="submit($event)">
        <fieldset [disabled]="busy()">
          <legend>Item details</legend>
          <label for="item-quantity">Servings (1–99)</label>
          <input
            id="item-quantity"
            type="number"
            [formField]="fields.quantity"
            aria-describedby="item-error"
          />
          @for (extra of extras(); track extra.id) {
            <label [for]="'extra-' + extra.id"
              >{{ extra.name }} (+{{ extra.surcharge | currency: 'EUR' }} each, max.
              {{ extra.maximumQuantity }})</label
            >
            <input
              [id]="'extra-' + extra.id"
              type="number"
              min="0"
              [max]="extra.maximumQuantity"
              [value]="extraQuantities()[extra.id] ?? 0"
              (input)="setExtra(extra.id, $event)"
            />
          }
          <label for="item-note">Note (optional, up to 500 characters)</label>
          <textarea id="item-note" rows="3" [formField]="fields.note"></textarea>
          @if (fields().invalid() || !extrasValid()) {
            <p class="error" id="item-error">
              Enter valid quantities and a note of at most 500 characters.
            </p>
          } @else {
            <span id="item-error"></span>
          }
          <div class="actions">
            <button
              class="primary"
              type="submit"
              [disabled]="fields().invalid() || !extrasValid() || !product().available"
            >
              Save item
            </button>
            <button type="button" (click)="cancelled.emit()">Cancel</button>
          </div>
        </fieldset>
      </form>
    </section>
  `,
  styles: `
    section {
      padding: 1.25rem;
      border: 2px solid #476357;
      border-radius: 0.6rem;
      background: white;
    }
    fieldset {
      display: grid;
      gap: 0.5rem;
      border: 0;
      padding: 0;
      margin: 0;
    }
    legend {
      margin-bottom: 0.75rem;
      font-weight: 600;
    }
    textarea {
      width: 100%;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
  `,
})
export class ItemEditor {
  readonly product = input.required<Product>();
  readonly initial = input<CartItem | null>(null);
  readonly busy = input(false);
  readonly saved = output<ItemInput>();
  readonly cancelled = output<void>();
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  readonly values = linkedSignal({
    source: () => ({ product: this.product().id, item: this.initial() }),
    computation: ({ item }) => ({ quantity: item?.quantity ?? 1, note: item?.note ?? '' }),
  });
  readonly fields = form(this.values, (path) => {
    required(path.quantity);
    min(path.quantity, 1);
    max(path.quantity, 99);
    maxLength(path.note, 500);
    validate(path.quantity, ({ value }) =>
      Number.isInteger(value()) ? null : { kind: 'integer' },
    );
  });
  readonly extras = computed(() => Object.values(this.product().extras));
  readonly extraQuantities = linkedSignal({
    source: () => ({ product: this.product().id, item: this.initial() }),
    computation: ({ item }): Record<string, number> =>
      Object.fromEntries((item?.extras ?? []).map((extra) => [extra.extraId, extra.quantity])),
  });
  readonly extrasValid = computed(() =>
    this.extras().every((extra) => {
      const count = this.extraQuantities()[extra.id] ?? 0;
      return Number.isInteger(count) && count >= 0 && count <= extra.maximumQuantity;
    }),
  );

  /** Focuses the editor heading when it opens. */
  constructor() {
    afterNextRender(() => this.heading().nativeElement.focus());
  }

  /** Updates the requested quantity of an extra. */
  setExtra(id: string, event: Event) {
    const count = (event.target as HTMLInputElement).valueAsNumber;
    this.extraQuantities.update((values) => ({ ...values, [id]: count }));
  }

  /** Emits a valid selection once the form is ready. */
  submit(event: Event) {
    event.preventDefault();
    if (this.busy() || this.fields().invalid() || !this.extrasValid() || !this.product().available)
      return;
    const { quantity, note } = this.values();
    this.saved.emit({
      productId: this.product().id,
      quantity,
      note,
      extras: this.extras()
        .filter((extra) => (this.extraQuantities()[extra.id] ?? 0) > 0)
        .map((extra) => ({ extraId: extra.id, quantity: this.extraQuantities()[extra.id] })),
    });
  }
}
