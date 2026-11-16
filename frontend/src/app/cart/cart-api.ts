import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** An allowed extra with its per-serving price and limit. */
export interface Extra {
  id: string;
  name: string;
  surcharge: number;
  maximumQuantity: number;
}

/** Current product data supplied by the menu module. */
export interface Product {
  id: string;
  name: string;
  price: number;
  active: boolean;
  available: boolean;
  extras: Record<string, Extra>;
}

/** A selection sent to the server without client prices. */
export interface ItemInput {
  productId: string;
  quantity: number;
  note: string;
  extras: { extraId: string; quantity: number }[];
}

/** A saved line with server prices and validation errors. */
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  note: string;
  extras: { extraId: string; name: string; quantity: number; surcharge: number | null }[];
  unitPrice: number | null;
  total: number | null;
  errors: string[];
}

/** The current session’s cart; invalid totals are null. */
export interface Cart {
  id: string | null;
  items: CartItem[];
  total: number | null;
  currency: string;
  canSubmit: boolean;
}

/** A page of active menu products. */
export interface ProductPage {
  content: Product[];
  page: number;
  size: number;
  totalElements: number;
}

/** Calls the cart API with the guest’s bearer credential. */
@Service()
export class CartApi {
  private readonly http = inject(HttpClient);
  private readonly root = '/api/order-drafts';

  /** Loads the caller’s cart. */
  current(token: string) {
    return this.http.get<Cart>(`${this.root}/current`, this.options(token));
  }

  /** Searches a page of active menu products. */
  products(token: string, search: string, page: number) {
    return this.http.get<ProductPage>(`${this.root}/products`, {
      ...this.options(token),
      params: { search, page, size: 10 },
    });
  }

  /** Loads current product options for editing. */
  product(token: string, id: string) {
    return this.http.get<Product>(
      `${this.root}/products/${encodeURIComponent(id)}`,
      this.options(token),
    );
  }

  /** Adds or replaces a cart line. */
  save(token: string, item: ItemInput, id?: string) {
    return id
      ? this.http.put<Cart>(
          `${this.root}/current/items/${encodeURIComponent(id)}`,
          item,
          this.options(token),
        )
      : this.http.post<Cart>(`${this.root}/current/items`, item, this.options(token));
  }

  /** Deletes an item from the caller’s cart. */
  remove(token: string, id: string) {
    return this.http.delete<Cart>(
      `${this.root}/current/items/${encodeURIComponent(id)}`,
      this.options(token),
    );
  }

  /** Checks the cart without submitting an order. */
  validate(token: string) {
    return this.http.post<Cart>(`${this.root}/current/validate`, {}, this.options(token));
  }

  /** Authenticates only these cart requests. */
  private options(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
  }
}
