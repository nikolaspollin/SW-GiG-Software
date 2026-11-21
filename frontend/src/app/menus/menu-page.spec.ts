import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuResponse } from './api/menu-models';
import { MenuPage } from './menu-page';

// Unsorted weekdays, seconds and a midnight crossing exercise schedule display and editing.
const menu: MenuResponse = {
    id: 'menu-1',
    name: 'Abendkarte',
    lifecycleStatus: 'ACTIVE',
    servingDays: { regularDays: ['FRIDAY', 'MONDAY'] },
    servingTimeWindow: { startTime: '18:00:30', endTime: '02:00:00' },
};

// Render the real page and editor together, replacing only the HTTP backend with test responses.
describe('MenuPage HTTP and component integration', () => {
    let http: HttpTestingController;
    let fixture: ComponentFixture<MenuPage>;
    let root: HTMLElement;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [MenuPage],
            // The testing provider replaces HttpClient's backend, so no real server is contacted.
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });

        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(MenuPage);
        root = fixture.nativeElement as HTMLElement;

        // Initial change detection runs ngOnInit and starts the GET request handled by load().
        fixture.detectChanges();

        // Emulate dialog visibility in jsdom; real modal focus and Escape are covered by browser tests.
        const dialog = root.querySelector('dialog')!;

        Object.defineProperties(dialog, {
            showModal: { value: () => dialog.setAttribute('open', ''), configurable: true },
            close: { value: () => dialog.removeAttribute('open'), configurable: true },
        });
    });

    // Detect unexpected HTTP requests that were not matched by the test.
    afterEach(() => http.verify());

    // Wait for the page's async response handling before checking the updated DOM.
    async function settle() {
        await vi.waitFor(() => expect(fixture.componentInstance.busy()).toBe(false));
        fixture.detectChanges();
        await fixture.whenStable();
    }

    // Answer the initial list request and ensure management does not send a guest token.
    async function load(menus: MenuResponse[] = [menu]) {
        const request = http.expectOne('/api/menus');
        request.flush(menus);
        await settle();
    }

    // Find a button on the page by its label.
    // Restrict the search to a dialog when its buttons share labels with the rest of the page.
    function button(label: string, scope: ParentNode = root): HTMLButtonElement {
        const found = [...scope.querySelectorAll('button')].find(
            (item) => item.textContent?.trim() === label,
        );

        if (!found) throw new Error(`Missing button: ${label}`);

        return found;
    }

    // Setting .value alone does not notify Signal Forms; dispatch the corresponding DOM events.
    function setValue(selector: string, value: string, event = 'input') {
        const input = root.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;

        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        if (event !== 'input') input.dispatchEvent(new Event(event, { bubbles: true }));

        fixture.detectChanges();
    }

    // Editing fetches current details instead of relying only on the previously loaded list entry.
    async function openEditor() {
        button('Bearbeiten').click();
        http.expectOne('/api/menus/menu-1').flush(menu);
        await settle();
    }

    // Display schedules in a readable order and omit modification actions for archived menus.
    it('shows both schedule types, overnight windows and read-only archived menus', async () => {
        await load([
            menu,
            {
                ...menu,
                id: 'archived',
                name: 'Weihnachtskarte',
                lifecycleStatus: 'ARCHIVED',
                servingDays: { fixedDates: ['2026-12-25', '2026-12-24'] },
            },
        ]);

        expect(root.textContent).toContain('Montag, Freitag');
        expect(root.textContent).toContain('24.12.2026, 25.12.2026');
        expect(root.textContent).toContain('bis zum Folgetag');

        const archived = [...root.querySelectorAll('article')].find((item) =>
            item.textContent?.includes('Weihnachtskarte'),
        )!;
        expect(archived.textContent).toContain('Archiviert');
        expect(archived.querySelector('button')).toBeNull();
    });

    // Map real form input to the API contract, then show the saved menu and close the editor.
    it('creates a weekly draft from form inputs without sending UI-only fields', async () => {
        await load([]);
        expect(root.textContent).toContain('Noch keine Menüs vorhanden');

        // Trigger displaying the editor.
        button('Neues Menü').click();
        fixture.detectChanges();

        setValue('#menu-name', ' Mittagskarte ');
        setValue('#start-time', '11:30');
        setValue('#end-time', '14:00');

        // Select weekday
        root.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
        fixture.detectChanges();
        // Save menu
        button('Menü speichern').click();

        const request = http.expectOne('/api/menus');

        // Check valid API Call
        expect(request.request.method).toBe('POST');
        // The payload must trim the name and exclude form-only state such as scheduleType.
        expect(request.request.body).toEqual({
            name: 'Mittagskarte',
            lifecycleStatus: 'DRAFT',
            servingDays: { regularDays: ['MONDAY'] },
            servingTimeWindow: { startTime: '11:30', endTime: '14:00' },
        });

        request.flush({ ...request.request.body, id: 'created' });
        await settle();

        // Check result on the page
        expect(root.querySelector('app-menu-editor')).toBeNull();
        expect(root.querySelector('[role=status]')?.textContent).toContain('gespeichert');
        expect(root.querySelector('article')?.textContent).toContain('Mittagskarte');
    });

    // Switching schedule types must replace regularDays with fixedDates without losing time seconds.
    it('loads fresh details, changes weekdays to fixed dates and preserves time precision', async () => {
        await load();
        await openEditor();

        expect(root.querySelector<HTMLInputElement>('#start-time')?.value).toBe('18:00:30');

        // Switch schedule type to fixed dates.
        setValue('#schedule-type', 'fixed', 'change');
        setValue('#serving-date', '2026-12-24');
        button('Datum hinzufügen').click();

        fixture.detectChanges();
        button('Menü speichern').click();

        // API change request
        const request = http.expectOne('/api/menus/menu-1');

        expect(request.request.method).toBe('PUT');
        expect(request.request.body.servingDays).toEqual({ fixedDates: ['2026-12-24'] });
        expect(request.request.body.servingTimeWindow).toEqual(menu.servingTimeWindow);

        request.flush({ ...request.request.body, id: menu.id });
        await settle();

        expect(root.querySelector('article')?.textContent).toContain('24.12.2026');
    });

    // A server-side conflict must preserve edits so the user can retry as a draft without reopening.
    it('keeps form inputs after an overlap conflict and allows a retry as a draft', async () => {
        await load();
        await openEditor();

        setValue('#menu-name', 'Meine Abendkarte');
        button('Menü speichern').click();

        // Mock backend menu overlap request.
        http.expectOne('/api/menus/menu-1').flush(
            { detail: 'Menu serving time window overlaps an existing menu' },
            { status: 409, statusText: 'Conflict' },
        );

        await settle();

        expect(root.querySelector<HTMLInputElement>('#menu-name')?.value).toBe('Meine Abendkarte');
        expect(root.querySelector('[role=alert]')?.textContent).toContain('überschneidet');

        setValue('#menu-status', 'DRAFT', 'change');
        button('Menü speichern').click();

        const retry = http.expectOne('/api/menus/menu-1');

        expect(retry.request.body.lifecycleStatus).toBe('DRAFT');

        retry.flush({ ...retry.request.body, id: menu.id });
        await settle();

        expect(root.querySelector('article')?.textContent).toContain('Entwurf');
    });

    // DELETE archives rather than removes the menu; cancelling the confirmation must send no request.
    it('requires delete confirmation and retains the archived menu after a 204 response', async () => {
        await load();

        button('Löschen').click();
        fixture.detectChanges();

        const dialog = root.querySelector('dialog')!;
        expect(dialog.open).toBe(true);

        button('Abbrechen', dialog).click();

        http.expectNone((request) => request.method === 'DELETE');

        button('Löschen').click();
        fixture.detectChanges();
        button('Menü löschen', dialog).click();

        const request = http.expectOne('/api/menus/menu-1');
        expect(request.request.method).toBe('DELETE');

        // Simulate Escape while DELETE is pending: the dialog must stay open until the request finishes.
        const cancel = new Event('cancel', { cancelable: true });
        dialog.dispatchEvent(cancel);

        expect(cancel.defaultPrevented).toBe(true);
        expect(dialog.open).toBe(true);

        // A successful DELETE has no body; the page must update the local status without response data.
        request.flush(null, { status: 204, statusText: 'No Content' });
        await settle();

        expect(dialog.open).toBe(false);
        expect(root.querySelector('article')?.textContent).toContain('Archiviert');
        expect(root.querySelector('article button')).toBeNull();
    });

    // Report a failed deletion inside the open dialog and leave the menu's local status unchanged.
    it('keeps failed deletion in the dialog and does not archive the local menu', async () => {
        await load();

        button('Löschen').click();
        fixture.detectChanges();
        button('Menü löschen').click();

        http.expectOne('/api/menus/menu-1').flush({}, { status: 500, statusText: 'Server Error' });
        await settle();

        expect(root.querySelector('dialog')?.open).toBe(true);
        expect(root.querySelector('dialog [role=alert]')?.textContent).toContain('nicht gelöscht');
        expect(fixture.componentInstance.menus()?.[0]?.lifecycleStatus).toBe('ACTIVE');
    });

    // A load failure must not appear as an empty database; a successful retry clears the error.
    it('distinguishes a failed initial load from an empty list and supports retry', async () => {
        http.expectOne('/api/menus').flush({}, { status: 500, statusText: 'Server Error' });
        await settle();

        expect(root.textContent).not.toContain('Noch keine Menüs vorhanden');
        expect(root.querySelector('[role=alert]')?.textContent).toContain('nicht geladen');

        button('Aktualisieren').click();

        http.expectOne('/api/menus').flush([]);
        await settle();

        expect(root.querySelector('[role=alert]')).toBeNull();
        expect(root.textContent).toContain('Noch keine Menüs vorhanden');
    });

    // Leaving the page before the response arrives must unsubscribe from the pending HTTP request.
    it('cancels a pending request when the page is destroyed', () => {
        const request = http.expectOne('/api/menus');
        fixture.destroy();

        expect(request.cancelled).toBe(true);
    });
});

