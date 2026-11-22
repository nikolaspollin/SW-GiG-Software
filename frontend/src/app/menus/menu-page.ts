import { Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { STATUS_LABELS } from '../shared/lifecycle-status';
import { DeleteDialog } from '../shared/management/delete-dialog/delete-dialog';
import { ManagementPage } from '../shared/management/management-page';
import { MenuApi, menuErrorMessage } from './api/menu-api';
import {
    endsNextDay,
    formatServingDays,
    formatTime,
    MenuRequest,
    MenuResponse,
} from './api/menu-models';
import { MenuEditor } from './editor/menu-editor';

// Supplies menu-specific rules and presentation to the shared management workflow.
@Component({
    selector: 'app-menu-page',
    imports: [MenuEditor, DeleteDialog],
    templateUrl: './menu-page.html',
    styleUrls: ['../shared/styles/management-page.css', './menu-page.css'],
})

export class MenuPage extends ManagementPage<MenuResponse, MenuRequest> {
    protected override readonly api = inject(MenuApi);
    protected override readonly errorMessage = menuErrorMessage;
    private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

    protected override readonly loadError =
        'Die Menüs konnten nicht geladen werden. Bitte versuche es erneut.';
    protected override readonly editLoadError =
        'Das Menü konnte nicht zum Bearbeiten geladen werden.';
    protected override readonly editBlockedError =
        'Dieses Menü wurde inzwischen archiviert und kann nicht mehr bearbeitet werden.';
    protected override readonly saveFailedError =
        'Das Menü konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.';
    protected override readonly deleteFailedError =
        'Das Menü konnte nicht gelöscht werden. Bitte versuche es erneut.';

    readonly menuList = computed(() =>
        [...(this.items() ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    );
    // Provide functionality for UI page.
    readonly statusLabels = STATUS_LABELS;
    readonly formatServingDays = formatServingDays;
    readonly formatTime = formatTime;
    readonly endsNextDay = endsNextDay;

    protected override canEdit(menu: MenuResponse): boolean {
        return menu.lifecycleStatus !== 'ARCHIVED';
    }

    protected override applyDeletion(menu: MenuResponse): void {
        // DELETE archives rather than removes the menu.
        this.replace({ ...menu, lifecycleStatus: 'ARCHIVED' });
    }

    protected override saveSuccessMessage(menu: MenuResponse): string {
        return `Das Menü „${menu.name}“ wurde gespeichert.`;
    }

    protected override deleteSuccessMessage(menu: MenuResponse): string {
        return `Das Menü „${menu.name}“ wurde gelöscht und als archiviert gekennzeichnet.`;
    }

    protected override focusHeading(): void {
        this.heading().nativeElement.focus();
    }
}
