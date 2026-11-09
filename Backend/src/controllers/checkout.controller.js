import { randomUUID } from "node:crypto";
import { emitOrderCreated } from "../services/realtime.js";
import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  HttpError,
  assertObject,
  assertAllowedKeys,
  validateId,
  buildCartQuote,
  estimatePreparationMinutes,
  customerOrderInclude,
  mapCustomerOrder,
  findCustomerOrder,
} from "../utils/customerDomain.js";

function success(res, data, status = 200, message) {
  return res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    data,
  });
}

function paymentMethodEnum(value) {
  if (typeof value !== "string") {
    throw new HttpError("Payment method is required.", 400);
  }

  const normalized = value.trim().toUpperCase();

  if (!["UPI", "CARD"].includes(normalized)) {
    throw new HttpError(
      "Choose UPI or Card for the current mock payment flow.",
      400,
    );
  }

  return normalized;
}

function getMockPaymentOutcome(value) {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";

  const map = {
    success: "SUCCEEDED",
    failed: "FAILED",
    cancelled: "CANCELLED",
  };

  if (!map[normalized]) {
    throw new HttpError(
      "Mock payment outcome must be success, failed, or cancelled.",
      400,
    );
  }

  return map[normalized];
}

function getMockPaymentEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.MOCK_PAYMENTS_ENABLED === "true"
  );
}

function createOrderNumber() {
  return `WEB-${Date.now().toString().slice(-10)}${randomUUID()
    .replace(/-/g, "")
    .slice(0, 5)
    .toUpperCase()}`;
}

function createPaymentReference() {
  return `PAY-${randomUUID().replace(/-/g, "").toUpperCase()}`;
}

function toPaymentResponse(payment, order) {
  return {
    intentId: payment.id,
    reference: payment.providerReference,
    paymentReference: payment.providerReference,
    orderId: order.orderNumber,
    amount: Number(payment.amount),
    method: payment.method,
    status: payment.status,
    mode: "MOCK",
    testMode: true,
  };
}

function quoteInputFromBody(body) {
  const { method, paymentMethod, outcome, ...quoteInput } = body;

  return quoteInput;
}

function getIdempotencyKey(req, body) {
  const value = req.get("Idempotency-Key") || body.idempotencyKey || null;

  if (value === null) return `checkout-${randomUUID()}`;

  if (
    typeof value !== "string" ||
    value.trim().length < 8 ||
    value.trim().length > 120
  ) {
    throw new HttpError(
      "Idempotency key must contain between 8 and 120 characters.",
      400,
    );
  }

  return value.trim();
}

/* =========================================================
   VALIDATE CART
   POST /api/v1/customer/cart/validate
========================================================= */

export const validateCart = asyncHandler(async (req, res) => {
  assertObject(req.body);

  const quote = await buildCartQuote(prisma, req.user.id, {
    outletId: req.body.outletId,
    addressId: req.body.addressId,
    items: req.body.items ?? req.body.cart,
    fulfillmentType: req.body.fulfillmentType,
  });

  return success(res, {
    valid: true,
    outlet: {
      id: quote.outlet.id,
      name: quote.outlet.name,
    },
    pincode: quote.pincode,
    items: quote.items.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      image: item.image,
      quantity: item.quantity,
      portionId: item.portionId,
      portion: item.portion,
      addons: item.addons,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: quote.subtotal,
    gstInclusive: true,
  });
});

/* =========================================================
   CALCULATE CART / CHECKOUT QUOTE
   POST /api/v1/customer/cart/quote
========================================================= */

export const calculateCart = asyncHandler(async (req, res) => {
  assertObject(req.body);

  const quote = await buildCartQuote(prisma, req.user.id, req.body);

  return success(res, {
    valid: true,
    outlet: {
      id: quote.outlet.id,
      name: quote.outlet.name,
      minimumPrepMinutes: quote.outlet.minimumPrepMinutes,
    },
    address: quote.address
      ? {
          id: quote.address.id,
          pincode: quote.address.pincode,
          recipientName: quote.address.recipientName,
        }
      : null,
    pincode: quote.pincode,
    items: quote.items.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      portion: item.portion,
      addons: item.addons,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    subtotal: quote.subtotal,
    couponCode: quote.couponCode,
    couponDiscount: quote.couponDiscount,
    loyaltyPoints: quote.loyaltyPoints,
    loyaltyDiscount: quote.loyaltyDiscount,
    deliveryFee: quote.deliveryFee,
    taxAmount: quote.taxAmount,
    gstRate: quote.gstRate,
    gstInclusive: quote.gstInclusive,
    total: quote.total,
    totalAmount: quote.total,
    currency: "INR",
  });
});

