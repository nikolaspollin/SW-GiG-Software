import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

async function openNewMenu(page: Page, name: string) {
    await page.getByRole('button', { name: 'Neues Menü', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
}

async function setWeeklySchedule(page: Page, day: string, start: string, end: string) {
    await page.getByLabel(day, { exact: true }).check();
    await page.getByLabel('Beginn', { exact: true }).fill(start);
    await page.getByLabel('Ende', { exact: true }).fill(end);
}

test('manager creates, edits, reloads and archives a menu against the real API', async ({ page,
}) => {
    await page.goto('/');

    // Navigate to admin menu page
    await expect(page).toHaveURL(/\/admin\/menus$/);
    await expect(page.getByText('Noch keine Menüs vorhanden')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Fill out new menu form
    await openNewMenu(page, 'Abendkarte');
    await setWeeklySchedule(page, 'Freitag', '18:00', '02:00');
    await expect(
        page.getByText('Das Zeitfenster endet am Folgetag.', { exact: false }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Create new menu
    await page.getByRole('button', { name: 'Menü speichern', exact: true }).click();

    // Validate main entries
    let card = page.getByRole('article').filter({ hasText: 'Abendkarte' });
    await expect(card.getByText('Entwurf', { exact: true })).toBeVisible();
    await expect(card).toContainText('Freitag');

    // Edit menu and adjust form
    await card.getByRole('button', { name: 'Menü Abendkarte bearbeiten', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Festtagskarte');
    await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
    await page.getByLabel('Wiederholung', { exact: true }).selectOption('fixed');
    await page.getByLabel('Datum', { exact: true }).fill('2026-12-24');
    await page.getByRole('button', { name: 'Datum hinzufügen', exact: true }).click();
    await page.getByLabel('Datum', { exact: true }).fill('2026-12-25');

    // Listen for correct API request
    const update = page.waitForRequest(
        (request) => request.method() === 'PUT' && request.url().includes('/api/menus/'),
    );
    // Send update request
    await page.getByRole('button', { name: 'Menü speichern', exact: true }).click();

    // Request must contain added date as well as date in the input field
    expect((await update).postDataJSON().servingDays).toEqual({
        fixedDates: ['2026-12-24', '2026-12-25'],
    });

    // Find menu and validate values
    card = page.getByRole('article').filter({ hasText: 'Festtagskarte' });
    await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
    await expect(card).toContainText('24.12.2026, 25.12.2026');

    await page.reload();
    await expect(card).toContainText('24.12.2026, 25.12.2026');

    // Delete menu
    const deleteButton = card.getByRole('button', {
        name: 'Menü Festtagskarte löschen',
        exact: true,
    });
    await deleteButton.click();

    // Check delete dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(deleteButton).toBeFocused();
    await deleteButton.click();

    // Actually send delete request
    await dialog.getByRole('button', { name: 'Menü löschen', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(card.getByText('Archiviert', { exact: true })).toBeVisible();
    await expect(card.getByRole('button')).toHaveCount(0);

    await page.reload();
    await expect(card.getByText('Archiviert', { exact: true })).toBeVisible();
});

test('overlapping active menus report a conflict and retain the form for saving a draft', async ({
    page,
}) => {
    await page.goto('/admin/menus');
    await expect(page.getByRole('button', { name: 'Neues Menü' })).toBeEnabled();

    // Create menu
    await openNewMenu(page, 'Frühstückskarte');

    // Fill out menu form
    await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
    await setWeeklySchedule(page, 'Dienstag', '08:00', '12:00');
    await page.getByRole('button', { name: 'Menü speichern', exact: true }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Frühstückskarte' })).toBeVisible();

    // Create overlapping menu
    await openNewMenu(page, 'Brunchkarte');
    await page.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
    await setWeeklySchedule(page, 'Dienstag', '09:00', '11:00');
    await page.getByRole('button', { name: 'Menü speichern', exact: true }).click();

    // Expect overlapping menu error
    await expect(page.getByRole('alert')).toContainText('überschneidet');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Brunchkarte');
    await expect(page.getByLabel('Dienstag', { exact: true })).toBeChecked();

    // Store as draft instead
    await page.getByLabel('Status', { exact: true }).selectOption('DRAFT');
    await page.getByRole('button', { name: 'Menü speichern', exact: true }).click();

    await expect(page.getByRole('article').filter({ hasText: 'Brunchkarte' })).toContainText('Entwurf',);
});

test('mobile form validates required fields, supports 24-hour windows and restores focus', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/menus');
    await expect(page.getByRole('button', { name: 'Neues Menü' })).toBeEnabled();

    // Try to create empty menu
    await openNewMenu(page, 'Sonntagskarte');
    await page.getByRole('button', { name: 'Menü speichern', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('vervollständige');

    // Add missing information => trigger 24 h menu window
    await setWeeklySchedule(page, 'Sonntag', '08:00', '08:00');
    await expect(
        page.getByText('Gleiche Uhrzeiten bedeuten 24 Stunden.', { exact: false }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    // Cancel creation of menu
    await page.locator('app-menu-editor').getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('button', { name: 'Neues Menü' })).toBeFocused();

    // Create correct menu with 24 h window
    await openNewMenu(page, 'Sonntagskarte');
    await setWeeklySchedule(page, 'Sonntag', '08:00', '08:00');
    await page.getByRole('button', { name: 'Menü speichern', exact: true }).click();
    await expect(page.getByRole('article').filter({ hasText: 'Sonntagskarte' })).toContainText(
        'bis zum Folgetag',
    );
    expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
});
