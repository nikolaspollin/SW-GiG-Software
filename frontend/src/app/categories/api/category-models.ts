import type { LifecycleStatus } from '../../shared/lifecycle-status';

export type EditableCategoryStatus = Exclude<LifecycleStatus, 'ARCHIVED'>;

export interface CategoryRequest {
    displayName: string;
    internalName: string;
    lifecycleStatus: EditableCategoryStatus;
}

export interface CategoryResponse {
    id: string;
    displayName: string;
    internalName: string;
    lifecycleStatus: LifecycleStatus;
}
