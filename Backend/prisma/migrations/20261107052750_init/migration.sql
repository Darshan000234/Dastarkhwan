-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'CENTRAL_ADMIN', 'OUTLET_MANAGER');

-- CreateEnum
CREATE TYPE "OutletType" AS ENUM ('RESTAURANT', 'CLOUD_KITCHEN');

-- CreateEnum
CREATE TYPE "FoodType" AS ENUM ('VEG', 'NON_VEG');

-- CreateEnum
CREATE TYPE "SpiceLevel" AS ENUM ('NONE', 'MILD', 'MEDIUM', 'HOT', 'EXTRA_HOT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'HANDED_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'CASH', 'WALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'PHONE_VERIFICATION', 'PASSWORD_RESET', 'MANAGER_ASSIGNMENT');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED', 'REVERSAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SMS', 'WHATSAPP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'RECORDED', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "CateringStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'CONFIRMED', 'DECLINED', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "phone_verified_at" TIMESTAMPTZ(3),
    "email_verified_at" TIMESTAMPTZ(3),
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100),
    "country" VARCHAR(100) NOT NULL DEFAULT 'India',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlets" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "OutletType" NOT NULL,
    "city_id" TEXT NOT NULL,
    "address_line_1" VARCHAR(180) NOT NULL,
    "address_line_2" VARCHAR(180),
    "locality" VARCHAR(120) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "primary_pincode" VARCHAR(10) NOT NULL,
    "phone" VARCHAR(16),
    "fssai_license" VARCHAR(80),
    "supports_veg" BOOLEAN NOT NULL DEFAULT true,
    "supports_non_veg" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "delivery_radius_km" DECIMAL(7,2),
    "delivery_pincodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "opening_time" VARCHAR(5) NOT NULL,
    "closing_time" VARCHAR(5) NOT NULL,
    "operating_days" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minimum_prep_minutes" INTEGER NOT NULL DEFAULT 25,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "manager_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" VARCHAR(40) NOT NULL DEFAULT 'Home',
    "recipient_name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "line_1" VARCHAR(180) NOT NULL,
    "line_2" VARCHAR(180),
    "locality" VARCHAR(120) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "pincode" VARCHAR(10) NOT NULL,
    "landmark" VARCHAR(120),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_items" (
    "id" TEXT NOT NULL,
    "sku" VARCHAR(48),
    "name" VARCHAR(150) NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "food_type" "FoodType" NOT NULL,
    "spice_level" "SpiceLevel" NOT NULL DEFAULT 'MEDIUM',
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prep_time_minutes" INTEGER NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_portions" (
    "id" TEXT NOT NULL,
    "food_item_id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "food_portions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_groups" (
    "id" TEXT NOT NULL,
    "food_item_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "addon_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_options" (
    "id" TEXT NOT NULL,
    "addon_group_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "addon_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_menu_prices" (
    "id" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "food_item_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "city_menu_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outlet_menu_items" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "food_item_id" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "stock_quantity" INTEGER NOT NULL DEFAULT 30,
    "price_override" DECIMAL(10,2),
    "time_menu_label" VARCHAR(80) NOT NULL DEFAULT 'All Day',
    "unavailability_reason" VARCHAR(120),
    "expected_restock_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outlet_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "outlet_menu_item_id" TEXT NOT NULL,
    "order_id" TEXT,
    "actor_id" TEXT,
    "quantity_delta" INTEGER NOT NULL,
    "reason" VARCHAR(120) NOT NULL,
    "idempotency_key" VARCHAR(140),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_menus" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "days" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "time_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_menu_outlets" (
    "time_menu_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,

    CONSTRAINT "time_menu_outlets_pkey" PRIMARY KEY ("time_menu_id","outlet_id")
);

-- CreateTable
CREATE TABLE "time_menu_items" (
    "time_menu_id" TEXT NOT NULL,
    "food_item_id" TEXT NOT NULL,

    CONSTRAINT "time_menu_items_pkey" PRIMARY KEY ("time_menu_id","food_item_id")
);

