import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { CategoryRequest, CategoryResponse } from './category-models';

@Service()
export class CategoryApi {
    private readonly http = inject(HttpClient);
    private readonly root = '/api/categories';

    list() {
        return this.http.get<CategoryResponse[]>(this.root);
    }

    get(id: string) {
        return this.http.get<CategoryResponse>(`${this.root}/${encodeURIComponent(id)}`);
    }

    create(category: CategoryRequest) {
        return this.http.post<CategoryResponse>(this.root, category);
    }

    update(id: string, category: CategoryRequest) {
        return this.http.put<CategoryResponse>(`${this.root}/${encodeURIComponent(id)}`, category);
    }

    // DELETE archives the category and returns 204 without a response body.
    delete(id: string) {
        return this.http.delete<void>(`${this.root}/${encodeURIComponent(id)}`);
    }
}

// Keep category-specific conflicts separate from menu scheduling errors.
export function categoryErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;

    if (error.status === 0) {
        return 'Der Server ist nicht erreichbar. Prüfe die Verbindung und versuche es erneut.';
    }
    if (error.status === 404) {
        return 'Die Kategorie wurde nicht gefunden. Bitte aktualisiere die Übersicht.';
    }
    if (error.status === 400) {
        return 'Bitte prüfe Anzeigename, internen Namen und Status. Die Namen dürfen jeweils höchstens 255 Zeichen enthalten.';
    }

    const body: unknown = error.error;
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;

    if (error.status === 409) {
        if (typeof detail === 'string' && detail.includes('internal name already exists')) {
            return 'Der interne Name ist bereits vergeben. Auch archivierte Kategorien behalten ihren Namen. Bitte wähle einen anderen internen Namen.';
        }
        if (typeof detail === 'string' && detail.includes('archived')) {
            return 'Archivierte Kategorien können nicht mehr bearbeitet oder aktiviert werden.';
        }
        return 'Die Angaben stehen im Konflikt mit vorhandenen Kategorien. Bitte aktualisiere die Übersicht und prüfe den internen Namen.';
    }
    return typeof detail === 'string' ? detail : fallback;
}
