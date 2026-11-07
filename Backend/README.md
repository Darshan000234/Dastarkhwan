# Dastarkhwan Backend — Express 5 + Prisma ORM 7 + PostgreSQL

This backend is designed against the checked-in Dastarkhwan frontend under `Frontend/`. It keeps one relational source of truth for customers, managers, outlets, menu mappings, orders, payments, status events, and customer tracking.

## Technology decisions

- Node.js ESM and Express 5.
- PostgreSQL (Neon-compatible) as the database.
- Prisma ORM 7.10.0.
- `@prisma/adapter-pg` and `pg` for the runtime database connection.
- `prisma-client` generator output in `src/generated/prisma`.
- The generated Prisma 7 client is TypeScript source; this existing backend is otherwise JavaScript. `tsx` is therefore used to run the server and seed script so Node can load the generated client. You do not need to convert your controllers to TypeScript.
- `DIRECT_URL` is used by Prisma CLI/migrations; `DATABASE_URL` is used by the running API. With Neon, use the direct (non-pooler) endpoint for `DIRECT_URL` and the pooled endpoint for `DATABASE_URL`.

Node.js requirement: Prisma ORM 7 requires Node.js `20.19.0+`, `22.12.0+`, or `24.0.0+`. The project's previously reported Node `20.19.0` meets the minimum. Prefer an active LTS release for deployment.

## Install

Run from `Dastarkhwan/Backend`:

```bash
npm install
```

Create `.env` from `.env.example`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Set real PostgreSQL connection strings in `.env`. Never commit `.env` or a real database password.

## First database setup

After setting `DIRECT_URL` and `DATABASE_URL`:

```bash
npm run db:format
npm run db:validate
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

`prisma migrate dev` creates a SQL migration under `prisma/migrations/`, applies it to the development database, and keeps migration history. Commit the `prisma/schema.prisma` and `prisma/migrations/` files to Git.

After the first migration is created, review `prisma/POSTGRESQL_INTEGRITY_NOTES.sql`. It contains optional PostgreSQL `CHECK` constraints (non-negative prices/stock and positive quantities) plus a partial unique index ensuring each customer has at most one default address. Copy these statements into a new timestamped migration folder under `prisma/migrations/` (for example `prisma/migrations/<timestamp>_integrity_constraints/migration.sql`) and apply it with `npm run db:migrate`. Keep these constraints in a tracked migration; do not rely on running the SQL file manually in production.

For a shared/production database, do not run `migrate dev`; run:

```bash
npm run db:deploy
```

Do not accept a destructive reset prompt against a database containing data unless you have backed it up and intentionally want to reset it.

## Start API

```bash
npm run dev
```

- Health check: `GET http://localhost:5000/health`
- API prefix: `http://localhost:5000/api/v1`
- Prisma Studio: in another terminal, `npm run db:studio`

The API controllers are still declaration-only placeholders and return `501 Not Implemented`. Prisma setup/schema is provided here; application controller logic, request validation, authorization enforcement, transactions, and frontend HTTP integration are the next implementation phase.

## Prisma files

```text
Backend/
├── prisma.config.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── src/
    └── db/
        └── prisma.js
```

`src/db/prisma.js` exports one shared Prisma Client instance. Import that singleton into controllers/services; do not instantiate a new `PrismaClient` per request or per controller.

## Data model / joins

### Identity and access

- `User` is the identity table for `CUSTOMER`, `CENTRAL_ADMIN`, and `OUTLET_MANAGER`.
- `Outlet.managerId` is nullable and unique: one currently assigned manager per outlet and one outlet per manager. Removing/replacing an assignment should update this field and create an `AuditLog` record; do not delete the User.
- `OtpChallenge` stores a hash, purpose, expiry, attempts and consumption time. Never store raw OTPs.
- `RefreshToken` stores a token hash, not the raw refresh token.

### Outlet and menu

- `City 1—N Outlet`.
- `City 1—N CityMenuPrice`, `FoodItem 1—N CityMenuPrice`, unique by `(cityId, foodItemId)`.
- `Outlet N—N FoodItem` through `OutletMenuItem`. This join stores outlet availability, stock count, optional price override, unavailability reason and expected restock time. Unique by `(outletId, foodItemId)`.
- `FoodItem 1—N FoodPortion`.
- `FoodItem 1—N AddonGroup 1—N AddonOption`.
- `TimeMenu N—N Outlet` through `TimeMenuOutlet`; `TimeMenu N—N FoodItem` through `TimeMenuItem`.

### Orders (one shared source for all roles)

- `User 1—N Order` as customer; `Outlet 1—N Order`.
- `Order 1—N OrderItem`; `OrderItem 1—N OrderItemAddon`.
- `OrderItem` stores item/portion/price snapshots so old receipts remain correct when the central catalog changes or an item is archived.
- `Order 1—N PaymentAttempt`; payment status is separate from order status.
- `Order 1—N OrderEvent` for the status timeline.
- `Order 1—N EtaOverride` for manager estimate changes.
- `Order 1—N Notification` for idempotent late-order/customer update events.
- `Order` is the same table queried by customer tracking, Central Admin and Outlet Manager endpoints. Never create separate role-specific order tables.

