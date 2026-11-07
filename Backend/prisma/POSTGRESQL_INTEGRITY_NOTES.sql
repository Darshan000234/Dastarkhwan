-- Optional PostgreSQL integrity rules to add to a migration after the base
-- Prisma migration has created these tables. Do not run this file before the
-- tables exist. Prefer copying these statements into a versioned migration.

ALTER TABLE "outlet_menu_items"
  ADD CONSTRAINT "outlet_menu_items_stock_non_negative"
  CHECK ("stock_quantity" >= 0);

ALTER TABLE "food_portions"
  ADD CONSTRAINT "food_portions_price_non_negative"
  CHECK ("price" >= 0);

ALTER TABLE "city_menu_prices"
  ADD CONSTRAINT "city_menu_prices_price_non_negative"
  CHECK ("price" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_non_negative"
  CHECK (
    "subtotal" >= 0 AND
    "coupon_discount" >= 0 AND
    "loyalty_discount" >= 0 AND
    "tax_amount" >= 0 AND
    "delivery_fee" >= 0 AND
    "total_amount" >= 0
  );

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "customer_cart_items"
  ADD CONSTRAINT "customer_cart_items_quantity_positive"
  CHECK ("quantity" > 0);

-- At most one default address per customer. PostgreSQL partial unique index;
-- Prisma schema cannot express this exact partial-index predicate yet.
CREATE UNIQUE INDEX "addresses_one_default_per_user"
  ON "addresses" ("user_id")
  WHERE "is_default" = TRUE;
