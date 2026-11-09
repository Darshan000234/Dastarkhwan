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