import { Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { STATUS_LABELS } from '../shared/lifecycle-status';
import { DeleteDialog } from '../shared/management/delete-dialog/delete-dialog';
import { ManagementPage } from '../shared/management/management-page';
import { CategoryApi, categoryErrorMessage } from './api/category-api';
import { CategoryRequest, CategoryResponse } from './api/category-models';
import { CategoryEditor } from './editor/category-editor';

// Supplies category-specific rules and presentation to the shared management workflow.
@Component({
    selector: 'app-category-page',
    imports: [CategoryEditor, DeleteDialog],
    templateUrl: './category-page.html',
    styleUrl: '../shared/styles/management-page.css',
})
export class CategoryPage extends ManagementPage<CategoryResponse, CategoryRequest> {
    protected override readonly api = inject(CategoryApi);
    protected override readonly errorMessage = categoryErrorMessage;
    private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

    protected override readonly loadError =
        'Die Kategorien konnten nicht geladen werden. Bitte versuche es erneut.';
    protected override readonly editLoadError =
        'Die Kategorie konnte nicht zum Bearbeiten geladen werden.';
    protected override readonly editBlockedError =
        'Diese Kategorie wurde inzwischen archiviert und kann nicht mehr bearbeitet werden.';
    protected override readonly saveFailedError =
        'Die Kategorie konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.';
    protected override readonly deleteFailedError =
        'Die Kategorie konnte nicht gelöscht werden. Bitte versuche es erneut.';

    readonly categoryList = computed(() =>
        [...(this.items() ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName, 'de')),
    );
    // Provide resource for UI page.
    readonly statusLabels = STATUS_LABELS;

    protected override canEdit(category: CategoryResponse): boolean {
        return category.lifecycleStatus !== 'ARCHIVED';
    }

    protected override applyDeletion(category: CategoryResponse): void {
        // DELETE archives rather than removes the category.
        this.replace({ ...category, lifecycleStatus: 'ARCHIVED' });
    }

    protected override saveSuccessMessage(category: CategoryResponse): string {
        return `Die Kategorie „${category.displayName}“ wurde gespeichert.`;
    }

    protected override deleteSuccessMessage(category: CategoryResponse): string {
        return `Die Kategorie „${category.displayName}“ wurde gelöscht und als archiviert gekennzeichnet.`;
    }

    protected override focusHeading(): void {
        this.heading().nativeElement.focus();
    }
}
