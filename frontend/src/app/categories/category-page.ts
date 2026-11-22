import {
    afterNextRender,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    Injector,
    signal,
    viewChild,
    WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Observable } from 'rxjs';
import { STATUS_LABELS } from '../shared/lifecycle-status';
import { CategoryApi, categoryErrorMessage } from './api/category-api';
import { CategoryRequest, CategoryResponse } from './api/category-models';
import { CategoryEditor } from './editor/category-editor';

// Coordinates category management; the editor owns its own form state.
@Component({
    selector: 'app-category-page',
    imports: [CategoryEditor],
    templateUrl: './category-page.html',
    styleUrl: '../shared/styles/management-page.css',
})

export class CategoryPage {
    private readonly api = inject(CategoryApi);
    private readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);
    private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
    private readonly deleteDialog =
        viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
    private editorTrigger: HTMLElement | null = null;

    // Data storage
    readonly categories = signal<CategoryResponse[] | null>(null);
    // Sorted list for UI
    readonly categoryList = computed(() =>
        [...(this.categories() ?? [])].sort((a, b) =>
            a.displayName.localeCompare(b.displayName, 'de'),
        ),
    );
    readonly busy = signal(false);
    readonly loading = signal(false);
    readonly error = signal('');
    readonly message = signal('');
    // CategoryResponse wrapped in another object to allow representing a closed editor => editor() == null
    readonly editor = signal<{ category: CategoryResponse | null } | null>(null);
    readonly pendingDelete = signal<CategoryResponse | null>(null);
    readonly deleteError = signal('');
    readonly statusLabels = STATUS_LABELS;

    ngOnInit() {
        void this.reload();
    }

    async reload() {
        if (this.busy()) return;

        this.loading.set(true);

        // Fetch categories from backend
        await this.run(
            this.api.list(),
            (categories) => this.categories.set(categories),
            'Die Kategorien konnten nicht geladen werden. Bitte versuche es erneut.',
        );
        if (!this.destroyRef.destroyed) this.loading.set(false);
    }

    // Show editor
    create(event: Event) {
        if (this.busy() || this.categories() === null) return;

        this.editorTrigger = event.currentTarget as HTMLElement;
        this.error.set('');
        this.message.set('');
        this.editor.set({ category: null });
    }

    // Open Editor to edit existing category
    async edit(category: CategoryResponse, event: Event) {
        if (this.busy() || category.lifecycleStatus === 'ARCHIVED') return;

        const trigger = event.currentTarget as HTMLElement;

        // Fetch current details so the editor does not rely on a stale list entry.
        await this.run(
            this.api.get(category.id),
            (current) => {
                this.replace(current);

                if (current.lifecycleStatus === 'ARCHIVED') {
                    this.error.set(
                        'Diese Kategorie wurde inzwischen archiviert und kann nicht mehr bearbeitet werden.',
                    );
                    return;
                }

                this.editorTrigger = trigger;
                this.editor.set({ category: current });
            },
            'Die Kategorie konnte nicht zum Bearbeiten geladen werden.',
        );
    }

    // Hide editor
    cancelEditor() {
        if (this.busy()) return;

        this.editor.set(null);
        this.error.set('');

        // The New Category button is enabled again after the editor has been removed.
        afterNextRender(
            () => {
                if (this.editorTrigger?.isConnected) this.editorTrigger.focus();
                else this.heading().nativeElement.focus();
            },
            { injector: this.injector },
        );
    }

    // Send actual request to either update or create category
    async save(request: CategoryRequest) {
        const current = this.editor();

        if (!current || this.busy()) return;

        // Build request
        const source = current.category
            ? this.api.update(current.category.id, request)
            : this.api.create(request);

        // Actual api call
        await this.run(
            source,
            (category) => {
                this.replace(category);

                this.editor.set(null);
                this.message.set(`Die Kategorie „${category.displayName}“ wurde gespeichert.`);
                this.heading().nativeElement.focus();
            },
            'Die Kategorie konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.',
        );
    }

    // Show delete dialog
    requestDelete(category: CategoryResponse) {
        if (this.busy() || category.lifecycleStatus === 'ARCHIVED') return;

        this.deleteError.set('');
        this.pendingDelete.set(category);
        this.deleteDialog().nativeElement.showModal();
    }

    cancelDelete(event?: Event) {
        // Prevent Escape from closing the dialog while a deletion is in flight.
        if (this.busy()) {
            event?.preventDefault();
            return;
        }

        this.deleteDialog().nativeElement.close();
        this.pendingDelete.set(null);
        this.deleteError.set('');
    }

    // Actual delete call to backend
    async confirmDelete() {
        const category = this.pendingDelete();

        if (!category || this.busy()) return;

        await this.run(
            this.api.delete(category.id),
            () => {
                // The API returns no body; DELETE archives rather than removes the category.
                this.replace({ ...category, lifecycleStatus: 'ARCHIVED' });

                // Close editor, if the deleted category was open in the editor
                if (this.editor()?.category?.id === category.id) this.editor.set(null);

                this.deleteDialog().nativeElement.close();
                this.pendingDelete.set(null);
                this.message.set(
                    `Die Kategorie „${category.displayName}“ wurde gelöscht und als archiviert gekennzeichnet.`,
                );
                this.heading().nativeElement.focus();
            },
            'Die Kategorie konnte nicht gelöscht werden. Bitte versuche es erneut.',
            this.deleteError,
        );
    }

    // Update existing category in frontend data storage
    private replace(category: CategoryResponse) {
        this.categories.update((categories) => [
            ...(categories ?? []).filter((item) => item.id !== category.id),
            category,
        ]);
    }

    // Share loading/error handling within this page, and cancel requests on navigation away.
    private async run<T>(
        request: Observable<T>,
        apply: (value: T) => void,
        fallback: string,
        target: WritableSignal<string> = this.error,
    ) {
        if (this.busy()) return;

        this.busy.set(true);
        target.set('');
        this.message.set('');

        try {
            // Passed requests are already started but may not be completed yet.
            const result = await firstValueFrom(request.pipe(takeUntilDestroyed(this.destroyRef)));
            if (!this.destroyRef.destroyed) apply(result);
        } catch (error: unknown) {
            if (!this.destroyRef.destroyed) target.set(categoryErrorMessage(error, fallback));
        } finally {
            if (!this.destroyRef.destroyed) this.busy.set(false);
        }
    }
}
