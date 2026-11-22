export type LifecycleStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export const STATUS_LABELS: Record<LifecycleStatus, string> = {
    DRAFT: 'Entwurf',
    ACTIVE: 'Aktiv',
    ARCHIVED: 'Archiviert',
};
