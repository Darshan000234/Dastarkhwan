# Dastarkhwan Backend API Skeleton

This folder is an Express 5 backend route skeleton designed after inspecting the current React/Vite frontend in `Frontend/`.

**Scope:** route registration, middleware placeholders, controller declarations, app/server setup and endpoint documentation. Controller business logic is intentionally not implemented in this stage.

## Structure

```text
Backend/
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── src/
    ├── app.js
    ├── server.js
    ├── config/env.js
    ├── controllers/
    │   ├── admin.controller.js
    │   ├── auth.controller.js
    │   ├── catering.controller.js
    │   ├── checkout.controller.js
    │   ├── customer.controller.js
    │   ├── customerOrders.controller.js
    │   ├── manager.controller.js
    │   ├── menu.controller.js
    │   ├── order.controller.js
    │   ├── outlet.controller.js
    │   └── rewards.controller.js
    ├── middleware/
    │   ├── auth.js
    │   └── errorHandler.js
    ├── routes/
    │   ├── admin.routes.js
    │   ├── auth.routes.js
    │   ├── customer.routes.js
    │   ├── health.routes.js
    │   └── manager.routes.js
    └── utils/
        └── routePlaceholder.js
```

## Run locally

```bash
cd Backend
npm install
cp .env.example .env
npm run dev
```

Windows PowerShell alternative to copying env:

```powershell
Copy-Item .env.example .env
```

Server defaults to `http://localhost:5000`.

- Health: `GET http://localhost:5000/health`
- API base: `http://localhost:5000/api/v1`

Every business endpoint currently returns HTTP `501 Not Implemented`. This is deliberate: each route imports its named controller function, but controller logic is reserved for the subsequent controller-by-controller implementation.

## Frontend inspection notes

The existing frontend currently has no HTTP API client or REST endpoint calls. It uses three browser mock services and one shared `localStorage` store:

- `Frontend/src/services/mockApi.js` — central admin operations, outlets, menu CMS, manager assignment, shared order mutations, settings, audit and reset.
- `Frontend/src/services/mockCustomerApi.js` — customer bootstrap, menu reads, address/profile, cart validation/pricing, mock payment, order creation/tracking/reorder, loyalty and catering.
- `Frontend/src/services/mockOutletManagerApi.js` — manager workspace, assigned outlet, outlet-scoped order queue/actions, ETA override, menu availability and performance.

The API route skeleton groups those contracts into `auth`, `admin`, `customer` and `manager` namespaces. It intentionally does not copy frontend localStorage persistence into the backend.

## API namespace overview

### Authentication — `/api/v1/auth`

- `POST /otp/request`
- `POST /otp/verify`
- `POST /token/refresh`
- `POST /logout`
- `GET /session`
- `POST /password/forgot`
- `POST /password/reset`

### Central Admin — `/api/v1/admin`

- `GET /overview`
- `GET /audit-log`
- `GET|PATCH /settings`
- `POST /demo/reset`
- `GET /orders`, `GET /orders/:orderId`
- `GET|POST /outlets`
- `GET|PATCH /outlets/:outletId`
- `PATCH /outlets/:outletId/status`
- `GET /outlets/:outletId/analytics`
- `GET /outlets/:outletId/orders`
- `GET /outlets/:outletId/menu`
- `POST /outlets/:outletId/manager/otp`
- `POST /outlets/:outletId/manager/verify`
- `PUT|DELETE /outlets/:outletId/manager`
- `GET|POST /menu/catalog`
- `GET|PATCH|DELETE /menu/catalog/:itemId`
- `PATCH /menu/catalog/:itemId/city-prices/:city`
- `POST /menu/catalog/:itemId/outlets`
- `PATCH|DELETE /menu/catalog/:itemId/outlets/:outletId`
- `GET|POST /menu/time-menus`
- `PATCH|DELETE /menu/time-menus/:timeMenuId`

### Customer — `/api/v1/customer`

Public discovery:
- `GET /serviceability/:pincode`
- `GET /menu`, `GET /menu/categories`, `GET /menu/popular`
- `GET /menu/:itemId`

Authenticated customer:
- `GET /bootstrap`
- `GET|PATCH /profile`
- `GET|POST /addresses`
- `PATCH|DELETE /addresses/:addressId`
- `PATCH /addresses/:addressId/default`
- `POST /cart/validate`, `POST /cart/quote`
- `POST /payments/mock-intent`, `POST /payments/mock-confirm`
- `POST /orders`
- `GET /orders`, `GET /orders/:orderId`
- `GET /orders/:orderId/tracking`, `GET /orders/:orderId/timeline`
- `POST /orders/:orderId/reorder`
- `GET /rewards`, `GET /rewards/transactions`
- `POST /rewards/redeem`
- `POST /catering/enquiries`, `GET /catering/enquiries`

### Outlet Manager — `/api/v1/manager`

- `GET /workspace`, `GET /overview`
- `GET /kitchen/orders`, `GET /kitchen/late-orders`
- `GET /orders`, `GET /orders/:orderId`, `GET /orders/:orderId/timeline`
- `PATCH /orders/:orderId/status`, `PATCH /orders/:orderId/eta`
- `GET /menu-availability`, `PATCH /menu-availability/:itemId`
- `GET /performance`
- `GET|PATCH /account`

## Important design constraints for controller implementation

1. **One shared order domain:** Customer, Central Admin and Manager endpoints must read/update the same database order records. Do not make separate manager/customer order tables.
2. **Manager outlet scope:** derive `outletId` from the authenticated manager record on the server. Never trust a client-supplied outlet ID for manager operations.
3. **Role values:** use `customer`, `central_admin`, `outlet_manager`, matching the frontend `RoleGate`.
4. **Order status values:** `Placed`, `Accepted`, `Preparing`, `Ready`, `Handed Off`, `Cancelled` (frontend casing). Payment state remains separate: `Pending`, `Succeeded`, `Failed`, `Cancelled`.
5. **Payment gate:** only confirmed successful payments enter the paid kitchen workflow.
6. **Menu mapping:** manager availability updates must affect an existing outlet mapping only; managers must not edit catalog content, mappings or prices.
7. **ETA override:** individual order only, reason required, outlet minimum enforced, audit/timeline event and customer ETA notification event.
8. **No real integrations yet:** payment routes are named mock-payment contracts; no real payment gateway, OTP SMS or Socket.IO has been implemented.

## Implementation sequencing for the next chat

Recommended order:

1. Auth controller + auth middleware and user/manager session model.
2. Outlets and manager assignment controller.
3. Catalog, outlet mapping, city price and time-menu controllers.
4. Customer profile, address and serviceability controllers.
5. Cart validation, price quote, mock payment and order creation controllers.
6. Customer order tracking, reorder, rewards and catering controllers.
7. Manager workspace/KDS/status/ETA/availability/performance controllers.
8. Admin overview, orders, audit, settings and reset controllers.

Do not consider the API functional until controller implementations, persistence, validation, authorization, tests and frontend API-client integration are completed.
