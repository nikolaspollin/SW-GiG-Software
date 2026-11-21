import {
    afterRenderEffect,
    Component,
    computed,
    ElementRef,
    input,
    linkedSignal,
    output,
    viewChild,
} from '@angular/core';
import { form, FormField, required, validate } from '@angular/forms/signals';
import {
    EditableMenuStatus,
    endsNextDay,
    formatDate,
    isValidDate,
    isValidTime,
    MenuRequest,
    MenuResponse,
    Weekday,
    WEEKDAYS,
} from '../api/menu-models';

interface MenuFormValues {
    name: string;
    lifecycleStatus: EditableMenuStatus;
    scheduleType: 'regular' | 'fixed';
    regularDays: Weekday[];
    fixedDates: string[];
    startTime: string;
    endTime: string;
}

/** Edits menu metadata and its schedule; persistence belongs to the parent page. */
@Component({
    selector: 'app-menu-editor',
    imports: [FormField],
    templateUrl: './menu-editor.html',
    styleUrl: './menu-editor.css',
})
export class MenuEditor {
    readonly initial = input<MenuResponse | null>(null);
    readonly busy = input(false);
    readonly serverError = input('');
    readonly saved = output<MenuRequest>();
    readonly cancelled = output<void>();

    readonly weekdays = WEEKDAYS;
    readonly formatDate = formatDate;
    private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
    readonly attempted = linkedSignal({ source: this.initial, computation: () => false });
    readonly dateInput = linkedSignal({ source: this.initial, computation: () => '' });
    readonly dateError = linkedSignal({ source: this.initial, computation: () => '' });

    // Data storage (is rebuilt through linkage to initial signal)
    // Updated through functions in this class
    readonly values = linkedSignal<MenuFormValues>(() => {
        // Angular auto-detects which signals are used and links the values signal to them
        const menu = this.initial();
        const days = menu?.servingDays;
        return {
            name: menu?.name ?? '',
            lifecycleStatus: menu?.lifecycleStatus === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
            scheduleType: days?.fixedDates ? 'fixed' : 'regular',
            regularDays: [...(days?.regularDays ?? [])],
            fixedDates: [...(days?.fixedDates ?? [])].sort(),
            startTime: menu?.servingTimeWindow.startTime ?? '',
            endTime: menu?.servingTimeWindow.endTime ?? '',
        };
    });

    // Registers form state and validation functionality
    // Registers validation rules, which are automatically applied to the form fields
    // Path provides access to the data model
    readonly fields = form(this.values, (path) => {
        required(path.name);
        validate(path.name, ({ value }) => (value().trim() ? null : { kind: 'blank' }));
        validate(path.lifecycleStatus, ({ value }) =>
            ['DRAFT', 'ACTIVE'].includes(value()) ? null : { kind: 'status' },
        );
        validate(path.regularDays, ({ value, valueOf }) =>
            valueOf(path.scheduleType) !== 'regular' || value().length > 0
                ? null
                : { kind: 'days' },
        );
        validate(path.fixedDates, ({ value, valueOf }) =>
            valueOf(path.scheduleType) !== 'fixed' ||
            (value().length > 0 && value().every(isValidDate))
                ? null
                : { kind: 'dates' },
        );
        validate(path.startTime, ({ value }) => (isValidTime(value()) ? null : { kind: 'time' }));
        validate(path.endTime, ({ value }) => (isValidTime(value()) ? null : { kind: 'time' }));
    });

    readonly overnight = computed(() => {
        const values = this.values();
        return isValidTime(values.startTime) && isValidTime(values.endTime) && endsNextDay(values);
    });

    constructor() {
        afterRenderEffect(() => {
            this.initial();
            this.heading().nativeElement.focus();
        });
    }

    // Model updater functions

    toggleDay(day: Weekday, event: Event) {
        const checked = (event.target as HTMLInputElement).checked;

        this.values.update((values) => ({
            ...values,
            regularDays: checked
                ? [...values.regularDays, day]
                : values.regularDays.filter((value) => value !== day),
        }));
    }

    setDate(event: Event) {
        this.dateInput.set((event.target as HTMLInputElement).value);
        this.dateError.set('');
    }

    addDate() {
        const date = this.dateInput();
        if (!isValidDate(date)) {
            this.dateError.set('Bitte wähle ein gültiges Datum aus.');
            return;
        }
        if (this.values().fixedDates.includes(date)) {
            this.dateError.set('Dieses Datum ist bereits ausgewählt.');
            return;
        }
        this.values.update((values) => ({
            ...values,
            fixedDates: [...values.fixedDates, date].sort(),
        }));
        this.dateInput.set('');
        this.dateError.set('');
    }

    removeDate(date: string) {
        this.values.update((values) => ({
            ...values,
            fixedDates: values.fixedDates.filter((value) => value !== date),
        }));
    }

    submit(event: Event) {
        event.preventDefault();
        this.attempted.set(true);

        if (this.busy() || this.initial()?.lifecycleStatus === 'ARCHIVED') return;

        // Include a valid pending date instead of silently dropping it on Save.
        if (this.values().scheduleType === 'fixed' && this.dateInput()) {
            this.addDate();
            if (this.dateError()) return;
        }

        if (this.fields().invalid()) return;

        const values = this.values();
        this.saved.emit({
            name: values.name.trim(),
            lifecycleStatus: values.lifecycleStatus,
            servingDays:
                values.scheduleType === 'regular'
                    ? { regularDays: [...values.regularDays] }
                    : { fixedDates: [...values.fixedDates] },
            servingTimeWindow: { startTime: values.startTime, endTime: values.endTime },
        });
    }
}
