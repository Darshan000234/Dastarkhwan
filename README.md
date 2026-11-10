# Dastarkhwan 🍽️

### Multi-Outlet Restaurant Management & Online Ordering Platform

Dastarkhwan is a full-stack restaurant management and online ordering platform designed to simplify operations across multiple restaurant outlets. It connects customers, outlet managers, and central administrators through a unified system for food ordering, kitchen management, and restaurant operations.

## Features

### Customer
- Browse restaurants and discover available outlets using PIN codes.
- Explore outlet-specific menus, categories, and food items.
- Customize food items with portions and add-ons.
- Manage shopping carts and delivery addresses.
- Apply coupons and redeem loyalty points.
- Place orders and track their status in real time.
- Submit catering enquiries.

### Outlet Manager
- Dedicated outlet management dashboard.
- Monitor incoming and active orders.
- Manage kitchen operations through a Kitchen Display System.
- Update order statuses and preparation times.
- Manage menu availability and stock quantities.
- View outlet-level operational statistics.

### Central Admin
- Manage multiple restaurant outlets.
- Maintain a centralized food catalog.
- Configure city-level pricing and outlet-specific price overrides.
- Manage outlet menus and time-based menus.
- Assign outlet managers.
- Monitor orders, analytics, and audit logs.

### Other Highlights
- Real-time updates using Socket.IO.
- Role-based access control (RBAC).
- Secure cookie-based JWT authentication.
- Backend-side cart and pricing validation.
- Loyalty rewards and coupon management.
- End-to-end testing with Playwright.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4 |
| Routing | React Router |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL |
| ORM | Prisma ORM |
| Authentication | JWT, HTTP-only Cookies |
| Real-time | Socket.IO |
| Testing | Playwright |
| Security | Helmet, CORS |
| Tools | Git, GitHub, ESLint |

## Architecture

Dastarkhwan follows a client-server architecture.

- **Frontend:** Separate interfaces for customers, outlet managers, and central administrators.
- **Backend:** REST APIs built with Express.js, organized around controllers, middleware, and business logic.
- **Database:** PostgreSQL with Prisma ORM for relational data management.
- **Real-time:** Socket.IO handles order notifications, status updates, and menu availability changes.

The application uses role-based authorization and outlet-level access restrictions to ensure that users can only perform operations permitted by their roles.

## Database Flow

Dastarkhwan uses PostgreSQL as its primary database, with Prisma ORM handling database queries and relationships.

### Data Flow

```text
                  FRONTEND
                      |
                      | HTTP Request
                      v
               EXPRESS SERVER
                      |
                      v
           AUTHENTICATION MIDDLEWARE
                      |
                      v
            ROLE-BASED AUTHORIZATION
                      |
                      v
             BUSINESS CONTROLLERS
                      |
                      v
                 PRISMA ORM
                      |
                      v
                POSTGRESQL
                      |
                      | Query Result
                      v
                 PRISMA ORM
                      |
                      v
              EXPRESS RESPONSE
                      |
                      v
                  FRONTEND
```

### Order Data Flow

```text
Customer Selects Outlet
          |
          v
Fetch Outlet-Specific Menu
          |
          v
Add Items to Cart
          |
          v
Backend Validates Cart
          |
          v
Calculate Checkout Price
          |
          v
Validate Coupons & Rewards
          |
          v
Create Order in PostgreSQL
          |
          v
Notify Outlet Manager
          |
          v
Kitchen Processes Order
          |
          v
Update Order Status in Database
          |
          v
Send Real-Time Updates Through Socket.IO
          |
          v
Customer Tracks Order
```

### Database Responsibilities

- **PostgreSQL:** Stores application data, including users, outlets, menus, orders, and related operational records.
- **Prisma ORM:** Handles database queries, data creation, updates, and migrations.
- **Backend Validation:** Ensures cart items, pricing, permissions, and order operations are validated before database changes.
- **Socket.IO:** Delivers relevant real-time notifications after operational updates.

All database operations are performed through the backend. The frontend does not communicate directly with PostgreSQL.

## Getting Started

### Prerequisites

- Node.js
- PostgreSQL
- npm

### 1. Clone the Repository

```bash
git clone https://github.com/Darshan000234/Dastarkhwan.git
cd Dastarkhwan
```

### 2. Backend Setup

```bash
cd Backend
npm install
```

Create a `.env` file using the required variables from your backend configuration.

Run database migrations:

```bash
npx prisma migrate deploy
```

Generate the Prisma client:

```bash
npx prisma generate
```

Start the backend:

```bash
npm run dev
```

### 3. Frontend Setup

Open another terminal:

```bash
cd Frontend
npm install
npm run dev
```

The frontend and backend will run on their configured local ports.

## Project Structure

```text
Dastarkhwan/
├── Backend/
│   ├── prisma/
│   ├── scripts/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── ...
│
├── Frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   └── e2e/
│
└── README.md
```

## Real-Time Communication

Socket.IO is used for real-time communication between the backend and connected clients.

Key events include:

- `order:created`
- `order:status-updated`
- `order:eta-updated`
- `menu:availability-updated`

Role-specific rooms ensure that relevant updates reach the appropriate users.

## Testing

Playwright is used for end-to-end testing of important application workflows, including authentication, customer ordering, manager operations, and administrative functionality.

## Security

- HTTP-only cookies for authentication.
- JWT-based session verification.
- Role-based access control.
- Outlet-level authorization.
- Secure HTTP headers using Helmet.
- Backend-side validation of orders, cart items, and pricing.

---

**Built with React, Node.js, PostgreSQL, and Socket.IO.**
