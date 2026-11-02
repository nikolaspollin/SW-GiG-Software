# US17 — Guest cart

Persistent, session-scoped cart with quantities, extras, notes and server pricing. Extras apply per serving. Current EUR prices are recalculated on every operation; invalid lines have errors and no total.

## Local demo

Requires Java 25, Angular-compatible Node and npm 11.20.0. Run in separate terminals:

```powershell
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=cart-demo"
```

```powershell
cd frontend
npm ci
npm start
```

Open `http://localhost:4200/cart#access=demo-table-1`. Other tokens: `demo-table-2` (separate table), `demo-closed-table` (closed session). These public credentials work **only in the local demo profile**. The browser stores access per tab and removes it from the URL. Without real adapters or the demo profile, access returns 503.

## Integration

- **F03/T01:** replace `CartDependencies.guestSessionAccess` with credential validation, expiry/revocation checks and open-session lookup. The client never supplies a session ID.
- **F06/F07:** replace `CartDependencies.cartCatalog` with maintained products and permitted extras. Use stable UUIDs and nonnegative EUR prices with at most two decimal places.
- **US19:** call `CartService.validateForSubmission` inside the submission transaction, including the owning modules' session/menu locks and station checks. HTTP validation is advisory; snapshots and idempotency belong to submission.

Each session owns one draft with many items. Edits lock that draft; concurrent first creation may return 409. Refresh before retrying; mutations are not automatically retried.

## API

Prefix: `/api/order-drafts`. Every route requires `Authorization: Bearer <token>` and disables caching.

- `GET /current`: read the cart without creating empty database records.
- `POST /current/items`: add `{ productId, quantity, note, extras: [{ extraId, quantity }] }`.
- `PUT /current/items/{id}` / `DELETE /current/items/{id}`: edit/remove an owned line.
- `POST /current/validate`: recheck a nonempty cart; never places an order.
- `GET /products?search=&page=0&size=20` / `GET /products/{id}`: current menu choices.

Limits: integer quantities 1–99, 500-character notes, 100 lines/cart, 50 distinct extras/line, and product-specific extra limits. Errors use Problem Details: 400 invalid input, 401 invalid access, 404 missing/out-of-scope item, 409 closed session/conflict, 422 invalid selection/cart, 503 missing adapter.

## Storage and tests

Local H2 data persists in ignored `backend/data/gig`. Override with `GIG_DATABASE_URL`, `GIG_DATABASE_USER`, `GIG_DATABASE_PASSWORD` and `GIG_SCHEMA_MODE`. Default schema mode `update` is for development; production migrations/database checks remain integration work.

```powershell
cd backend
.\mvnw.cmd test
cd ../frontend
npm test -- --watch=false
npm run build
npm run test:e2e
```

Browser tests start both servers on free ports 8080/4200, use isolated in-memory data and installed Chrome, and stop the servers afterward. `GIG_MAVEN_ARGS` supplies optional Maven arguments. Coverage includes persistence, pricing, session isolation, invalid inputs, menu changes, concurrent edits, browser CRUD, mobile focus/layout and axe accessibility. Real F03/F06/F07 integration and order submission remain pending.