/* =========================================================
   CREATE MOCK PAYMENT INTENT
   POST /api/v1/customer/payments/mock-intent
========================================================= */

/*
 * Important existing-schema constraint:
 *
 * PaymentAttempt.orderId is required.
 *
 * Therefore a standalone PaymentAttempt cannot be created
 * before an Order exists.
 *
 * This handler creates a pending, unpaid checkout order and
 * its PaymentAttempt in one transaction.
 *
 * The order is not eligible for the kitchen queue while
 * paymentStatus is PENDING.
 *
 * On successful mock confirmation it becomes a normal
 * PLACED + SUCCEEDED order.
 */

export const createPaymentIntent = asyncHandler(async (req, res) => {
  assertObject(req.body);

  assertAllowedKeys(req.body, [
    "outletId",
    "addressId",
    "items",
    "cart",
    "couponCode",
    "loyaltyPoints",
    "loyaltyRedeemPoints",
    "instructions",
    "fulfillmentType",
    "method",
    "paymentMethod",
    "idempotencyKey",
  ]);

  if (!getMockPaymentEnabled()) {
    throw new HttpError(
      "Mock payments are disabled. No payment provider is configured.",
      503,
      "MOCK_PAYMENTS_DISABLED",
    );
  }

  const method = paymentMethodEnum(req.body.method ?? req.body.paymentMethod);

  const idempotencyKey = getIdempotencyKey(req, req.body);

  // A retry with the same key must return the original intent.
  const previous = await prisma.paymentAttempt.findFirst({
    where: {
      idempotencyKey,
      order: {
        is: {
          customerId: req.user.id,
        },
      },
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
        },
      },
    },
  });

  if (previous) {
    return success(
      res,
      toPaymentResponse(previous, previous.order),
      200,
      "Existing payment intent returned.",
    );
  }

  const quoteInput = quoteInputFromBody(req.body);

  const created = await prisma.$transaction(
    async (tx) => {
      // Recalculate all prices and validate the current menu
      // within the transaction used to create the payment intent.
      const quote = await buildCartQuote(
        tx,
        req.user.id,
        {
          ...quoteInput,
          outletId: req.body.outletId,
          addressId: req.body.addressId,
        },
        { requireAddress: true },
      );

      const estimate = await estimatePreparationMinutes(
        tx,
        quote.outlet,
        quote.items,
      );

      const now = new Date();

      const promisedAt = new Date(now.getTime() + estimate.minutes * 60 * 1000);

      const order = await tx.order.create({
        data: {
          orderNumber: createOrderNumber(),
          customerId: req.user.id,
          outletId: quote.outlet.id,
          addressId: quote.address.id,

          customerName: quote.address.recipientName,
          customerPhone: quote.address.phone,

          fulfillmentType: "DELIVERY",

          // Pending order. It must not enter the paid kitchen queue.
          status: "PLACED",
          paymentStatus: "PENDING",
          paymentMethod: method,

          currency: "INR",
          subtotal: quote.subtotal,
          couponDiscount: quote.couponDiscount,
          loyaltyDiscount: quote.loyaltyDiscount,
          taxAmount: quote.taxAmount,
          deliveryFee: quote.deliveryFee,
          gstRate: 5,
          gstInclusive: true,
          totalAmount: quote.total,

          specialInstructions: quote.instructions,

          placedAt: now,
          promisedAt,
          estimatedPrepMinutes: estimate.minutes,

          items: {
            create: quote.items.map((item) => ({
              foodItemId: item.itemId,
              outletMenuItemId: item.outletMenuItemId,
              portionId: item.portionId,
              itemName: item.name,
              portionName: item.portion,
              quantity: item.quantity,
              unitPrice: item.baseUnitPrice,
              lineTotal: item.lineTotal,
              preparationNote: item.specialNote,
              addons: {
                create: item.addons.map((addon) => ({
                  addonOptionId: addon.id,
                  addonName: addon.name,
                  unitPrice: addon.price,
                  quantity: item.quantity,
                })),
              },
            })),
          },
        },
        select: {
          id: true,
          orderNumber: true,
        },
      });

      // Store the checkout selections needed for final payment
      // confirmation in an audit event. The frontend cannot
      // modify this server-created metadata.
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: "CHECKOUT_DRAFT_CREATED",
          note: "Mock checkout payment initiated.",
          metadata: {
            couponId: quote.coupon?.id || null,
            couponCode: quote.couponCode,
            loyaltyPoints: quote.loyaltyPoints,
            estimatedPrepMinutes: estimate.minutes,
            estimateDetails: estimate.details,
          },
        },
      });

      const payment = await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          method,
          status: "PENDING",
          amount: quote.total,
          provider: "MOCK_DEMO",
          providerReference: createPaymentReference(),
          idempotencyKey,
        },
      });

      return {
        payment,
        order,
      };
    },
    {
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 15_000,
    },
  );

  return success(
    res,
    toPaymentResponse(created.payment, created.order),
    201,
    "Mock payment intent created. No money has been charged.",
  );
});