-- CreateTable
CREATE TABLE "customer_carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "coupon_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "food_item_id" TEXT NOT NULL,
    "portion_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "special_note" VARCHAR(300),

    CONSTRAINT "customer_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_cart_addons" (
    "cart_item_id" TEXT NOT NULL,
    "addon_option_id" TEXT NOT NULL,

    CONSTRAINT "customer_cart_addons_pkey" PRIMARY KEY ("cart_item_id","addon_option_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" VARCHAR(32) NOT NULL,
    "customer_id" TEXT,
    "outlet_id" TEXT NOT NULL,
    "address_id" TEXT,
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(16) NOT NULL,
    "fulfillment_type" "FulfillmentType" NOT NULL DEFAULT 'DELIVERY',
    "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "PaymentMethod",
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "coupon_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loyalty_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "gst_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "special_instructions" VARCHAR(500),
    "placed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promised_at" TIMESTAMPTZ(3) NOT NULL,
    "estimated_prep_minutes" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "ready_at" TIMESTAMPTZ(3),
    "handed_off_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "food_item_id" TEXT,
    "outlet_menu_item_id" TEXT,
    "portion_id" TEXT,
    "item_name" VARCHAR(150) NOT NULL,
    "portion_name" VARCHAR(60),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "preparation_note" VARCHAR(300),

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_addons" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "addon_option_id" TEXT,
    "addon_name" VARCHAR(100) NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "order_item_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "provider" VARCHAR(50),
    "provider_reference" VARCHAR(150),
    "idempotency_key" VARCHAR(120),
    "failure_reason" VARCHAR(250),
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus",
    "event_type" VARCHAR(60) NOT NULL,
    "note" VARCHAR(500),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eta_overrides" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "previous_minutes" INTEGER NOT NULL,
    "new_minutes" INTEGER NOT NULL,
    "previous_promised_at" TIMESTAMPTZ(3) NOT NULL,
    "new_promised_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" VARCHAR(250) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eta_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "order_id" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "event_key" VARCHAR(150),
    "title" VARCHAR(150) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "description" VARCHAR(250),
    "discount_type" "CouponDiscountType" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "maximum_discount" DECIMAL(10,2),
    "minimum_order" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "total_usage_limit" INTEGER,
    "per_user_limit" INTEGER NOT NULL DEFAULT 1,
    "first_order_only" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "lifetime_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "type" "LoyaltyTransactionType" NOT NULL,
    "points_delta" INTEGER NOT NULL,
    "description" VARCHAR(250),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catering_enquiries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "outlet_id" TEXT,
    "contact_name" VARCHAR(120) NOT NULL,
    "contact_phone" VARCHAR(16) NOT NULL,
    "contact_email" VARCHAR(255),
    "event_type" VARCHAR(80) NOT NULL,
    "event_date" TIMESTAMPTZ(3),
    "guest_count" INTEGER NOT NULL,
    "location" VARCHAR(250) NOT NULL,
    "budget" DECIMAL(12,2),
    "requirements" VARCHAR(1500),
    "status" "CateringStatus" NOT NULL DEFAULT 'NEW',
    "admin_notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catering_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "phone" VARCHAR(16) NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" VARCHAR(120),

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" VARCHAR(100),
    "details" JSONB,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "outlets_code_key" ON "outlets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "outlets_manager_id_key" ON "outlets"("manager_id");

-- CreateIndex
CREATE INDEX "outlets_city_id_is_active_idx" ON "outlets"("city_id", "is_active");

-- CreateIndex
CREATE INDEX "outlets_pincode_is_active_idx" ON "outlets"("pincode", "is_active");

-- CreateIndex
CREATE INDEX "outlets_is_active_type_idx" ON "outlets"("is_active", "type");

-- CreateIndex
CREATE INDEX "outlets_delivery_pincodes_idx" ON "outlets" USING GIN ("delivery_pincodes");

-- CreateIndex
CREATE INDEX "addresses_user_id_is_default_idx" ON "addresses"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "addresses_pincode_idx" ON "addresses"("pincode");

-- CreateIndex
CREATE UNIQUE INDEX "food_items_sku_key" ON "food_items"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "food_items_slug_key" ON "food_items"("slug");

-- CreateIndex
CREATE INDEX "food_items_is_active_category_idx" ON "food_items"("is_active", "category");

-- CreateIndex
CREATE INDEX "food_items_is_active_food_type_idx" ON "food_items"("is_active", "food_type");

-- CreateIndex
CREATE INDEX "food_items_name_idx" ON "food_items"("name");

-- CreateIndex
CREATE INDEX "food_portions_food_item_id_is_active_idx" ON "food_portions"("food_item_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "food_portions_food_item_id_name_key" ON "food_portions"("food_item_id", "name");

-- CreateIndex
CREATE INDEX "addon_groups_food_item_id_sort_order_idx" ON "addon_groups"("food_item_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "addon_groups_food_item_id_name_key" ON "addon_groups"("food_item_id", "name");

-- CreateIndex
CREATE INDEX "addon_options_addon_group_id_is_active_sort_order_idx" ON "addon_options"("addon_group_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "addon_options_addon_group_id_name_key" ON "addon_options"("addon_group_id", "name");

-- CreateIndex
CREATE INDEX "city_menu_prices_food_item_id_idx" ON "city_menu_prices"("food_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "city_menu_prices_city_id_food_item_id_key" ON "city_menu_prices"("city_id", "food_item_id");

-- CreateIndex
CREATE INDEX "outlet_menu_items_outlet_id_is_available_idx" ON "outlet_menu_items"("outlet_id", "is_available");

-- CreateIndex
CREATE INDEX "outlet_menu_items_food_item_id_is_available_idx" ON "outlet_menu_items"("food_item_id", "is_available");

-- CreateIndex
CREATE UNIQUE INDEX "outlet_menu_items_outlet_id_food_item_id_key" ON "outlet_menu_items"("outlet_id", "food_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_idempotency_key_key" ON "inventory_movements"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_movements_outlet_id_created_at_idx" ON "inventory_movements"("outlet_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_outlet_menu_item_id_created_at_idx" ON "inventory_movements"("outlet_menu_item_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_order_id_idx" ON "inventory_movements"("order_id");

-- CreateIndex
CREATE INDEX "time_menus_is_active_idx" ON "time_menus"("is_active");

-- CreateIndex
CREATE INDEX "time_menu_outlets_outlet_id_idx" ON "time_menu_outlets"("outlet_id");

-- CreateIndex
CREATE INDEX "time_menu_items_food_item_id_idx" ON "time_menu_items"("food_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_carts_user_id_key" ON "customer_carts"("user_id");

-- CreateIndex
CREATE INDEX "customer_carts_outlet_id_idx" ON "customer_carts"("outlet_id");

-- CreateIndex
CREATE INDEX "customer_cart_items_cart_id_idx" ON "customer_cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "customer_cart_items_food_item_id_idx" ON "customer_cart_items"("food_item_id");

-- CreateIndex
CREATE INDEX "customer_cart_addons_addon_option_id_idx" ON "customer_cart_addons"("addon_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_outlet_id_status_placed_at_idx" ON "orders"("outlet_id", "status", "placed_at");

-- CreateIndex
CREATE INDEX "orders_outlet_id_payment_status_placed_at_idx" ON "orders"("outlet_id", "payment_status", "placed_at");

-- CreateIndex
CREATE INDEX "orders_customer_id_placed_at_idx" ON "orders"("customer_id", "placed_at");

-- CreateIndex
CREATE INDEX "orders_status_promised_at_idx" ON "orders"("status", "promised_at");

-- CreateIndex
CREATE INDEX "orders_payment_status_placed_at_idx" ON "orders"("payment_status", "placed_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_food_item_id_idx" ON "order_items"("food_item_id");

-- CreateIndex
CREATE INDEX "order_items_outlet_menu_item_id_idx" ON "order_items"("outlet_menu_item_id");

-- CreateIndex
CREATE INDEX "order_item_addons_order_item_id_idx" ON "order_item_addons"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_reference_key" ON "payment_attempts"("provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_idempotency_key_key" ON "payment_attempts"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_created_at_idx" ON "payment_attempts"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_attempts_status_created_at_idx" ON "payment_attempts"("status", "created_at");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_events_actor_id_created_at_idx" ON "order_events"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "eta_overrides_order_id_created_at_idx" ON "eta_overrides"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "eta_overrides_manager_id_created_at_idx" ON "eta_overrides"("manager_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_event_key_key" ON "notifications"("event_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_order_id_created_at_idx" ON "notifications"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_status_created_at_idx" ON "notifications"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_starts_at_ends_at_idx" ON "coupons"("is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "coupon_redemptions"("order_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_user_id_created_at_idx" ON "coupon_redemptions"("coupon_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "coupon_redemptions_user_id_created_at_idx" ON "coupon_redemptions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_accounts_user_id_key" ON "loyalty_accounts"("user_id");

-- CreateIndex
CREATE INDEX "loyalty_transactions_account_id_created_at_idx" ON "loyalty_transactions"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_transactions_user_id_created_at_idx" ON "loyalty_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "loyalty_transactions_order_id_idx" ON "loyalty_transactions"("order_id");

-- CreateIndex
CREATE INDEX "catering_enquiries_status_created_at_idx" ON "catering_enquiries"("status", "created_at");

-- CreateIndex
CREATE INDEX "catering_enquiries_user_id_created_at_idx" ON "catering_enquiries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "catering_enquiries_outlet_id_event_date_idx" ON "catering_enquiries"("outlet_id", "event_date");

-- CreateIndex
CREATE INDEX "otp_challenges_phone_purpose_created_at_idx" ON "otp_challenges"("phone", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_consumed_at_idx" ON "otp_challenges"("expires_at", "consumed_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_expires_at_idx" ON "refresh_tokens"("user_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_portions" ADD CONSTRAINT "food_portions_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_groups" ADD CONSTRAINT "addon_groups_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon_options" ADD CONSTRAINT "addon_options_addon_group_id_fkey" FOREIGN KEY ("addon_group_id") REFERENCES "addon_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_menu_prices" ADD CONSTRAINT "city_menu_prices_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_menu_prices" ADD CONSTRAINT "city_menu_prices_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_menu_items" ADD CONSTRAINT "outlet_menu_items_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outlet_menu_items" ADD CONSTRAINT "outlet_menu_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_outlet_menu_item_id_fkey" FOREIGN KEY ("outlet_menu_item_id") REFERENCES "outlet_menu_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_menu_outlets" ADD CONSTRAINT "time_menu_outlets_time_menu_id_fkey" FOREIGN KEY ("time_menu_id") REFERENCES "time_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_menu_outlets" ADD CONSTRAINT "time_menu_outlets_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_menu_items" ADD CONSTRAINT "time_menu_items_time_menu_id_fkey" FOREIGN KEY ("time_menu_id") REFERENCES "time_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_menu_items" ADD CONSTRAINT "time_menu_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_carts" ADD CONSTRAINT "customer_carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_carts" ADD CONSTRAINT "customer_carts_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_carts" ADD CONSTRAINT "customer_carts_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_cart_items" ADD CONSTRAINT "customer_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "customer_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_cart_items" ADD CONSTRAINT "customer_cart_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_cart_items" ADD CONSTRAINT "customer_cart_items_portion_id_fkey" FOREIGN KEY ("portion_id") REFERENCES "food_portions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_cart_addons" ADD CONSTRAINT "customer_cart_addons_cart_item_id_fkey" FOREIGN KEY ("cart_item_id") REFERENCES "customer_cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_cart_addons" ADD CONSTRAINT "customer_cart_addons_addon_option_id_fkey" FOREIGN KEY ("addon_option_id") REFERENCES "addon_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_portion_id_fkey" FOREIGN KEY ("portion_id") REFERENCES "food_portions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_outlet_menu_item_id_fkey" FOREIGN KEY ("outlet_menu_item_id") REFERENCES "outlet_menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_addons" ADD CONSTRAINT "order_item_addons_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_addons" ADD CONSTRAINT "order_item_addons_addon_option_id_fkey" FOREIGN KEY ("addon_option_id") REFERENCES "addon_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eta_overrides" ADD CONSTRAINT "eta_overrides_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eta_overrides" ADD CONSTRAINT "eta_overrides_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_enquiries" ADD CONSTRAINT "catering_enquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catering_enquiries" ADD CONSTRAINT "catering_enquiries_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
