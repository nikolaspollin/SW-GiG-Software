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
