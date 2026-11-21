import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'admin/menus' },
  {
    path: 'admin/menus',
    title: 'Menüs verwalten | GIG',
    loadComponent: () => import('./menus/menu-page').then((m) => m.MenuPage),
  },
];
