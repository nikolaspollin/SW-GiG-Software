import {
    afterNextRender,
    DestroyRef,
    Directive,
    inject,
    Injector,
    signal,
    type OnInit,
    type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, type Observable } from 'rxjs';
import type { CrudApi } from './crud-api';

// Shares CRUD state and workflows while concrete pages own their business rules and views.
// Reduces boilerplate for CRUD pages.
@Directive()
export abstract class ManagementPage<TEntity extends { id: string }, TRequest> implements OnInit {
    protected readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);
    private editorTrigger: HTMLElement | null = null;

    // Items are the central entities shown on the UI page.
    readonly items = signal<TEntity[] | null>(null);
    readonly busy = signal(false);
    readonly loading = signal(false);
    readonly error = signal('');
    readonly message = signal('');
    // null closes the editor; { entity: null } opens an empty editor for creation.
    readonly editor = signal<{ entity: TEntity | null } | null>(null);
    // Is linked to delete dialog in UI page => therefore controls if dialog is shown or hidden.
    readonly pendingDelete = signal<TEntity | null>(null);
    readonly deleteError = signal('');

    protected abstract readonly api: CrudApi<TEntity, TRequest>;
    protected abstract readonly loadError: string;
    protected abstract readonly editLoadError: string;
    protected abstract readonly editBlockedError: string;
    protected abstract readonly saveFailedError: string;
    protected abstract readonly deleteFailedError: string;

    protected abstract errorMessage(error: unknown, fallback: string): string;
    protected abstract canEdit(entity: TEntity): boolean;
    protected abstract applyDeletion(entity: TEntity): void;
    protected abstract saveSuccessMessage(entity: TEntity): string;
    protected abstract deleteSuccessMessage(entity: TEntity): string;
    // The concrete page supplies its focus target; no template references are assumed here.
    protected abstract focusHeading(): void;

    ngOnInit() {
        void this.reload();
    }

    async reload() {
        if (this.busy()) return;

        this.loading.set(true);

        // Load all existing items from backend.
        await this.run(this.api.list(), (items) => this.items.set(items), this.loadError);
        if (!this.destroyRef.destroyed) this.loading.set(false);
    }

    // Show editor for creating a new entity.
    create(event: Event) {
        if (this.busy() || this.items() === null) return;

        this.editorTrigger = event.currentTarget as HTMLElement;
        this.error.set('');
        this.message.set('');
        this.editor.set({ entity: null });
    }

    // Open editor for editing an existing entity.
    async edit(entity: TEntity, event: Event) {
        if (this.busy() || !this.canEdit(entity)) return;

        const trigger = event.currentTarget as HTMLElement;

        // Refetch existing entity from backend to keep it up-to-date.
        await this.run(
            this.api.get(entity.id),
            async (current) => {
                // Update frontend model state.
                this.replace(current);

                // Recheck the fresh details instead of trusting a potentially stale list entry.
                if (!this.canEdit(current)) {
                    this.error.set(this.editBlockedError);
                    return;
                }

                this.editorTrigger = trigger;
                this.editor.set({ entity: current });

                await this.afterEditLoaded(current);
            },
            this.editLoadError,
        );
    }

    // Override only when a page needs additional work after opening an existing entity.
    protected afterEditLoaded(_entity: TEntity): void | Promise<void> {}

    // Hide editor.
    cancelEditor() {
        if (this.busy()) return;

        this.editor.set(null);
        this.error.set('');

        afterNextRender(
            () => {
                if (this.editorTrigger?.isConnected) this.editorTrigger.focus();
                else this.focusHeading();
            },
            { injector: this.injector },
        );
    }

    // Send actual request to either update or create entity.
    async save(request: TRequest) {
        const current = this.editor();
        if (!current || this.busy()) return;

        // Build request.
        const source = current.entity
            ? this.api.update(current.entity.id, request)
            : this.api.create(request);

        // Actual api call
        await this.run(
            source,
            (entity) => {
                // Update frontend model state.
                this.replace(entity);

                this.editor.set(null);
                this.message.set(this.saveSuccessMessage(entity));
                this.focusHeadingAfterRender();
            },
            this.saveFailedError,
        );
    }

    // Show delete dialog.
    requestDelete(entity: TEntity) {
        if (this.busy() || !this.canEdit(entity)) return;

        this.deleteError.set('');
        this.pendingDelete.set(entity);
    }

    // Hide delete dialog.
    cancelDelete() {
        if (this.busy()) return;

        this.pendingDelete.set(null);
        this.deleteError.set('');
    }

    // Actual delete call to backend.
    async confirmDelete() {
        const entity = this.pendingDelete();
        if (!entity || this.busy()) return;

        await this.run(
            this.api.delete(entity.id),
            () => {
                // Archiving or removing the local entry is the concrete page's decision.
                this.applyDeletion(entity);

                // Close editor, if the deleted category is currently opened in the editor
                if (this.editor()?.entity?.id === entity.id) this.editor.set(null);

                this.pendingDelete.set(null);
                this.message.set(this.deleteSuccessMessage(entity));
                this.focusHeadingAfterRender();
            },
            this.deleteFailedError,
            this.deleteError,
        );
    }

    // Update frontend model state.
    protected replace(entity: TEntity) {
        this.items.update((items) => [
            ...(items ?? []).filter((item) => item.id !== entity.id),
            entity,
        ]);
    }

    // Unified loading / error handling.
    // Cancels requests on switching pages.
    protected async run<T>(
        request: Observable<T>,
        apply: (value: T) => void | Promise<void>,
        fallback: string,
        target: WritableSignal<string> = this.error,
    ) {
        if (this.busy()) return;

        this.busy.set(true);
        target.set('');
        this.message.set('');

        try {
            const result = await firstValueFrom(request.pipe(takeUntilDestroyed(this.destroyRef)));
            // Await extension hooks as well, so their failures use the same error handling.
            if (!this.destroyRef.destroyed) await apply(result);
        } catch (error: unknown) {
            if (!this.destroyRef.destroyed) target.set(this.errorMessage(error, fallback));
        } finally {
            if (!this.destroyRef.destroyed) this.busy.set(false);
        }
    }

    private focusHeadingAfterRender() {
        // The dialog closes in the write phase, before this callback restores page focus.
        afterNextRender(() => this.focusHeading(), { injector: this.injector });
    }
}
