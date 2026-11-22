import {
    afterRenderEffect,
    Component,
    ElementRef,
    input,
    output,
    viewChild,
    type OnDestroy,
} from '@angular/core';

let nextDialogId = 0;

// Owns native modal behavior; the page owns the pending entity and the DELETE request.
@Component({
    selector: 'app-delete-dialog',
    templateUrl: './delete-dialog.html',
    styleUrl: './delete-dialog.css',
})

export class DeleteDialog implements OnDestroy {
    readonly open = input(false);
    readonly title = input.required<string>();
    readonly description = input.required<string>();
    readonly confirmLabel = input('Löschen');
    readonly busyLabel = input('Wird gelöscht …');
    readonly busy = input(false);
    readonly error = input('');

    readonly confirmed = output<void>();
    readonly cancelled = output<void>();

    private readonly id = `delete-dialog-${nextDialogId++}`;
    readonly titleId = `${this.id}-title`;
    readonly descriptionId = `${this.id}-description`;
    private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

    constructor() {
        // Registers state change depending on signal changes from embedding component.
        // Angular automatically detects signal dependencies.
        afterRenderEffect({
            write: () => {
                const dialog = this.dialog().nativeElement;

                // Shows / Hides the dialog depending on the current state.
                if (this.open() && !dialog.open) dialog.showModal();
                else if (!this.open() && dialog.open) dialog.close();
            },
        });
    }

    confirm() {
        if (!this.busy()) this.confirmed.emit();
    }

    cancel(event?: Event) {
        // Escape must use the parent's state transition and stay blocked while DELETE is pending.
        event?.preventDefault();
        if (!this.busy()) this.cancelled.emit();
    }

    ngOnDestroy() {
        // Also release the native modal when navigating away while it is open.
        const dialog = this.dialog().nativeElement;
        if (dialog.open) dialog.close();
    }
}
