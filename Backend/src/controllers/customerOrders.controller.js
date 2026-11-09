import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../db/prisma.js";

import {
  HttpError,
  validateId,
  validatePagination,
  customerOrderInclude,
  mapCustomerOrder,
  findCustomerOrder,
  paginationResponse,
} from "../utils/customerDomain.js";

// Keep exactly one reorder implementation.
// The route already points to orders.reorder.
export { reorder } from "./checkout.controller.js";

function success(res, data) {
  return res.status(200).json({
    success: true,
    data,
  });
}

const STATUS_LABELS = {
  PLACED: "Placed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  HANDED_OFF: "Handed Off",
  CANCELLED: "Cancelled",
};

function parseDate(value, field) {
  if (value === undefined) return null;

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(`${field} must use YYYY-MM-DD format.`, 400);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new HttpError(`${field} is not a valid date.`, 400);
  }

  return date;
}

/* =========================================================
   LIST MY ORDERS
   GET /api/v1/customer/orders
========================================================= */

export const listMyOrders = asyncHandler(async (req, res) => {
  const allowedQuery = ["page", "limit", "status", "from", "to"];

  if (!Object.keys(req.query).every((key) => allowedQuery.includes(key))) {
    throw new HttpError("Unexpected order filter.", 400);
  }

  const { page, limit, skip } = validatePagination(req.query);

  const where = {
    customerId: req.user.id,
    paymentStatus: {
      in: ["SUCCEEDED", "FAILED", "CANCELLED", "REFUNDED"],
    },
  };

  const status = req.query.status;

  if (status && status !== "All") {
    if (status === "Active") {
      where.status = {
        in: ["PLACED", "ACCEPTED", "PREPARING", "READY"],
      };
    } else if (status === "Completed") {
      where.status = "HANDED_OFF";
    } else if (status === "Cancelled") {
      where.status = "CANCELLED";
    } else {
      const statusMap = {
        Placed: "PLACED",
        Accepted: "ACCEPTED",
        Preparing: "PREPARING",
        Ready: "READY",
        "Handed Off": "HANDED_OFF",
      };

      if (!statusMap[status]) {
        throw new HttpError("Invalid order status filter.", 400);
      }

      where.status = statusMap[status];
    }
  }

  const from = parseDate(req.query.from, "from");
  const to = parseDate(req.query.to, "to");

  if (from && to && from > to) {
    throw new HttpError("The from date must be before the to date.", 400);
  }

  if (from || to) {
    where.placedAt = {
      ...(from ? { gte: from } : {}),
      ...(to
        ? {
            lt: new Date(to.getTime() + 24 * 60 * 60 * 1000),
          }
        : {}),
    };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: {
        placedAt: "desc",
      },
      skip,
      take: limit,
      include: {
        outlet: {
          include: {
            city: {
              select: { name: true },
            },
          },
        },
        address: true,
        items: {
          include: {
            addons: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return success(res, {
    orders: orders.map(mapCustomerOrder),
    pagination: paginationResponse(page, limit, total),
  });
});

/* =========================================================
   GET MY ORDER
   GET /api/v1/customer/orders/:orderId
========================================================= */

export const getMyOrder = asyncHandler(async (req, res) => {
  const orderId = validateId(req.params.orderId, "order ID");

  const order = await findCustomerOrder(prisma, req.user.id, orderId);

  if (!order) {
    // Same response for unknown and another customer's order.
    throw new HttpError("Order not found.", 404, "ORDER_NOT_FOUND");
  }

  return success(res, {
    order: mapCustomerOrder(order),
  });
});

/* =========================================================
   GET ORDER TRACKING
   GET /api/v1/customer/orders/:orderId/tracking
========================================================= */

export const getOrderTracking = asyncHandler(async (req, res) => {
  const orderId = validateId(req.params.orderId, "order ID");

  const order = await findCustomerOrder(prisma, req.user.id, orderId);

  if (!order) {
    throw new HttpError("Order not found.", 404, "ORDER_NOT_FOUND");
  }

  const events = order.events || [];

  function firstStatusTime(status) {
    const event = events.find((entry) => entry.toStatus === status);

    return event?.createdAt?.toISOString() || null;
  }

  const now = new Date();

  const delayMinutes =
    order.paymentStatus === "SUCCEEDED" &&
    !["HANDED_OFF", "CANCELLED"].includes(order.status) &&
    now > order.promisedAt
      ? Math.floor((now.getTime() - order.promisedAt.getTime()) / 60000)
      : 0;

  const remainingMinutes =
    order.paymentStatus === "SUCCEEDED" &&
    !["HANDED_OFF", "CANCELLED"].includes(order.status)
      ? Math.max(
          0,
          Math.ceil((order.promisedAt.getTime() - now.getTime()) / 60000),
        )
      : 0;

  return success(res, {
    orderId: order.orderNumber,
    status: STATUS_LABELS[order.status],
    paymentStatus: order.paymentStatus,
    placedAt: order.placedAt.toISOString(),
    acceptedAt: firstStatusTime("ACCEPTED"),
    preparingAt: order.startedAt?.toISOString() || firstStatusTime("PREPARING"),
    readyAt: order.readyAt?.toISOString() || firstStatusTime("READY"),
    handedOffAt:
      order.handedOffAt?.toISOString() || firstStatusTime("HANDED_OFF"),
    cancelledAt:
      order.cancelledAt?.toISOString() || firstStatusTime("CANCELLED"),
    promisedAt: order.promisedAt.toISOString(),
    estimatedPrepMinutes: order.estimatedPrepMinutes,
    remainingMinutes,
    delayMinutes,
    isLate: delayMinutes > 0,
    outlet: {
      id: order.outlet.id,
      name: order.outlet.name,
    },
  });
});

/* =========================================================
   GET ORDER TIMELINE
   GET /api/v1/customer/orders/:orderId/timeline
========================================================= */

export const getOrderTimeline = asyncHandler(async (req, res) => {
  const orderId = validateId(req.params.orderId, "order ID");

  const order = await prisma.order.findFirst({
    where: {
      customerId: req.user.id,
      OR: [{ id: orderId }, { orderNumber: orderId }],
    },
    select: {
      id: true,
      orderNumber: true,
      events: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          eventType: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new HttpError("Order not found.", 404, "ORDER_NOT_FOUND");
  }

  const timeline = order.events
    .filter((event) => event.toStatus || event.eventType === "ETA_OVERRIDDEN")
    .map((event) => {
      let description = "Order update";

      if (event.eventType === "ETA_OVERRIDDEN") {
        description = "Preparation estimate updated.";
      } else if (event.toStatus) {
        description = STATUS_LABELS[event.toStatus] || "Order status updated.";
      } else if (event.eventType === "PAYMENT_INITIATED") {
        description = "Payment initiated.";
      } else if (event.eventType === "PAYMENT_FAILED") {
        description = "Payment failed.";
      } else if (event.eventType === "PAYMENT_CANCELLED") {
        description = "Payment cancelled.";
      }

      return {
        id: event.id,
        eventType: event.eventType,
        fromStatus: event.fromStatus ? STATUS_LABELS[event.fromStatus] : null,
        toStatus: event.toStatus ? STATUS_LABELS[event.toStatus] : null,
        description,
        timestamp: event.createdAt.toISOString(),
      };
    });

  return success(res, {
    orderId: order.orderNumber,
    timeline,
  });
});
