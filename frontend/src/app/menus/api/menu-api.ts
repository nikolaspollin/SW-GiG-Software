import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import type { CrudApi } from '../../shared/management/crud-api';
import { MenuRequest, MenuResponse } from './menu-models';

@Service()
export class MenuApi implements CrudApi<MenuResponse, MenuRequest> {
    private readonly http = inject(HttpClient);
    private readonly root = '/api/menus';

    list() {
        return this.http.get<MenuResponse[]>(this.root);
    }

    get(id: string) {
        return this.http.get<MenuResponse>(`${this.root}/${encodeURIComponent(id)}`);
    }

    create(menu: MenuRequest) {
        return this.http.post<MenuResponse>(this.root, menu);
    }

    update(id: string, menu: MenuRequest) {
        return this.http.put<MenuResponse>(`${this.root}/${encodeURIComponent(id)}`, menu);
    }

    /** DELETE archives the menu; the API returns 204 without a response body. */
    delete(id: string) {
        return this.http.delete<void>(`${this.root}/${encodeURIComponent(id)}`);
    }
}

// Map http error codes to user-friendly messages.
export function menuErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 0) {
        return 'Der Server ist nicht erreichbar. Prüfe die Verbindung und versuche es erneut.';
    }
    if (error.status === 404) {
        return 'Das Menü wurde nicht gefunden. Bitte aktualisiere die Übersicht.';
    }
    if (error.status === 400) {
        return 'Die Angaben sind ungültig. Bitte prüfe Name, Angebotstage und Uhrzeiten.';
    }
    const body: unknown = error.error;
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    if (error.status === 409 && typeof detail === 'string') {
        if (detail.includes('overlap')) {
            return 'Das Zeitfenster überschneidet sich mit einem anderen aktiven Menü. Ändere die Angebotstage oder Uhrzeiten oder speichere das Menü als Entwurf.';
        }
        if (detail.includes('archived')) {
            return 'Archivierte Menüs können nicht mehr bearbeitet oder aktiviert werden.';
        }
    }
    return typeof detail === 'string' ? detail : fallback;
}
