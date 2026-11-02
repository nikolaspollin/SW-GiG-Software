import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'cart' },
  { path: 'cart', loadComponent: () => import('./cart/cart-page').then((m) => m.CartPage) },
  { path: '**', redirectTo: 'cart' },
];
