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
import { MenuApi, menuErrorMessage } from './api/menu-api';
import { MenuEditor } from './editor/menu-editor';
import {
    endsNextDay,
    formatServingDays,
    formatTime,
    MenuRequest,
    MenuResponse,
} from './api/menu-models';

/** Coordinates management actions; the editor owns only form state. */
@Component({
    selector: 'app-menu-page',
    imports: [MenuEditor],
    templateUrl: './menu-page.html',
    styleUrls: ['../shared/styles/management-page.css', './menu-page.css'],
})
export class MenuPage {
    private readonly api = inject(MenuApi);
    private readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);
    private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
    private readonly deleteDialog =
        viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
    private editorTrigger: HTMLElement | null = null;

    readonly menus = signal<MenuResponse[] | null>(null);
    readonly menuList = computed(() =>
        [...(this.menus() ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    );
    readonly busy = signal(false);
    readonly loading = signal(false);
    readonly error = signal('');
    readonly message = signal('');
    readonly editor = signal<{ menu: MenuResponse | null } | null>(null);
    readonly pendingDelete = signal<MenuResponse | null>(null);
    readonly deleteError = signal('');
    readonly statusLabels = STATUS_LABELS;
    readonly formatServingDays = formatServingDays;
    readonly formatTime = formatTime;
    readonly endsNextDay = endsNextDay;

    ngOnInit() {
        void this.reload();
    }

    async reload() {
        if (this.busy()) return;

        this.loading.set(true);

        // Load all existing menus
        await this.run(
            this.api.list(),
            (menus) => this.menus.set(menus),
            'Die Menüs konnten nicht geladen werden. Bitte versuche es erneut.',
        );

        if (!this.destroyRef.destroyed) this.loading.set(false);
    }

    // Show editor
    create(event: Event) {
        if (this.busy() || this.menus() === null) return;

        this.editorTrigger = event.currentTarget as HTMLElement;
        this.error.set('');
        this.message.set('');
        // Triggers editor ui in menu-page.html
        this.editor.set({ menu: null });
    }

    async edit(menu: MenuResponse, event: Event) {
        if (this.busy() || menu.lifecycleStatus === 'ARCHIVED') return;

        const trigger = event.currentTarget as HTMLElement;

        // Fetch target menu from backend
        await this.run(
            this.api.get(menu.id),
            (current) => {
                this.replace(current);

                if (current.lifecycleStatus === 'ARCHIVED') {
                    this.error.set(
                        'Dieses Menü wurde inzwischen archiviert und kann nicht mehr bearbeitet werden.',
                    );
                    return;
                }

                this.editorTrigger = trigger;
                this.editor.set({ menu: current });
            },
            'Das Menü konnte nicht zum Bearbeiten geladen werden.',
        );
    }

    // Hide editor again
    cancelEditor() {
        if (this.busy()) return;

        this.editor.set(null);
        this.error.set('');

        afterNextRender(
            () => {
                if (this.editorTrigger?.isConnected) this.editorTrigger.focus();
                else this.heading().nativeElement.focus();
            },
            { injector: this.injector },
        );
    }

    // Send created / updated menu to backend
    async save(request: MenuRequest) {
        const current = this.editor();

        if (!current || this.busy()) return;

        const source = current.menu
            ? this.api.update(current.menu.id, request)
            : this.api.create(request);

        // Send backend request
        await this.run(
            source,
            (menu) => {
                this.replace(menu);

                this.editor.set(null);
                this.message.set(`Das Menü „${menu.name}“ wurde gespeichert.`);
                this.heading().nativeElement.focus();
            },
            'Das Menü konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.',
        );
    }

    // Show delete dialog for confirmation
    requestDelete(menu: MenuResponse) {
        if (this.busy() || menu.lifecycleStatus === 'ARCHIVED') return;

        this.deleteError.set('');
        this.pendingDelete.set(menu);
        this.deleteDialog().nativeElement.showModal();
    }

    // Hide delete dialog
    cancelDelete(event?: Event) {
        // Escape must not dismiss the dialog while DELETE is in flight.
        if (this.busy()) {
            event?.preventDefault();
            return;
        }

        this.deleteDialog().nativeElement.close();
        this.pendingDelete.set(null);
        this.deleteError.set('');
    }

    // Send delete request to backend
    async confirmDelete() {
        const menu = this.pendingDelete();
        if (!menu || this.busy()) return;

        await this.run(
            this.api.delete(menu.id),
            () => {
                this.replace({ ...menu, lifecycleStatus: 'ARCHIVED' });

                if (this.editor()?.menu?.id === menu.id) this.editor.set(null);

                this.deleteDialog().nativeElement.close();
                this.pendingDelete.set(null);
                this.message.set(
                    `Das Menü „${menu.name}“ wurde gelöscht und als archiviert gekennzeichnet.`,
                );
                this.heading().nativeElement.focus();
            },
            'Das Menü konnte nicht gelöscht werden. Bitte versuche es erneut.',
            this.deleteError,
        );
    }

    // Keep frontend menu state in sync with backend
    private replace(menu: MenuResponse) {
        this.menus.update((menus) => [
            ...(menus ?? []).filter((item) => item.id !== menu.id),
            menu,
        ]);
    }

    // Abstracts common request handling
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
            // Take first value from http request
            const result = await firstValueFrom(request.pipe(takeUntilDestroyed(this.destroyRef)));
            if (!this.destroyRef.destroyed) apply(result);
        } catch (error: unknown) {
            if (!this.destroyRef.destroyed) target.set(menuErrorMessage(error, fallback));
        } finally {
            if (!this.destroyRef.destroyed) this.busy.set(false);
        }
    }
}
