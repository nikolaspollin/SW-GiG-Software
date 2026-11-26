import { Component, inject, InjectionToken } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { finalize, firstValueFrom, of, Subject } from 'rxjs';
import { CrudApi } from './crud-api';
import { ManagementPage } from './management-page';

interface TestEntity {
    id: string;
    label: string;
    editable: boolean;
}

interface TestRequest {
    label: string;
}

type TestApi = CrudApi<TestEntity, TestRequest>;
const TEST_API = new InjectionToken<TestApi>('Management test API');
const entity: TestEntity = { id: 'item-1', label: 'First item', editable: true };

// Component Annotation required for correct test setup
// Template supplies necessarily ui for the tests
@Component({
    template: '<button type="button" (click)="create($event)">New item</button>',
})

class TestManagementPage extends ManagementPage<TestEntity, TestRequest> {
    protected override readonly api = inject(TEST_API);
    protected override readonly loadError = 'Load failed';
    protected override readonly editLoadError = 'Edit failed';
    protected override readonly editBlockedError = 'Editing blocked';
    protected override readonly saveFailedError = 'Save failed';
    protected override readonly deleteFailedError = 'Delete failed';

    override readonly focusHeading = vi.fn<() => void>();
    override readonly afterEditLoaded = vi.fn<(entity: TestEntity) => void | Promise<void>>();

    protected override errorMessage(error: unknown, fallback: string): string {
        return error instanceof Error ? error.message : fallback;
    }

    protected override canEdit(item: TestEntity): boolean {
        return item.editable;
    }

    protected override applyDeletion(item: TestEntity): void {
        // Deliberately remove the item: the base class must not assume that DELETE means archive.
        this.items.update((items) => items!.filter((current) => current.id !== item.id));
    }

    protected override saveSuccessMessage(item: TestEntity): string {
        return `Saved ${item.label}`;
    }

    protected override deleteSuccessMessage(item: TestEntity): string {
        return `Deleted ${item.label}`;
    }
}

function mockApi() {
    return {
        list: vi.fn<TestApi['list']>().mockReturnValue(of([entity])),
        get: vi.fn<TestApi['get']>().mockReturnValue(of(entity)),
        create: vi.fn<TestApi['create']>(),
        update: vi.fn<TestApi['update']>(),
        delete: vi.fn<TestApi['delete']>(),
    };
}

