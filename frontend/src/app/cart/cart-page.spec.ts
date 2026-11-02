import { CartApi } from './cart-api';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { CartPage } from './cart-page';

/** Checks guest access, rendering and session switching. */
describe('CartPage', () => {
  let http: HttpTestingController;
  let fragments: BehaviorSubject<string | null>;
  /** Resets test state and providers. */
  beforeEach(() => {
    sessionStorage.clear();
    fragments = new BehaviorSubject<string | null>(null);
    TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { fragment: fragments } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  /** Checks pending requests and clears test state. */
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  /** Asks for a table QR code without making unauthenticated cart requests. */
  it('asks for a table QR code without making unauthenticated cart requests', async () => {
    const fixture = TestBed.createComponent(CartPage);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Scan the QR code');
    http.expectNone((req) => req.url.startsWith('/api/'));
  });

  /** Loads the session cart and keeps checking disabled for an empty cart. */
  it('loads the session cart and keeps checking disabled for an empty cart', async () => {
    sessionStorage.setItem('gig.guest-access', 'table-1');
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    http
      .expectOne('/api/order-drafts/current')
      .flush({ id: null, items: [], total: 0, currency: 'EUR', canSubmit: false });
    http
      .expectOne((req) => req.url === '/api/order-drafts/products')
      .flush({ content: [], page: 0, size: 10, totalElements: 0 });
    await vi.waitFor(() => expect(fixture.componentInstance.busy()).toBe(false));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Your cart is empty');
    const check = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Check cart'),
    );
    expect(check?.disabled).toBe(true);
  });

  /** Reports failed access and hides cart data. */
  it('reports failed access and hides cart data', async () => {
    sessionStorage.setItem('gig.guest-access', 'revoked');
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    http
      .expectOne('/api/order-drafts/current')
      .flush({ detail: 'Invalid guest access.' }, { status: 401, statusText: 'Unauthorized' });
    // forkJoin cancels the pending menu lookup after the first error.
    http.match((req) => req.url === '/api/order-drafts/products');
    await vi.waitFor(() => expect(fixture.componentInstance.busy()).toBe(false));
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role=alert]')?.textContent,
    ).toContain('Invalid guest access.');
    expect(fixture.componentInstance.cart()).toBeNull();
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  /** Ignores an older response after switching tables in the same tab. */
  it('ignores an older response after switching tables in the same tab', async () => {
    sessionStorage.setItem('gig.guest-access', 'table-1');
    const fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
    const oldCart = http.expectOne('/api/order-drafts/current');
    const oldMenu = http.expectOne((req) => req.url === '/api/order-drafts/products');
    fragments.next('access=table-2');
    const newCart = http.expectOne('/api/order-drafts/current');
    expect(newCart.request.headers.get('Authorization')).toBe('Bearer table-2');
    newCart.flush({ id: 'new-cart', items: [], total: 0, currency: 'EUR', canSubmit: false });
    http
      .expectOne((req) => req.url === '/api/order-drafts/products')
      .flush({ content: [], page: 0, size: 10, totalElements: 0 });
    await vi.waitFor(() => expect(fixture.componentInstance.cart()?.id).toBe('new-cart'));
    oldCart.flush({ id: 'old-cart', items: [], total: 0, currency: 'EUR', canSubmit: false });
    oldMenu.flush({ content: [], page: 0, size: 10, totalElements: 0 });
    await Promise.resolve();
    expect(fixture.componentInstance.cart()?.id).toBe('new-cart');
    expect(sessionStorage.getItem('gig.guest-access')).toBe('table-2');
  });
});

/** Checks HTTP authentication and request payloads. */
describe('CartApi', () => {
  let api: CartApi;
  let http: HttpTestingController;

  /** Resets test state and providers. */
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CartApi);
    http = TestBed.inject(HttpTestingController);
  });
  /** Checks pending requests and clears test state. */
  afterEach(() => http.verify());

  /** Uses bearer authentication and a server-selected session. */
  it('uses bearer authentication and a server-selected session', () => {
    api.current('guest-token').subscribe();
    const request = http.expectOne('/api/order-drafts/current');
    expect(request.request.headers.get('Authorization')).toBe('Bearer guest-token');
    expect(request.request.params.has('sessionId')).toBe(false);
    request.flush({ items: [] });
  });

  /** Sends item selections without accepting client prices. */
  it('sends item selections without accepting client prices', () => {
    const item = { productId: 'pasta', quantity: 2, note: 'No salt', extras: [] };
    api.save('token', item).subscribe();
    const add = http.expectOne('/api/order-drafts/current/items');
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual(item);
    add.flush({});
    api.save('token', item, 'item-1').subscribe();
    const update = http.expectOne('/api/order-drafts/current/items/item-1');
    expect(update.request.method).toBe('PUT');
    update.flush({});
  });

  /** Passes search and pagination as encoded parameters. */
  it('passes search and pagination as encoded parameters', () => {
    api.products('token', 'Pasta & cheese', 2).subscribe();
    const request = http.expectOne((req) => req.url === '/api/order-drafts/products');
    expect(request.request.params.get('search')).toBe('Pasta & cheese');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('10');
    request.flush({ content: [] });
  });
});
