import { TestBed } from '@angular/core/testing';
import { MenuEditor } from './menu-editor';
import { MenuResponse } from '../api/menu-models';

// These tests exercise form logic directly. No page or HTTP backend is involved.
describe('MenuEditor', () => {
    // Seconds and a midnight crossing exercise time precision and overnight handling.
    const menu: MenuResponse = {
        id: 'menu-1',
        name: 'Abendkarte',
        lifecycleStatus: 'ACTIVE',
        servingDays: { regularDays: ['FRIDAY'] },
        servingTimeWindow: { startTime: '18:00:30', endTime: '02:00:15' },
    };

    // Initialize the editor through its Angular input and record emitted save payloads.
    function editor(initial: MenuResponse | null = menu) {
        const fixture = TestBed.createComponent(MenuEditor);
        fixture.componentRef.setInput('initial', initial);
        // Render the initial input so linked signals and form bindings are initialized.
        fixture.detectChanges();

        const saved = vi.fn();
        // Spy on saved()
        fixture.componentInstance.saved.subscribe(saved);

        return { fixture, component: fixture.componentInstance, saved };
    }

    // Saving must preserve seconds and accept both overnight and full-day time windows.
    it('preserves seconds and accepts windows across midnight and lasting 24 hours', () => {
        const { component, saved } = editor();
        component.submit(new Event('submit'));

        expect(saved).toHaveBeenLastCalledWith({
            name: 'Abendkarte',
            lifecycleStatus: 'ACTIVE',
            servingDays: { regularDays: ['FRIDAY'] },
            servingTimeWindow: { startTime: '18:00:30', endTime: '02:00:15' },
        });
        expect(component.overnight()).toBe(true);

        // Set end time equal to start time => Equal start and end times represent 24 hours, not an invalid empty window.
        component.values.update((values) => ({ ...values, endTime: values.startTime }));
        component.submit(new Event('submit'));

        expect(saved).toHaveBeenCalledTimes(2);
    });

    // Invalid form data must never emit a save event, regardless of the failing field.
    it('blocks blank names, missing days, invalid dates and invalid times', () => {
        const { component, saved } = editor();

        // Correct each previous problem before exercising the next validation rule.
        component.values.update((values) => ({ ...values, name: '   ' }));
        component.submit(new Event('submit'));
        component.values.update((values) => ({ ...values, name: 'Karte', regularDays: [] }));
        component.submit(new Event('submit'));
        component.values.update((values) => ({ ...values, scheduleType: 'fixed', fixedDates: [] }));
        component.submit(new Event('submit'));
        // A correctly shaped date string still has to represent a real calendar date.
        component.values.update((values) => ({ ...values, fixedDates: ['2026-02-30'] }));
        component.submit(new Event('submit'));
        component.values.update((values) => ({
            ...values,
            fixedDates: ['2026-12-24'],
            startTime: '25:00',
        }));
        component.submit(new Event('submit'));

        expect(saved).not.toHaveBeenCalled();
    });

    // Save must include an unadded date, trim the name and emit only the selected schedule type.
    it('includes a pending date on Save and sends only the chosen serving-days subtype', () => {
        const { component, saved } = editor();
        component.values.update((values) => ({
            ...values,
            name: ' Festtagskarte ',
            scheduleType: 'fixed',
        }));

        // Submit directly without clicking Add; the pending input must not be lost.
        component.dateInput.set('2026-12-24');
        component.submit(new Event('submit'));

        // Existing weekdays must not leak into the fixed-date payload used by the API.
        expect(saved).toHaveBeenCalledWith({
            name: 'Festtagskarte',
            lifecycleStatus: 'ACTIVE',
            servingDays: { fixedDates: ['2026-12-24'] },
            servingTimeWindow: menu.servingTimeWindow,
        });

        // Reject the same date a second time without duplicating the selected entry.
        component.dateInput.set('2026-12-24');
        component.addDate();

        expect(component.dateError()).toContain('bereits');
        expect(component.values().fixedDates).toEqual(['2026-12-24']);

        // Removing a selected date must update the form model as well.
        component.removeDate('2026-12-24');
        expect(component.values().fixedDates).toEqual([]);
    });

    // Switching menus must reset transient state; busy or archived editors must not emit saves.
    it('resets pending dates when selecting another menu and rejects busy or archived submissions', () => {
        const { fixture, component, saved } = editor();

        component.dateInput.set('2026-12-24');
        component.dateError.set('Alter Fehler');
        component.attempted.set(true);

        // Changing initial on the same instance must rebuild the linked form and UI signals.
        fixture.componentRef.setInput('initial', { ...menu, id: 'menu-2', name: 'Mittagskarte' });
        fixture.detectChanges();

        expect(component.values().name).toBe('Mittagskarte');
        expect(component.dateInput()).toBe('');
        expect(component.dateError()).toBe('');
        expect(component.attempted()).toBe(false);

        // Block another submission while an operation is already running.
        fixture.componentRef.setInput('busy', true);
        component.submit(new Event('submit'));

        // Clearing busy must not bypass the separate protection for archived menus.
        fixture.componentRef.setInput('busy', false);
        fixture.componentRef.setInput('initial', { ...menu, lifecycleStatus: 'ARCHIVED' });
        component.submit(new Event('submit'));

        expect(saved).not.toHaveBeenCalled();
    });
});