describe('ManagementPage', () => {
    let api: ReturnType<typeof mockApi>;
    let fixture: ComponentFixture<TestManagementPage>;
    let page: TestManagementPage;
    let createButton: HTMLButtonElement;

    beforeEach(() => {
        api = mockApi();
        TestBed.configureTestingModule({
            imports: [TestManagementPage],
            // Registers Mock API for Angular Test Injection
            providers: [{ provide: TEST_API, useValue: api }],
        });
        fixture = TestBed.createComponent(TestManagementPage);
        page = fixture.componentInstance;
    });

    // Run ngOnInit through Angular, and let async state changes and focus callbacks finish.
    async function start() {
        fixture.detectChanges();
        createButton = fixture.nativeElement.querySelector('button');
        await settle();
    }

    async function settle() {
        await vi.waitFor(() => expect(page.busy()).toBe(false));

        fixture.detectChanges();
        await fixture.whenStable();
    }

    // Editor needs to be blocked while page is loading
    // A failed load stays distinct from an empty list.
    it('tracks loading, reports failures and allows retrying with an empty result', async () => {
        // Uses observable in order to simulate async loading
        const response = new Subject<TestEntity[]>();
        api.list.mockReturnValue(response);
        // Triggers ngOnInit() -> reload() -> api.list()
        fixture.detectChanges();


        expect(page.loading()).toBe(true);
        expect(page.busy()).toBe(true);
        // Try to open editor while page is still loading
        fixture.nativeElement.querySelector('button').click();
        await page.reload();
        expect(page.editor()).toBeNull();
        // No duplicate api request
        expect(api.list).toHaveBeenCalledTimes(1);

        // Complete open list request -> Check failed api call
        response.error({});
        await settle();
        expect(page.items()).toBeNull();
        expect(page.error()).toBe('Load failed');
        expect(page.loading()).toBe(false);

        // Happy path
        api.list.mockReturnValue(of([]));
        await page.reload();
        expect(page.items()).toEqual([]);
        expect(page.error()).toBe('');
    });

    // Creation uses POST data, closes the editor on success and delegates the success text.
    it('opens and cancels creation, then saves a new item from the server response', async () => {
        // Open editor
        await start();
        createButton.click();
        expect(page.editor()).toEqual({ entity: null });

        // Close editor
        page.cancelEditor();
        await fixture.whenStable();
        expect(page.editor()).toBeNull();
        expect(document.activeElement).toBe(createButton);

        // Create path
        const created = { ...entity, id: 'created', label: 'Server name' };
        api.create.mockReturnValue(of(created));
        createButton.click();
        await page.save({ label: 'New item' });
        await settle();

        expect(api.create).toHaveBeenCalledWith({ label: 'New item' });
        expect(page.items()).toEqual([entity, created]);
        expect(page.editor()).toBeNull();
        expect(page.message()).toBe('Saved Server name');
        expect(page.focusHeading).toHaveBeenCalledOnce();
    });

    // Existing items are fetched again, updated by ID and replaced without duplicating the list entry.
    it('edits fresh details and replaces the existing item after an update', async () => {
        await start();

        // Test refetching item when trying to edit it
        const fresh = { ...entity, label: 'Fresh name' };
        api.get.mockReturnValue(of(fresh));
        await page.edit(entity, new Event('click'));

        expect(api.get).toHaveBeenCalledWith(entity.id);
        expect(page.editor()).toEqual({ entity: fresh });
        expect(page.afterEditLoaded).toHaveBeenCalledWith(fresh);
        expect(page.items()).toEqual([fresh]);

        // Test updating item when trying to save it
        const updated = { ...fresh, label: 'Updated name' };
        api.update.mockReturnValue(of(updated));
        await page.save({ label: 'Updated name' });

        expect(api.update).toHaveBeenCalledWith(entity.id, { label: 'Updated name' });
        expect(api.create).not.toHaveBeenCalled();
        expect(page.items()).toEqual([updated]);
        expect(page.message()).toBe('Saved Updated name');
    });

    // Checks that editor and delete dialog are blocked for uneditable items
    it('blocks read-only actions and detects items that became read-only on the server', async () => {
        await start();

        // Try to edit an uneditable item
        const blocked = { ...entity, editable: false };
        await page.edit(blocked, new Event('click'));
        page.requestDelete(blocked);

        // Neither editor nor delete dialog doesn't respond to uneditable items
        expect(page.editor()).toBeNull();
        expect(api.get).not.toHaveBeenCalled();
        expect(page.pendingDelete()).toBeNull();

        // Item has been set uneditable server side
        api.get.mockReturnValue(of(blocked));
        await page.edit(entity, new Event('click'));
        expect(page.items()).toEqual([blocked]);
        expect(page.editor()).toBeNull();
        expect(page.error()).toBe('Editing blocked');
        expect(page.afterEditLoaded).not.toHaveBeenCalled();
    });

    // A pending save blocks competing actions
    // Failure keeps the editor available for retry.
    it('keeps the editor after a save error and clears that error after a successful retry', async () => {
        await start();

        await page.edit(entity, new Event('click'));
        const editor = page.editor();

        // Start update request asynchronously and keep response open
        const response = new Subject<TestEntity>();
        api.update.mockReturnValue(response);
        const saving = page.save({ label: 'Changed' });
        expect(page.busy()).toBe(true);

        // Trigger cancel path while update is still in progress
        page.cancelEditor();
        await page.save({ label: 'Duplicate' });
        await page.reload();
        expect(page.editor()).toBe(editor);
        // Check that api calls aren't duplicated while page is busy
        expect(api.update).toHaveBeenCalledTimes(1);
        expect(api.list).toHaveBeenCalledTimes(1);

        // Resolve update request from beginning with conflict error
        response.error(new Error('Conflict'));
        await saving;
        expect(page.busy()).toBe(false);
        expect(page.error()).toBe('Conflict');
        expect(page.message()).toBe('');
        // Editor stays open if api call fails
        expect(page.editor()).toBe(editor);
        expect(page.items()).toEqual([entity]);

        // Happy path
        api.update.mockReturnValue(of({ ...entity, label: 'Changed' }));
        await page.save({ label: 'Changed' });
        expect(page.error()).toBe('');
        expect(page.editor()).toBeNull();
        expect(page.message()).toBe('Saved Changed');
    });

    // Check that confirmation sends DELETE, errors stay in the dialog and the item is removed locally only on success
    it('cancels deletion, retains failures for retry and finishes with the concrete success message', async () => {
        await start();
        await page.edit(entity, new Event('click'));

        page.requestDelete(entity);
        expect(page.pendingDelete()).toBe(entity);
        expect(api.delete).not.toHaveBeenCalled();

        page.cancelDelete();
        expect(page.pendingDelete()).toBeNull();

        page.requestDelete(entity);
        const response = new Subject<void>();
        api.delete.mockReturnValue(response);
        // Called asynchronously, in order to test parallel cancellation
        const deleting = page.confirmDelete();
        // Conflicting parallel calls
        page.cancelDelete();
        await page.confirmDelete();
        // API delete call hasn't been resolved yet
        expect(api.delete).toHaveBeenCalledExactlyOnceWith(entity.id);
        expect(page.pendingDelete()).toBe(entity);

        // API delete error path
        response.error({});
        await deleting;
        expect(page.deleteError()).toBe('Delete failed');
        expect(page.error()).toBe('');
        expect(page.pendingDelete()).toBe(entity);
        // Frontend model state hasn't changed
        expect(page.items()).toEqual([entity]);
        expect(page.editor()?.entity).toEqual(entity);

        // Happy path
        api.delete.mockReturnValue(of(undefined));
        await page.confirmDelete();
        await settle();
        expect(page.items()).toEqual([]);
        expect(page.editor()).toBeNull();
        expect(page.pendingDelete()).toBeNull();
        expect(page.deleteError()).toBe('');
        expect(page.message()).toBe('Deleted First item');
        expect(page.focusHeading).toHaveBeenCalledOnce();
    });

    // Optional async extension work is awaited and uses the same error handling as the API request.
    it('stays busy until an edit extension finishes and handles its rejection', async () => {
        await start();

        const extension = new Subject<void>();
        page.afterEditLoaded.mockReturnValue(firstValueFrom(extension));

        const editing = page.edit(entity, new Event('click'));
        await vi.waitFor(() => expect(page.afterEditLoaded).toHaveBeenCalledWith(entity));

        expect(page.busy()).toBe(true);

        extension.error(new Error('Additional details failed'));
        await editing;

        expect(page.busy()).toBe(false);
        expect(page.error()).toBe('Additional details failed');
    });
});
