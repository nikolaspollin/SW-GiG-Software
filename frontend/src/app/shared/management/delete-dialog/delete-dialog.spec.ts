import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeleteDialog } from './delete-dialog';

//TODO need to be reviewed

describe('DeleteDialog', () => {
    let fixture: ComponentFixture<DeleteDialog>;
    let dialog: HTMLDialogElement;

    beforeEach(() => {
        fixture = TestBed.createComponent(DeleteDialog);
        fixture.componentRef.setInput('title', 'Eintrag löschen?');
        fixture.componentRef.setInput('description', 'Der Eintrag wird entfernt.');
        fixture.detectChanges();
        dialog = fixture.nativeElement.querySelector('dialog');

        // jsdom cannot open native modals; browser tests cover actual focus and modality.
        Object.defineProperties(dialog, {
            showModal: { value: () => dialog.setAttribute('open', ''), configurable: true },
            close: { value: () => dialog.removeAttribute('open'), configurable: true },
        });
    });

    async function render() {
        fixture.detectChanges();
        await fixture.whenStable();
    }

    // Inputs control visibility and content; destruction must release an open native dialog too.
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

    // Outputs request a parent state change; busy blocks buttons and Escape without closing locally.
    it('emits confirmation and cancellation and blocks both while busy', async () => {
        const confirmed = vi.fn();
        const cancelled = vi.fn();
        fixture.componentInstance.confirmed.subscribe(confirmed);
        fixture.componentInstance.cancelled.subscribe(cancelled);
        fixture.componentRef.setInput('open', true);
        await render();
        const [cancelButton, confirmButton] = dialog.querySelectorAll('button');

        confirmButton.click();
        cancelButton.click();
        const escape = new Event('cancel', { cancelable: true });
        dialog.dispatchEvent(escape);
        expect(confirmed).toHaveBeenCalledOnce();
        expect(cancelled).toHaveBeenCalledTimes(2);
        expect(escape.defaultPrevented).toBe(true);
        expect(dialog.open).toBe(true);

        fixture.componentRef.setInput('busy', true);
        await render();
        expect(cancelButton.disabled).toBe(true);
        expect(confirmButton.disabled).toBe(true);
        cancelButton.click();
        confirmButton.click();
        const busyEscape = new Event('cancel', { cancelable: true });
        dialog.dispatchEvent(busyEscape);
        expect(busyEscape.defaultPrevented).toBe(true);
        expect(confirmed).toHaveBeenCalledOnce();
        expect(cancelled).toHaveBeenCalledTimes(2);
        expect(dialog.open).toBe(true);
    });
});
