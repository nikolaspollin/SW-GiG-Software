export type LifecycleStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type EditableMenuStatus = Exclude<LifecycleStatus, 'ARCHIVED'>;

export const WEEKDAYS = [
    { value: 'MONDAY', label: 'Montag' },
    { value: 'TUESDAY', label: 'Dienstag' },
    { value: 'WEDNESDAY', label: 'Mittwoch' },
    { value: 'THURSDAY', label: 'Donnerstag' },
    { value: 'FRIDAY', label: 'Freitag' },
    { value: 'SATURDAY', label: 'Samstag' },
    { value: 'SUNDAY', label: 'Sonntag' },
] as const;

export type Weekday = (typeof WEEKDAYS)[number]['value'];

// Jackson deduces the subtype from the field name. Send exactly one variant.
export type ServingDays =
    { regularDays: Weekday[]; fixedDates?: never } | { fixedDates: string[]; regularDays?: never };

export interface ServingTimeWindow {
    startTime: string;
    endTime: string;
}

export interface MenuRequest {
    name: string;
    lifecycleStatus: EditableMenuStatus;
    servingDays: ServingDays;
    servingTimeWindow: ServingTimeWindow;
}

export interface MenuResponse {
    id: string;
    name: string;
    lifecycleStatus: LifecycleStatus;
    servingDays: ServingDays;
    servingTimeWindow: ServingTimeWindow;
}

export const STATUS_LABELS: Record<LifecycleStatus, string> = {
    DRAFT: 'Entwurf',
    ACTIVE: 'Aktiv',
    ARCHIVED: 'Archiviert',
};

export function formatDate(date: string): string {
    return date.split('-').reverse().join('.');
}

export function formatServingDays(days: ServingDays): string {
    return days.regularDays
        ? WEEKDAYS.filter((day) => days.regularDays.includes(day.value))
              .map((day) => day.label)
              .join(', ')
        : [...days.fixedDates].sort().map(formatDate).join(', ');
}

export function isValidDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/.test(value);
}

function timeInSeconds(value: string): number {
    const [hours, minutes, seconds = '0'] = value.split(':');
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

export function endsNextDay(window: ServingTimeWindow): boolean {
    return timeInSeconds(window.endTime) <= timeInSeconds(window.startTime);
}

export function formatTime(value: string): string {
    return /^\d{2}:\d{2}:00(?:\.0+)?$/.test(value) ? value.slice(0, 5) : value;
}
