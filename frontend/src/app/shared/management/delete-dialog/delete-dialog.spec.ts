import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeleteDialog } from './delete-dialog';

describe('DeleteDialog', () => {
    let fixture: ComponentFixture<DeleteDialog>;
    let dialog: HTMLDialogElement;

    beforeEach(() => {
        fixture = TestBed.createComponent(DeleteDialog);
        // Set the required inputs before rendering
        fixture.componentRef.setInput('title', 'Eintrag löschen?');
        fixture.componentRef.setInput('description', 'Der Eintrag wird entfernt.');
        fixture.detectChanges();
        dialog = fixture.nativeElement.querySelector('dialog');

        // Override dialog behavior, since jsdom does not support dialog elements
        Object.defineProperties(dialog, {
            showModal: { value: () => dialog.setAttribute('open', ''), configurable: true },
            close: { value: () => dialog.removeAttribute('open'), configurable: true },
        });
    });

    async function render() {
        fixture.detectChanges();
        await fixture.whenStable();
    }

    // Check that inputs update dialog text, errors and visibility
    // Destroying the component closes the dialog
    it('renders supplied text and errors and synchronizes the native opening state', async () => {
        expect(dialog.open).toBe(false);
        fixture.componentRef.setInput('open', true);
        fixture.componentRef.setInput('error', 'Löschen fehlgeschlagen');
        await render();

        expect(dialog.open).toBe(true);
        expect(dialog.querySelector('h2')?.textContent).toBe('Eintrag löschen?');
        expect(dialog.textContent).toContain('Der Eintrag wird entfernt.');
        expect(dialog.querySelector('[role=alert]')?.textContent).toBe('Löschen fehlgeschlagen');

        fixture.componentRef.setInput('open', false);
        await render();
        expect(dialog.open).toBe(false);

        fixture.componentRef.setInput('open', true);
        await render();
        fixture.destroy();
        expect(dialog.open).toBe(false);
    });

    // Check that the dialog emits confirm and cancel events for the parent
    // Busy blocks both buttons and Escape while the dialog stays open
    it('emits confirmation and cancellation and blocks both while busy', async () => {
        const confirmed = vi.fn();
        const cancelled = vi.fn();
        fixture.componentInstance.confirmed.subscribe(confirmed);
        fixture.componentInstance.cancelled.subscribe(cancelled);

        fixture.componentRef.setInput('open', true);
        await render();
        const [cancelButton, confirmButton] = dialog.querySelectorAll('button');

        // Test all possible user interactions
        confirmButton.click();
        cancelButton.click();
        const escape = new Event('cancel', { cancelable: true });
        dialog.dispatchEvent(escape);

        expect(confirmed).toHaveBeenCalledOnce();
        expect(cancelled).toHaveBeenCalledTimes(2);
        expect(escape.defaultPrevented).toBe(true);
        expect(dialog.open).toBe(true);

        // Parent page is busy
        fixture.componentRef.setInput('busy', true);
        await render();

        expect(cancelButton.disabled).toBe(true);
        expect(confirmButton.disabled).toBe(true);

        // Test user interactions while page is busy
        cancelButton.click();
        confirmButton.click();
        const busyEscape = new Event('cancel', { cancelable: true });
        dialog.dispatchEvent(busyEscape);

        expect(busyEscape.defaultPrevented).toBe(true);
        // No new calls since last check
        expect(confirmed).toHaveBeenCalledOnce();
        expect(cancelled).toHaveBeenCalledTimes(2);
        expect(dialog.open).toBe(true);
    });
});