/* =========================================================
   CONFIRM MOCK PAYMENT
   POST /api/v1/customer/payments/mock-confirm
========================================================= */

export const confirmMockPayment = asyncHandler(async (req, res) => {
  assertObject(req.body);

  assertAllowedKeys(req.body, ["reference", "paymentReference", "outcome"]);

  if (!getMockPaymentEnabled()) {
    throw new HttpError(
      "Mock payments are disabled.",
      403,
      "MOCK_PAYMENTS_DISABLED",
    );
  }

  const reference = validateId(
    req.body.paymentReference ?? req.body.reference,
    "payment reference",
  );

  const outcome = getMockPaymentOutcome(req.body.outcome);

  const existing = await prisma.paymentAttempt.findFirst({
    where: {
      providerReference: reference,
      order: {
        is: {
          customerId: req.user.id,
        },
      },
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          paymentStatus: true,
          status: true,
        },
      },
    },
  });

  if (!existing) {
    throw new HttpError(
      "Payment reference not found.",
      404,
      "PAYMENT_NOT_FOUND",
    );
  }

  // Idempotent retry: do not decrement stock, redeem a coupon,
  // or spend loyalty points twice.
  if (existing.status !== "PENDING") {
    const requestedStatus = outcome;

    if (existing.status === requestedStatus) {
      return success(res, {
        reference,
        status: existing.status,
        orderId: existing.order.orderNumber,
        orderStatus: existing.order.status,
        paymentStatus: existing.order.paymentStatus,
        testMode: true,
      });
    }

    throw new HttpError(
      "This payment has already been finalised.",
      409,
      "PAYMENT_ALREADY_FINALISED",
    );
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const payment = await tx.paymentAttempt.findUnique({
        where: { id: existing.id },
        include: {
          order: {
            include: {
              items: true,
              events: {
                where: {
                  eventType: "CHECKOUT_DRAFT_CREATED",
                },
                take: 1,
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });

      if (!payment || payment.status !== "PENDING") {
        throw new HttpError(
          "This payment has already been processed.",
          409,
          "PAYMENT_ALREADY_FINALISED",
        );
      }

      const order = payment.order;

      if (order.customerId !== req.user.id) {
        throw new HttpError("Payment not found.", 404, "PAYMENT_NOT_FOUND");
      }

      const now = new Date();

      if (outcome !== "SUCCEEDED") {
        const updated = await tx.paymentAttempt.updateMany({
          where: {
            id: payment.id,
            status: "PENDING",
          },
          data: {
            status: outcome,
            failureReason:
              outcome === "FAILED"
                ? "Mock payment failed."
                : "Mock payment cancelled.",
          },
        });

        if (updated.count !== 1) {
          throw new HttpError("This payment has already been processed.", 409);
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: outcome,
            status: "CANCELLED",
            cancelledAt: now,
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            eventType:
              outcome === "FAILED" ? "PAYMENT_FAILED" : "PAYMENT_CANCELLED",
            fromStatus: "PLACED",
            toStatus: "CANCELLED",
            note:
              outcome === "FAILED"
                ? "Mock payment failed. No kitchen order was created."
                : "Mock payment cancelled. No kitchen order was created.",
          },
        });

        return {
          reference,
          status: outcome,
          orderId: order.orderNumber,
          orderStatus: "CANCELLED",
          paymentStatus: outcome,
          testMode: true,
        };
      }

      // Payment success: recheck and atomically decrement stock.
      const quantitiesByMapping = new Map();

      for (const item of order.items) {
        if (!item.outletMenuItemId) {
          throw new HttpError(
            "One or more menu mappings no longer exist.",
            409,
            "MENU_MAPPING_CHANGED",
          );
        }

        quantitiesByMapping.set(
          item.outletMenuItemId,
          (quantitiesByMapping.get(item.outletMenuItemId) || 0) + item.quantity,
        );
      }

      for (const [mappingId, quantity] of quantitiesByMapping) {
        const changed = await tx.outletMenuItem.updateMany({
          where: {
            id: mappingId,
            outletId: order.outletId,
            isAvailable: true,
            stockQuantity: {
              gte: quantity,
            },
          },
          data: {
            stockQuantity: {
              decrement: quantity,
            },
          },
        });

        if (changed.count !== 1) {
          throw new HttpError(
            "Stock changed before payment confirmation. The order was not confirmed.",
            409,
            "INSUFFICIENT_STOCK",
          );
        }

        await tx.inventoryMovement.create({
          data: {
            outletId: order.outletId,
            outletMenuItemId: mappingId,
            orderId: order.id,
            quantityDelta: -quantity,
            reason: "CUSTOMER_ORDER",
            idempotencyKey: `order:${order.id}:mapping:${mappingId}`,
          },
        });
      }

      const draftEvent = payment.order.events[0];
      const metadata = draftEvent?.metadata || {};

      // Revalidate coupon limits immediately before redemption.
      if (metadata.couponId) {
        const coupon = await tx.coupon.findUnique({
          where: { id: metadata.couponId },
        });

        const totalUsage = await tx.couponRedemption.count({
          where: { couponId: metadata.couponId },
        });

        const customerUsage = await tx.couponRedemption.count({
          where: {
            couponId: metadata.couponId,
            userId: req.user.id,
          },
        });

        if (
          !coupon ||
          !coupon.isActive ||
          (coupon.totalUsageLimit !== null &&
            totalUsage >= coupon.totalUsageLimit) ||
          customerUsage >= coupon.perUserLimit
        ) {
          throw new HttpError(
            "The coupon is no longer eligible. Payment has not been confirmed.",
            409,
            "COUPON_NO_LONGER_VALID",
          );
        }
        const now = new Date();

        const couponIsValid =
          coupon &&
          coupon.isActive &&
          (!coupon.startsAt || coupon.startsAt <= now) &&
          (!coupon.endsAt || coupon.endsAt >= now) &&
          toNumber(order.subtotal) >= toNumber(coupon.minimumOrder);

        if (!couponIsValid) {
          throw new HttpError(
            "The coupon is no longer eligible.",
            409,
            "COUPON_NO_LONGER_VALID",
          );
        }

        if (coupon.firstOrderOnly) {
          const previousPaidOrders = await tx.order.count({
            where: {
              customerId: req.user.id,
              id: { not: order.id },
              paymentStatus: "SUCCEEDED",
              status: { not: "CANCELLED" },
            },
          });

          if (previousPaidOrders > 0) {
            throw new HttpError(
              "This first-order coupon is no longer eligible.",
              409,
              "COUPON_FIRST_ORDER_ONLY",
            );
          }
        }
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.id,
            userId: req.user.id,
            orderId: order.id,
            discount: order.couponDiscount,
          },
        });
      }

      // Loyalty deduction occurs only on successful payment.
      const points = Number(metadata.loyaltyPoints || 0);

      if (points > 0) {
        const account = await tx.loyaltyAccount.findUnique({
          where: { userId: req.user.id },
        });

        if (!account) {
          throw new HttpError(
            "Loyalty account no longer exists.",
            409,
            "LOYALTY_ACCOUNT_NOT_FOUND",
          );
        }

        const changed = await tx.loyaltyAccount.updateMany({
          where: {
            id: account.id,
            pointsBalance: {
              gte: points,
            },
          },
          data: {
            pointsBalance: {
              decrement: points,
            },
          },
        });

        if (changed.count !== 1) {
          throw new HttpError(
            "Your loyalty balance changed. Recalculate checkout.",
            409,
            "LOYALTY_BALANCE_CHANGED",
          );
        }

        await tx.loyaltyTransaction.create({
          data: {
            accountId: account.id,
            userId: req.user.id,
            orderId: order.id,
            type: "REDEEMED",
            pointsDelta: -points,
            description: `Redeemed ${points} points on ${order.orderNumber}.`,
          },
        });
      }

      const paymentUpdated = await tx.paymentAttempt.updateMany({
        where: {
          id: payment.id,
          status: "PENDING",
        },
        data: {
          status: "SUCCEEDED",
          paidAt: now,
          failureReason: null,
        },
      });

      if (paymentUpdated.count !== 1) {
        throw new HttpError("Payment has already been processed.", 409);
      }

      const estimatedPrepMinutes = Number(metadata.estimatedPrepMinutes || 25);

      const promisedAt = new Date(
        now.getTime() + estimatedPrepMinutes * 60 * 1000,
      );

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "SUCCEEDED",
          status: "PLACED",
          placedAt: now,
          promisedAt,
          estimatedPrepMinutes,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: "ORDER_PLACED",
          fromStatus: null,
          toStatus: "PLACED",
          note: "Payment succeeded. Order placed with the outlet.",
        },
      });

      return {
        reference,
        status: "SUCCEEDED",
        orderId: order.orderNumber,
        orderStatus: "PLACED",
        paymentStatus: "SUCCEEDED",
        testMode: true,
      };
    },
    {
      isolationLevel: "Serializable",
  maxWait: 10_000,
  timeout: 15_000,
    },
  );

    if (
    result.status === "SUCCEEDED" &&
    result.orderStatus === "PLACED" &&
    result.paymentStatus === "SUCCEEDED"
  ) {
    try {
      const order = await prisma.order.findFirst({
        where: {
          orderNumber: result.orderId,
          customerId: req.user.id,
          paymentStatus: "SUCCEEDED",
          status: "PLACED",
        },
        select: {
          id: true,
          orderNumber: true,
          outletId: true,
          status: true,
          placedAt: true,
          promisedAt: true,
          estimatedPrepMinutes: true,
        },
      });

      if (order) {
        emitOrderCreated({
          outletId: order.outletId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          placedAt: order.placedAt?.toISOString() || null,
          promisedAt: order.promisedAt?.toISOString() || null,
          estimatedPrepMinutes: order.estimatedPrepMinutes,
        });
      }
    } catch (error) {
      // A real-time notification failure must not turn a
      // successfully paid order into an HTTP failure.
      console.error(
        "Failed to emit order:created:",
        error.message,
      );
    }
  }

  return success(res, result, 200, "Mock payment confirmation processed.");
});

