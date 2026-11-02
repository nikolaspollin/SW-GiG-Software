import { CartApi, Cart, CartItem, ItemInput, Product, ProductPage } from './cart-api';
import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';

import { ItemEditor } from './item-editor';

/** Displays and edits the current table session’s cart. */
@Component({
  selector: 'app-cart-page',
  imports: [CurrencyPipe, ItemEditor],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.css',
})
export class CartPage {
  private readonly api = inject(CartApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private token = '';
  private sessionRevision = 0;
  readonly cart = signal<Cart | null>(null);
  readonly products = signal<ProductPage | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly search = signal('');
  readonly editor = signal<{ product: Product; item: CartItem | null } | null>(null);
  readonly hasAccess = signal(false);
  private returnFocus: HTMLElement | null = null;

  /** Watches table links and stops listening on destruction. */
  ngOnInit() {
    this.route.fragment
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => this.activate(fragment));
    this.destroyRef.onDestroy(() => this.sessionRevision++);
  }

  /** Switches credentials and invalidates older session responses. */
  private activate(fragment: string | null) {
    const incoming = new URLSearchParams(fragment ?? '').get('access');
    if (incoming) {
      sessionStorage.setItem('gig.guest-access', incoming);
      void this.router.navigate([], {
        relativeTo: this.route,
        fragment: undefined,
        replaceUrl: true,
      });
    }
    const token = sessionStorage.getItem('gig.guest-access') ?? '';
    if (token === this.token) return;
    this.token = token;
    this.sessionRevision++;
    this.busy.set(false);
    this.cart.set(null);
    this.products.set(null);
    this.editor.set(null);
    this.search.set('');
    this.hasAccess.set(!!this.token);
    if (this.token) void this.reload();
  }

  /** Refreshes the cart and first menu page. */
  async reload() {
    await this.run(
      (token) =>
        forkJoin({
          cart: this.api.current(token),
          products: this.api.products(token, this.search(), 0),
        }),
      (result) => {
        this.cart.set(result.cart);
        this.products.set(result.products);
        this.editor.set(null);
      },
    );
  }

  /** Searches or pages the menu. */
  async findProducts(event?: Event, page = 0) {
    event?.preventDefault();
    await this.run(
      (token) => this.api.products(token, this.search(), page),
      (products) => this.products.set(products),
    );
  }

  /** Opens an empty editor and remembers its trigger. */
  open(product: Product, event: Event) {
    this.returnFocus = event.currentTarget as HTMLElement;
    this.editor.set({ product, item: null });
  }

  /** Loads current menu options for a saved item. */
  async edit(item: CartItem, event: Event) {
    this.returnFocus = event.currentTarget as HTMLElement;
    await this.run(
      (token) => this.api.product(token, item.productId),
      (product) => this.editor.set({ product, item }),
    );
  }

  /** Closes the editor and restores keyboard focus. */
  cancelEditor() {
    this.editor.set(null);
    this.returnFocus?.focus();
  }

  /** Saves a selection and announces the updated cart. */
  async save(input: ItemInput) {
    await this.run(
      (token) => this.api.save(token, input, this.editor()?.item?.id),
      (cart) => {
        this.cart.set(cart);
        this.editor.set(null);
        this.message.set('Cart saved. Nothing has been ordered yet.');
        this.heading().nativeElement.focus();
      },
    );
  }

  /** Removes a line and returns focus to the cart. */
  async remove(item: CartItem) {
    await this.run(
      (token) => this.api.remove(token, item.id),
      (cart) => {
        this.cart.set(cart);
        this.message.set(`${item.name} removed.`);
        this.heading().nativeElement.focus();
      },
    );
  }

  /** Revalidates the cart without ordering. */
  async check() {
    await this.run(
      (token) => this.api.validate(token),
      (cart) => {
        this.cart.set(cart);
        this.message.set('Your cart is valid. Nothing has been ordered yet.');
      },
    );
  }

  /** Stores the menu search text. */
  setSearch(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** Handles request state and ignores responses from older sessions. */
  private async run<T>(request: (token: string) => Observable<T>, apply: (value: T) => void) {
    if (this.busy()) return;
    const revision = this.sessionRevision;
    const token = this.token;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const result = await firstValueFrom(request(token));
      if (revision === this.sessionRevision) apply(result);
    } catch (error: unknown) {
      if (revision !== this.sessionRevision) return;
      const detail: unknown = error instanceof HttpErrorResponse ? error.error?.detail : null;
      this.error.set(
        typeof detail === 'string' ? detail : 'Could not reach the restaurant. Please try again.',
      );
      if (error instanceof HttpErrorResponse && error.status === 422) {
        try {
          const cart = await firstValueFrom(this.api.current(token));
          if (revision === this.sessionRevision) this.cart.set(cart);
        } catch {
          /* Keep the original error. */
        }
      }
      if (error instanceof HttpErrorResponse && [401, 403, 409].includes(error.status)) {
        this.cart.set(null);
        this.products.set(null);
        this.editor.set(null);
      }
    } finally {
      if (revision === this.sessionRevision) this.busy.set(false);
    }
  }
}
