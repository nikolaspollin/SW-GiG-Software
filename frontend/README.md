# SWGiGFrontend

Project overview and full local setup are documented in the [main README](../README.md#running-locally).

## Development

Start the backend on port 8080, then run from the repository root in a second terminal:

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:4200/`. Changes to source files are reloaded automatically.
During development, `/api` requests are forwarded to the backend via `proxy.conf.json`.
Page routes are defined in [`app.routes.ts`](src/app/app.routes.ts).

## Management pages

New CRUD management pages extend
[`ManagementPage<TEntity, TRequest>`](src/app/shared/management/management-page.ts).
`TEntity` represents loaded data and requires an `id: string`; `TRequest` represents
the create/update payload. See [`MenuPage`](src/app/menus/menu-page.ts) and
[`CategoryPage`](src/app/categories/category-page.ts) as examples.

- **Shared workflow:** The base class owns data and editor state, loading, creating,
  editing, saving and delete confirmation. It handles `busy`/`loading`, error and
  success messages, and cancels pending API requests when the page is destroyed.
- **Page-specific behavior:** Inject the concrete API service and provide error
  translation, message texts, `canEdit()` and `focusHeading()`. Sorting, formatting,
  templates and additional domain actions belong to the concrete page.
- **API contract:** Services implement
  [`CrudApi<TEntity, TRequest>`](src/app/shared/management/crud-api.ts), exposing
  `list`, `get`, `create`, `update` and `delete` as Observables. The base class uses
  this interface; the concrete page supplies its service.
- **Deletion and success messages:** `applyDeletion()` updates local data after a
  successful DELETE. Menus and categories archive entries; other domains may remove
  them. Supply the respective texts through `saveSuccessMessage()` and
  `deleteSuccessMessage()`.
- **Editors and dialogs:** Domain editors own form state and validation and emit
  save/cancel events; the page performs API calls. The shared
  [`DeleteDialog`](src/app/shared/management/delete-dialog/delete-dialog.ts) receives
  texts, busy/error state and `[open]="pendingDelete() !== null"`. Bind its
  `confirmed` and `cancelled` outputs to `confirmDelete()` and `cancelDelete()`.
- **Extensions:** Reuse `run()` for request/error handling and `replace()` to update
  stored entries. Override `afterEditLoaded()` for extra work when editing; async
  hooks are awaited. If overriding `ngOnInit()`, call `super.ngOnInit()` to preserve
  the initial load.
- **Tests:** Cover shared workflows in `ManagementPage` tests and dialog behavior
  in `DeleteDialog` tests. Keep concrete page integration tests focused on domain
  behavior and component wiring; editor tests cover form logic.

## Checks

Run these commands from `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run build` | Production build in `dist/` |
| `npm test -- --watch=false` | Unit and component integration tests |
| `npm run test:e2e` | Browser and accessibility tests |

Browser tests require Java 25 (`JAVA_HOME`) and Google Chrome. The
[`Playwright configuration`](playwright.config.ts) starts a separate backend on
port 18080 with an H2 in-memory database and the frontend on port 4201.
The development database is not used.

For Angular CLI commands, see the [Angular CLI documentation](https://angular.dev/tools/cli).