/* =========================================================
   FINALISE / RETRIEVE ORDER
   POST /api/v1/customer/orders
========================================================= */

/*
 * The schema requires PaymentAttempt.orderId.
 *
 * The order was therefore created as a pending checkout record
 * when the payment intent was created.
 *
 * A successful confirmation changes it into a paid PLACED order.
 * This handler verifies that state and returns the existing order.
 * It never creates a second order.
 */

export const createOrder = asyncHandler(async (req, res) => {
  assertObject(req.body);

  assertAllowedKeys(req.body, ["paymentReference", "reference"]);

  const reference = validateId(
    req.body.paymentReference ?? req.body.reference,
    "payment reference",
  );

  const payment = await prisma.paymentAttempt.findFirst({
    where: {
      providerReference: reference,
      order: {
        is: {
          customerId: req.user.id,
        },
      },
    },
    include: {
      order: {
        include: customerOrderInclude(),
      },
    },
  });

  if (!payment) {
    throw new HttpError(
      "Payment or order not found.",
      404,
      "PAYMENT_NOT_FOUND",
    );
  }

  if (
    payment.status !== "SUCCEEDED" ||
    payment.order.paymentStatus !== "SUCCEEDED" ||
    payment.order.status !== "PLACED"
  ) {
    throw new HttpError(
      "Only a successfully paid order can be confirmed.",
      409,
      "ORDER_NOT_PAID",
    );
  }

  return success(
    res,
    {
      order: mapCustomerOrder(payment.order),
    },
    200,
    "Order confirmed successfully.",
  );
});