### Customer features

- `User 1—N Address`.
- `User 1—1 CustomerCart`; `CustomerCart 1—N CustomerCartItem`; selected add-ons are in `CustomerCartAddon`.
- `Coupon` and `CouponRedemption` preserve coupon rules and per-user use history.
- `User 1—1 LoyaltyAccount`; `LoyaltyAccount 1—N LoyaltyTransaction`.
- `CateringEnquiry` can optionally link to a customer and an outlet.

### Platform operations

- `AppSetting` stores JSON settings under a unique key.
- `AuditLog` stores actor, action, entity and JSON details.

## Indexing strategy

The schema includes indexes for the filters used by the frontend:

- Outlet lookup by city/active, pincode/active and delivery-pincode array (GIN).
- Menu catalog by active/category, active/food type and name.
- Outlet menu mapping by outlet/availability and item/availability.
- Orders by outlet/status/placed time, outlet/payment status/placed time, customer/placed time, status/promised time and payment status/placed time.
- Order events, notifications, ETA overrides, OTP expiry, token revocation, audit history, coupon redemption and catering workflow queries.

The unique constraints also enforce essential cardinality: unique phones/emails, outlet code, one assigned manager per outlet, one outlet per assigned manager, unique menu mapping per outlet/item, unique city price per item/city, unique order number, unique payment provider reference/idempotency key, and unique notification event key.

## Important API/domain mapping

The current React mock data uses title-case strings. The schema uses enums in uppercase:

| Frontend value | Prisma enum |
|---|---|
| `Placed` | `PLACED` |
| `Accepted` | `ACCEPTED` |
| `Preparing` | `PREPARING` |
| `Ready` | `READY` |
| `Handed Off` | `HANDED_OFF` |
| `Cancelled` | `CANCELLED` |
| `Succeeded` payment | `SUCCEEDED` |
| `Failed` payment | `FAILED` |
| `Pending` payment | `PENDING` |
| `UPI` / `Card` | `UPI` / `CARD` |

The controller/DTO layer must translate between database enums and the frontend's existing casing. Do not change the frontend status vocabulary casually.

The frontend currently reads mock prices from a city price, then outlet override, then default portion/item price. The backend query/price service should preserve that precedence and always return a computed quote; never trust prices sent by a browser.

## Business rules the future controllers must enforce

1. Derive the manager's outlet from the authenticated User → Outlet.manager relation on the server. Ignore client-supplied `outletId` in manager operations.
2. Only users with `role = OUTLET_MANAGER` and an active assigned outlet can process that outlet's orders.
3. Only `paymentStatus = SUCCEEDED` orders enter the paid kitchen queue.
4. Enforce order transitions: `PLACED → ACCEPTED → PREPARING → READY → HANDED_OFF`; allow `CANCELLED` only under explicit cancellation policy. Use a DB transaction to update the order and insert its `OrderEvent`.
5. On successful payment/order creation, persist the Order, OrderItems, add-on snapshots and PaymentAttempt atomically. Use an idempotency key to prevent duplicate paid orders.
6. Decrement stock atomically with a conditional update; never let stock become negative. Validate stock again inside the order transaction.
7. ETA override must enforce `Outlet.minimumPrepMinutes`, update only the selected order, and insert `EtaOverride`, `OrderEvent` and a deduplicated `Notification` event in one transaction.
8. A 10-minute late notification must have a deterministic `eventKey` (for example `order:<orderId>:late-10m`) and a unique DB constraint so polling cannot insert duplicates.
9. Manager availability updates can update only an existing `OutletMenuItem` mapping's availability/reason/restock time. They cannot edit the FoodItem catalog, city prices or outlet price override.
10. Revenue queries must include successful payments and exclude cancelled orders according to the product's reporting policy.
11. Use Decimal for monetary values. Convert/format Decimal values at API DTO boundaries; avoid JavaScript floating-point calculations for persisted amounts.
12. Use transactions for coupon redemption/loyalty redemption so points or coupon use cannot be duplicated under concurrent requests.

## Notes before production

- Seeded phone numbers and names are for local demo only. Do not deploy demo credentials or fixed OTPs.
- Use an OTP provider, rate limits, hashed OTPs, access-token rotation, hashed refresh tokens, secure cookies and secret rotation before production.
- Use a real payment provider and verify signed payment webhooks before setting a payment to `SUCCEEDED`. The mock payment routes must not be exposed as real payment confirmation in production.
- Restrict CORS, secure cookies, validate all inputs and add automated integration tests before deployment.
- Use the direct PostgreSQL URL for migrations and the pooler URL for runtime if your provider recommends that arrangement.