/* =========================================================
   REORDER
   POST /api/v1/customer/orders/:orderId/reorder
========================================================= */

/*
 * This is the single authoritative reorder implementation.
 *
 * customerOrders.controller.js re-exports this function rather
 * than maintaining a second copy of the business logic.
 */

export const reorder = asyncHandler(async (req, res) => {
  const orderId = validateId(req.params.orderId, "order ID");

  const oldOrder = await prisma.order.findFirst({
    where: {
      customerId: req.user.id,
      OR: [{ id: orderId }, { orderNumber: orderId }],
    },
    include: {
      items: {
        include: {
          addons: true,
        },
      },
    },
  });

  if (!oldOrder) {
    throw new HttpError("Order not found.", 404, "ORDER_NOT_FOUND");
  }

  assertObject(req.body || {});

  assertAllowedKeys(req.body || {}, ["addressId", "outletId"]);

  const requestedOutletId = req.body?.outletId || oldOrder.outletId;

  const defaultAddress = await prisma.address.findFirst({
    where: {
      userId: req.user.id,
      isDefault: true,
    },
    select: { id: true },
  });

  const addressId = req.body?.addressId || defaultAddress?.id;

  const rebuilt = [];
  const unavailable = [];

  for (const oldLine of oldOrder.items) {
    if (!oldLine.foodItemId) {
      unavailable.push(`${oldLine.itemName} (catalog item no longer exists)`);
      continue;
    }

    const cartLine = {
      itemId: oldLine.foodItemId,
      quantity: oldLine.quantity,
      portionId: oldLine.portionId,
      portion: oldLine.portionName,
      addons: oldLine.addons.map((addon) => ({
        id: addon.addonOptionId,
        name: addon.addonName,
      })),
    };

    try {
      const quote = await buildCartQuote(prisma, req.user.id, {
        outletId: requestedOutletId,
        addressId,
        items: [cartLine],
      });

      const line = quote.items[0];

      rebuilt.push({
        itemId: line.itemId,
        outletId: quote.outlet.id,
        name: line.name,
        image: line.image,
        category: line.category,
        portion: line.portion,
        portionId: line.portionId,
        addons: line.addons.map((addon) => ({
          id: addon.id,
          name: addon.name,
          price: addon.price,
        })),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        stockAvailable: line.stockAvailable,
      });
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        unavailable.push(`${oldLine.itemName} (${error.message})`);
        continue;
      }

      throw error;
    }
  }

  // Check combined quantities because the same food may appear
  // in more than one historical order line.
  const requestedByItem = new Map();

  for (const line of rebuilt) {
    requestedByItem.set(
      line.itemId,
      (requestedByItem.get(line.itemId) || 0) + line.quantity,
    );
  }

  const unavailableStockItems = new Set();

  for (const line of rebuilt) {
    const requested = requestedByItem.get(line.itemId);

    if (requested > line.stockAvailable) {
      unavailableStockItems.add(line.itemId);

      unavailable.push(
        `${line.name} (only ${line.stockAvailable} units remain)`,
      );
    }
  }

  const allowedLines = rebuilt
    .filter((line) => !unavailableStockItems.has(line.itemId))
    .map(({ stockAvailable, ...line }) => line);

  return success(res, {
    outletId: requestedOutletId,
    lines: allowedLines,
    unavailable,
    message:
      "Available dishes were rebuilt using current prices and menu configuration. No payment or new order was created.",
  });
});
