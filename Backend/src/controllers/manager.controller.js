import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  HttpError,
  assertObject,
  assertAllowedKeys,
  validateId,
} from "../utils/customerDomain.js";
import {
  emitOrderStatusUpdated,
  emitOrderEtaUpdated,
  emitMenuAvailabilityUpdated,
} from "../services/realtime.js";

/* =========================================================
   CONSTANTS
========================================================= */

const TIME_ZONE = "Asia/Kolkata";
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ORDER_STATUSES = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "HANDED_OFF",
  "CANCELLED",
];

const PAYMENT_STATUSES = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
];

const PAYMENT_METHODS = ["UPI", "CARD", "CASH", "WALLET", "OTHER"];

const FULFILLMENT_TYPES = ["DELIVERY", "PICKUP"];

const ACTIVE_ORDER_STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "READY"];

const STATUS_LABELS = {
  PLACED: "Placed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  HANDED_OFF: "Handed Off",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS_LABELS = {
  PENDING: "Pending",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const PAYMENT_METHOD_LABELS = {
  UPI: "UPI",
  CARD: "Card",
  CASH: "Cash",
  WALLET: "Wallet",
  OTHER: "Other",
};

const STATUS_TRANSITIONS = {
  PLACED: "ACCEPTED",
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "HANDED_OFF",
};

const STATUS_PRIORITY = {
  PLACED: 0,
  ACCEPTED: 1,
  PREPARING: 1,
  READY: 2,
  HANDED_OFF: 3,
  CANCELLED: 4,
};

/*
 * This include is intentionally limited to information needed
 * by manager order screens. It uses historical OrderItem
 * snapshots and never recalculates old prices from FoodItem.
 */
const MANAGER_ORDER_INCLUDE = {
  address: {
    select: {
      id: true,
      recipientName: true,
      phone: true,
      label: true,
      line1: true,
      line2: true,
      locality: true,
      city: true,
      state: true,
      pincode: true,
      landmark: true,
    },
  },

  items: {
    orderBy: {
      id: "asc",
    },
    include: {
      addons: {
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          addonName: true,
          unitPrice: true,
          quantity: true,
        },
      },
    },
  },

  payments: {
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      paidAt: true,
      createdAt: true,
    },
  },

  events: {
    orderBy: {
      createdAt: "asc",
    },
    include: {
      actor: {
        select: {
          id: true,
          fullName: true,
          role: true,
        },
      },
    },
  },

  etaOverrides: {
    orderBy: {
      createdAt: "desc",
    },
    include: {
      manager: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },

  notifications: {
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
    select: {
      id: true,
      userId: true,
      channel: true,
      status: true,
      title: true,
      body: true,
      createdAt: true,
    },
  },
};

const MANAGER_ORDER_LIST_INCLUDE = {
  items: {
    select: {
      itemName: true,
      quantity: true,
    },
  },
  payments: {
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
    select: {
      method: true,
      status: true,
    },
  },
};

/* =========================================================
   COMMON RESPONSE AND ERROR HANDLING
========================================================= */

function success(
  res,
  data,
  message = "Data retrieved successfully.",
  statusCode = 200,
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/*
 * Express 5 forwards rejected async handlers automatically,
 * but asyncHandler is retained to match the existing project.
 *
 * Known Prisma errors are mapped to safe API errors. Unknown
 * errors continue to the existing global error middleware.
 */
function managerController(handler) {
  return asyncHandler(async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      if (error?.code === "P2002") {
        const target = error.meta?.target;
        const targetText = Array.isArray(target)
          ? target.join(",")
          : String(target || "");

        if (targetText.toLowerCase().includes("email")) {
          throw new HttpError(
            "An account already uses this email address.",
            409,
            "EMAIL_ALREADY_EXISTS",
          );
        }

        throw new HttpError(
          "A record with the supplied unique value already exists.",
          409,
          "DUPLICATE_RECORD",
        );
      }

      if (error?.code === "P2003") {
        throw new HttpError(
          "A referenced record does not exist or cannot be used.",
          422,
          "INVALID_RELATION",
        );
      }

      if (error?.code === "P2025") {
        throw new HttpError(
          "The requested record was not found.",
          404,
          "RECORD_NOT_FOUND",
        );
      }

      if (error?.code === "P2034") {
        throw new HttpError(
          "This operation conflicted with another request. Refresh and try again.",
          409,
          "TRANSACTION_CONFLICT",
        );
      }

      throw error;
    }
  });
}

/* =========================================================
   COMMON VALIDATION HELPERS
========================================================= */

function assertQueryKeys(query, allowedKeys) {
  const unknown = Object.keys(query || {}).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknown.length) {
    throw new HttpError(
      `Unsupported query parameter(s): ${unknown.join(", ")}.`,
      400,
      "INVALID_QUERY",
    );
  }
}

function parsePagination(query = {}, defaultLimit = 20) {
  const page = query.page === undefined ? 1 : Number(query.page);

  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new HttpError(
      "Page must be positive and limit must be between 1 and 100.",
      400,
      "INVALID_PAGINATION",
    );
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function requiredText(value, field, maxLength = 250) {
  if (typeof value !== "string") {
    throw new HttpError(`${field} must be text.`, 400);
  }

  const clean = value.trim();

  if (
    clean.length < 1 ||
    clean.length > maxLength ||
    /[\u0000-\u001F\u007F]/.test(clean)
  ) {
    throw new HttpError(
      `${field} must contain between 1 and ${maxLength} valid characters.`,
      400,
    );
  }

  return clean;
}

function optionalText(value, field, maxLength = 250) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  return requiredText(value, field, maxLength);
}

function positiveInteger(value, field, min, max) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new HttpError(
      `${field} must be a whole number between ${min} and ${max}.`,
      400,
    );
  }

  return number;
}

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function nullableNumber(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseBooleanQuery(value, field) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new HttpError(`${field} must be either true or false.`, 400);
}

function normalizeEnum(value, allowed, field, aliases = {}) {
  if (typeof value !== "string") {
    throw new HttpError(`Invalid ${field}.`, 400);
  }

  const clean = value.trim();

  if (!clean) {
    throw new HttpError(`Invalid ${field}.`, 400);
  }

  const upper = clean.toUpperCase();

  if (allowed.includes(upper)) {
    return upper;
  }

  const alias = aliases[clean.toLowerCase()];

  if (alias && allowed.includes(alias)) {
    return alias;
  }

  throw new HttpError(`Invalid ${field}.`, 400);
}

function normalizeOrderStatus(value) {
  const aliases = {
    placed: "PLACED",
    accepted: "ACCEPTED",
    preparing: "PREPARING",
    ready: "READY",
    "handed off": "HANDED_OFF",
    handed_off: "HANDED_OFF",
    cancelled: "CANCELLED",
  };

  return normalizeEnum(value, ORDER_STATUSES, "order status", aliases);
}

function normalizePaymentStatus(value) {
  const aliases = {
    pending: "PENDING",
    succeeded: "SUCCEEDED",
    success: "SUCCEEDED",
    failed: "FAILED",
    cancelled: "CANCELLED",
    refunded: "REFUNDED",
  };

  return normalizeEnum(value, PAYMENT_STATUSES, "payment status", aliases);
}

function normalizePaymentMethod(value) {
  const aliases = {
    upi: "UPI",
    card: "CARD",
    cash: "CASH",
    wallet: "WALLET",
    other: "OTHER",
  };

  return normalizeEnum(value, PAYMENT_METHODS, "payment method", aliases);
}

function normalizeFulfillmentType(value) {
  const aliases = {
    delivery: "DELIVERY",
    pickup: "PICKUP",
  };

  return normalizeEnum(value, FULFILLMENT_TYPES, "fulfillment type", aliases);
}

function requireManagerOutletId(req) {
  if (typeof req.managerOutletId !== "string" || !req.managerOutletId.trim()) {
    throw new HttpError(
      "No assigned outlet is available for this manager.",
      403,
      "OUTLET_ASSIGNMENT_REQUIRED",
    );
  }

  return req.managerOutletId;
}

function requireManagerId(req) {
  if (typeof req.user?.id !== "string" || !req.user.id.trim()) {
    throw new HttpError(
      "Manager authentication is required.",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return req.user.id;
}

/* =========================================================
   INDIA STANDARD TIME / DATE HELPERS
========================================================= */

function istDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function getIstStartOfToday(now = new Date()) {
  const parts = istDateParts(now);
  const date = `${parts.year}-${parts.month}-${parts.day}`;

  return new Date(`${date}T00:00:00.000+05:30`);
}

function parseDateOnly(value, field, endOfDay = false) {
  const match =
    typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;

  if (!match) {
    throw new HttpError(
      `${field} must use YYYY-MM-DD format.`,
      400,
      "INVALID_DATE",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new HttpError(
      `${field} is not a valid calendar date.`,
      400,
      "INVALID_DATE",
    );
  }

  const start = new Date(`${value}T00:00:00.000+05:30`);

  return endOfDay ? new Date(start.getTime() + DAY_MS - 1) : start;
}

/*
 * Custom ranges are full India business days.
 * Default ranges finish at the current server timestamp.
 */
function resolveDateRange(
  query = {},
  defaultDays = 7,
  defaultLabel = `${defaultDays}d`,
) {
  const now = new Date();

  if (query.from !== undefined || query.to !== undefined) {
    if (!query.from || !query.to) {
      throw new HttpError(
        "Both from and to dates are required for a custom range.",
        400,
        "DATE_RANGE_REQUIRED",
      );
    }

    const from = parseDateOnly(query.from, "From date");
    const to = parseDateOnly(query.to, "To date", true);

    if (from > to) {
      throw new HttpError("The from date must not be after the to date.", 400);
    }

    if (from > now) {
      throw new HttpError("The from date cannot be in the future.", 400);
    }

    const todayStart = getIstStartOfToday(now);

    if (to > todayStart.getTime() + DAY_MS - 1) {
      throw new HttpError("The to date cannot be in the future.", 400);
    }

    const calendarDays = Math.floor((to - from) / DAY_MS) + 1;

    if (calendarDays > 90) {
      throw new HttpError(
        "Custom date ranges cannot exceed 90 calendar days.",
        400,
      );
    }

    return {
      from,
      to,
      label: "custom",
    };
  }

  let days = defaultDays;
  let label = defaultLabel;

  if (query.range !== undefined) {
    const ranges = {
      today: 1,
      "7d": 7,
      "30d": 30,
    };

    const selected = String(query.range).trim().toLowerCase();

    if (!Object.hasOwn(ranges, selected)) {
      throw new HttpError("Range must be today, 7d, or 30d.", 400);
    }

    days = ranges[selected];
    label = selected;
  }

  const todayStart = getIstStartOfToday(now);

  return {
    from: new Date(todayStart.getTime() - (days - 1) * DAY_MS),
    to: now,
    label,
  };
}

function formatIstDateTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatIstTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTrendLabel(dateString) {
  return new Date(`${dateString}T12:00:00.000+05:30`).toLocaleDateString(
    "en-IN",
    {
      timeZone: TIME_ZONE,
      day: "2-digit",
      month: "short",
    },
  );
}

/*
 * datetime-local values from the existing manager UI have no
 * timezone suffix. Interpret those values as India local time.
 * ISO strings carrying Z or an offset retain their own offset.
 */
function parseRestockDate(value) {
  if (value === null || value === "") return null;

  if (typeof value !== "string") {
    throw new HttpError("Expected restock time must be a valid date.", 400);
  }

  const clean = value.trim();

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(clean);

  const localDateTime =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(clean);

  if (!hasTimezone && !localDateTime) {
    throw new HttpError(
      "Expected restock time must be an ISO date or datetime-local value.",
      400,
    );
  }

  const parsed = new Date(hasTimezone ? clean : `${clean}+05:30`);

  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError("Expected restock time is invalid.", 400);
  }

  return parsed;
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

/* =========================================================
   RESPONSE MAPPERS
========================================================= */

function mapOutletSummary(outlet) {
  if (!outlet) return null;

  return {
    id: outlet.id,
    code: outlet.code,
    name: outlet.name,
    type: outlet.type,
    city: outlet.city?.name || null,
    locality: outlet.locality,
    address: [
      outlet.addressLine1,
      outlet.addressLine2,
      outlet.locality,
      outlet.city?.name,
      outlet.state,
      outlet.pincode,
    ]
      .filter(Boolean)
      .join(", "),
    addressLine1: outlet.addressLine1,
    addressLine2: outlet.addressLine2,
    state: outlet.state,
    pincode: outlet.pincode,
    phone: outlet.phone,
    active: outlet.isActive,
    isActive: outlet.isActive,
    openTime: outlet.openingTime,
    closeTime: outlet.closingTime,
    openingTime: outlet.openingTime,
    closingTime: outlet.closingTime,
    operatingDays: outlet.operatingDays,
    minimumPrepMinutes: outlet.minimumPrepMinutes,
    prepTime: outlet.minimumPrepMinutes,
    supportsVeg: outlet.supportsVeg,
    supportsNonVeg: outlet.supportsNonVeg,
  };
}

function mapManagerProfile(manager) {
  return {
    id: manager.id,
    name: manager.fullName,
    fullName: manager.fullName,
    phone: manager.phone,
    email: manager.email,
    avatarUrl: manager.avatarUrl,
    role: manager.role,
    roleLabel: "Outlet Manager",
    isActive: manager.isActive,
    phoneVerifiedAt: iso(manager.phoneVerifiedAt),
    emailVerifiedAt: iso(manager.emailVerifiedAt),
    phoneVerified: Boolean(manager.phoneVerifiedAt),
    emailVerified: Boolean(manager.emailVerifiedAt),
    createdAt: iso(manager.createdAt),
    updatedAt: iso(manager.updatedAt),
  };
}

function safeMetadata(value) {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    return value.map(safeMetadata);
  }

  if (typeof value !== "object") {
    return value;
  }

  const blockedKeys = new Set([
    "password",
    "passwordhash",
    "token",
    "accesstoken",
    "refreshtoken",
    "secret",
    "otp",
    "otphash",
    "cookie",
    "authorization",
  ]);

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !blockedKeys.has(key.toLowerCase()))
      .map(([key, entry]) => [key, safeMetadata(entry)]),
  );
}

function eventLabel(event) {
  if (event.toStatus) {
    return STATUS_LABELS[event.toStatus] || event.toStatus;
  }

  if (event.eventType === "ETA_OVERRIDDEN") {
    return "ETA updated";
  }

  return String(event.eventType || "Order event")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapOrderEvent(event) {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    eventType: event.eventType,
    label: eventLabel(event),
    note: event.note,
    actor: event.actor
      ? {
          id: event.actor.id,
          name: event.actor.fullName,
          role: event.actor.role,
        }
      : null,
    metadata: safeMetadata(event.metadata),
    createdAt: iso(event.createdAt),
    at: iso(event.createdAt),
    time: iso(event.createdAt),
  };
}

function mapEtaOverride(entry) {
  return {
    id: entry.id,
    previousMinutes: entry.previousMinutes,
    newMinutes: entry.newMinutes,
    minutes: entry.newMinutes,
    previousPromisedAt: iso(entry.previousPromisedAt),
    newPromisedAt: iso(entry.newPromisedAt),
    reason: entry.reason,
    manager: entry.manager
      ? {
          id: entry.manager.id,
          name: entry.manager.fullName,
        }
      : null,
    createdAt: iso(entry.createdAt),
  };
}

function mapManagerOrder(order, now = new Date()) {
  const items = (order.items || []).map((item) => {
    const addons = (item.addons || []).map((addon) => ({
      id: addon.id,
      name: addon.addonName,
      price: toNumber(addon.unitPrice),
      quantity: addon.quantity,
    }));

    const quantity = item.quantity || 1;
    const lineTotal = toNumber(item.lineTotal);

    return {
      id: item.id,
      itemId: item.foodItemId,
      name: item.itemName,
      qty: quantity,
      quantity,
      portion: item.portionName || "Regular",
      portionName: item.portionName,
      price:
        quantity > 0
          ? roundMoney(lineTotal / quantity)
          : toNumber(item.unitPrice),
      unitPrice: toNumber(item.unitPrice),
      lineTotal,
      preparationNote: item.preparationNote,
      instructions: item.preparationNote,
      addons: addons.map((addon) => addon.name),
      addonDetails: addons,
    };
  });

  const latestPayment = order.payments?.[0] || null;
  const latestOverride = order.etaOverrides?.[0] || null;

  const lateMilliseconds =
    order.promisedAt && now > order.promisedAt
      ? now.getTime() - order.promisedAt.getTime()
      : 0;

  const remainingMinutes =
    order.promisedAt &&
    order.status !== "HANDED_OFF" &&
    order.status !== "CANCELLED"
      ? Math.max(
          0,
          Math.ceil((order.promisedAt.getTime() - now.getTime()) / MINUTE_MS),
        )
      : 0;

  const checkoutEvent = (order.events || []).find(
    (event) => event.eventType === "CHECKOUT_DRAFT_CREATED",
  );

  const checkoutMetadata = checkoutEvent?.metadata || {};
  const estimateExplanation =
    checkoutMetadata.estimateDetails &&
    typeof checkoutMetadata.estimateDetails === "object"
      ? checkoutMetadata.estimateDetails
      : null;

  const customerNotifications = (order.notifications || [])
    .filter(
      (notification) =>
        order.customerId && notification.userId === order.customerId,
    )
    .map((notification) => ({
      id: notification.id,
      type: notification.channel,
      title: notification.title,
      label: notification.body,
      status: notification.status,
      at: iso(notification.createdAt),
    }));

  return {
    // `id` is the human-visible order number expected by the
    // existing manager UI. `orderId` is the database primary key.
    // Controller routes accept either value.
    id: order.orderNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,

    status: STATUS_LABELS[order.status] || order.status,
    rawStatus: order.status,

    customer: order.customerName,
    customerName: order.customerName,
    phone: order.customerPhone,
    customerPhone: order.customerPhone,

    fulfillmentType: order.fulfillmentType,
    fulfillmentLabel:
      order.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery",

    paymentStatus:
      PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
    rawPaymentStatus: order.paymentStatus,
    paymentMethod:
      PAYMENT_METHOD_LABELS[order.paymentMethod] ||
      order.paymentMethod ||
      latestPayment?.method ||
      null,

    amount: toNumber(order.totalAmount),
    totalAmount: toNumber(order.totalAmount),
    currency: order.currency,

    placedAt: iso(order.placedAt),
    promisedAt: iso(order.promisedAt),
    prepMinutes: order.estimatedPrepMinutes,
    estimatedPrepMinutes: order.estimatedPrepMinutes,

    startedAt: iso(order.startedAt),
    readyAt: iso(order.readyAt),
    completedPrepAt: iso(order.readyAt),
    handedOffAt: iso(order.handedOffAt),
    cancelledAt: iso(order.cancelledAt),
    updatedAt: iso(order.updatedAt),

    remainingMinutes,
    lateMinutes: Math.floor(lateMilliseconds / MINUTE_MS),
    isLate: lateMilliseconds > 0,

    instructions: order.specialInstructions,
    specialInstructions: order.specialInstructions,

    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    itemLineCount: items.length,
    itemSummary: items
      .map((item) => `${item.name} ×${item.quantity}`)
      .join(", "),
    items,

    address: order.address
      ? {
          id: order.address.id,
          recipientName: order.address.recipientName,
          phone: order.address.phone,
          label: order.address.label,
          line1: order.address.line1,
          line2: order.address.line2,
          locality: order.address.locality,
          city: order.address.city,
          state: order.address.state,
          pincode: order.address.pincode,
          landmark: order.address.landmark,
        }
      : null,

    pricing: {
      subtotal: toNumber(order.subtotal),
      couponDiscount: toNumber(order.couponDiscount),
      loyaltyDiscount: toNumber(order.loyaltyDiscount),
      deliveryFee: toNumber(order.deliveryFee),
      taxAmount: toNumber(order.taxAmount),
      gstRate: toNumber(order.gstRate),
      gstInclusive: order.gstInclusive,
      totalAmount: toNumber(order.totalAmount),
      currency: order.currency,
    },

    payment: latestPayment
      ? {
          method: latestPayment.method,
          status: latestPayment.status,
          amount: toNumber(latestPayment.amount),
          paidAt: iso(latestPayment.paidAt),
        }
      : null,

    timeline: (order.events || []).map(mapOrderEvent),

    etaOverride: latestOverride
      ? {
          id: latestOverride.id,
          minutes: latestOverride.newMinutes,
          reason: latestOverride.reason,
          previousPromisedAt: iso(latestOverride.previousPromisedAt),
          updatedAt: iso(latestOverride.createdAt),
        }
      : null,

    etaOverrides: (order.etaOverrides || []).map(mapEtaOverride),
    estimateExplanation,
    customerNotifications,
  };
}

function mapOrderListItem(order) {
  const itemCount = (order.items || []).reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return {
    id: order.orderNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: order.customerName,
    customerName: order.customerName,
    phone: order.customerPhone,
    customerPhone: order.customerPhone,
    status: STATUS_LABELS[order.status] || order.status,
    rawStatus: order.status,
    paymentStatus:
      PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
    rawPaymentStatus: order.paymentStatus,
    paymentMethod:
      PAYMENT_METHOD_LABELS[order.paymentMethod] ||
      order.paymentMethod ||
      order.payments?.[0]?.method ||
      null,
    fulfillmentType: order.fulfillmentType,
    amount: toNumber(order.totalAmount),
    totalAmount: toNumber(order.totalAmount),
    placedAt: iso(order.placedAt),
    promisedAt: iso(order.promisedAt),
    prepMinutes: order.estimatedPrepMinutes,
    estimatedPrepMinutes: order.estimatedPrepMinutes,
    itemCount,
    itemLineCount: order.items?.length || 0,
    itemSummary: (order.items || [])
      .map((item) => `${item.itemName} ×${item.quantity}`)
      .join(", "),
    updatedAt: iso(order.updatedAt),
  };
}

function mapMenuMapping(mapping) {
  const item = mapping.foodItem;

  return {
    id: item.id,
    foodItemId: item.id,
    name: item.name,
    description: item.description,
    image: item.imageUrl,
    imageUrl: item.imageUrl,
    category: item.category,
    foodType: item.foodType,
    veg: item.foodType === "VEG",
    spice: item.spiceLevel,
    spiceLevel: item.spiceLevel,
    allergens: item.allergens,
    prepTime: item.prepTimeMinutes,
    prepTimeMinutes: item.prepTimeMinutes,
    active: item.isActive,
    isActive: item.isActive,

    mapping: {
      id: mapping.id,
      outletMenuItemId: mapping.id,
      foodItemId: mapping.foodItemId,
      available: mapping.isAvailable,
      isAvailable: mapping.isAvailable,
      stockQuantity: mapping.stockQuantity,
      availabilityReason: mapping.unavailabilityReason,
      unavailabilityReason: mapping.unavailabilityReason,
      restockAt: iso(mapping.expectedRestockAt),
      expectedRestockAt: iso(mapping.expectedRestockAt),
      timeMenuLabel: mapping.timeMenuLabel,
      updatedAt: iso(mapping.updatedAt),
    },

    available: Boolean(
      mapping.isAvailable && mapping.stockQuantity > 0 && item.isActive,
    ),
  };
}

function managerOutletAddress(outlet) {
  return [
    outlet.addressLine1,
    outlet.addressLine2,
    outlet.locality,
    outlet.city?.name,
    outlet.state,
    outlet.pincode,
  ]
    .filter(Boolean)
    .join(", ");
}

/* =========================================================
   ORDER LOOKUP / NOTIFICATION HELPERS
========================================================= */

function getOrderIdentifier(req) {
  return validateId(req.params.orderId, "order ID");
}

async function findManagerOrder(
  db,
  outletId,
  orderIdentifier,
  include = MANAGER_ORDER_INCLUDE,
) {
  return db.order.findFirst({
    where: {
      outletId,
      OR: [{ id: orderIdentifier }, { orderNumber: orderIdentifier }],
    },
    include,
  });
}

function statusNotification(order, nextStatus, now) {
  if (!order.customerId) return null;

  const label = STATUS_LABELS[nextStatus] || nextStatus;

  return {
    userId: order.customerId,
    orderId: order.id,
    channel: "IN_APP",
    status: "RECORDED",
    eventKey: `order:${order.id}:status:${nextStatus}`,
    title: `Order ${order.orderNumber} update`,
    body: `Your order is now ${label}.`,
    metadata: {
      orderNumber: order.orderNumber,
      status: nextStatus,
      outletId: order.outletId,
    },
  };
}

function lateNotificationRows(order, managerId, outletName, now) {
  if (!order.promisedAt || !ACTIVE_ORDER_STATUSES.includes(order.status)) {
    return [];
  }

  const lateMilliseconds = now.getTime() - order.promisedAt.getTime();

  if (lateMilliseconds < 10 * MINUTE_MS) {
    return [];
  }

  const lateMinutes = Math.floor(lateMilliseconds / MINUTE_MS);

  const promiseVersion = order.promisedAt.getTime();

  const title = `Order ${order.orderNumber} is critically late`;

  const body =
    `${order.orderNumber} at ${outletName} is ${lateMinutes} minutes late. ` +
    `Current status: ${STATUS_LABELS[order.status]}. ` +
    `Promised time: ${formatIstTime(order.promisedAt)} IST.`;

  const rows = [
    {
      userId: managerId,
      orderId: order.id,
      channel: "IN_APP",
      status: "RECORDED",
      eventKey: `order:${order.id}:late10:${promiseVersion}:manager`,
      title,
      body,
      metadata: {
        orderNumber: order.orderNumber,
        outletId: order.outletId,
        status: order.status,
        promisedAt: order.promisedAt.toISOString(),
        lateMinutes,
      },
    },
  ];

  if (order.customerId) {
    rows.push({
      userId: order.customerId,
      orderId: order.id,
      channel: "IN_APP",
      status: "RECORDED",
      eventKey: `order:${order.id}:late10:${promiseVersion}:customer`,
      title: `Delay update for order ${order.orderNumber}`,
      body:
        `Your order is taking longer than expected. ` +
        `The current status is ${STATUS_LABELS[order.status]}. ` +
        `The previous promised time was ${formatIstTime(order.promisedAt)} IST.`,
      metadata: {
        orderNumber: order.orderNumber,
        outletId: order.outletId,
        status: order.status,
        promisedAt: order.promisedAt.toISOString(),
        lateMinutes,
      },
    });
  }

  return rows;
}

async function createNotifications(tx, rows) {
  if (!rows?.length) return;

  /*
   * createMany + skipDuplicates relies on Notification.eventKey's
   * unique constraint. Repeated requests therefore do not create
   * duplicate in-app notifications.
   */
  await tx.notification.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

async function writeManagerAudit(
  tx,
  req,
  action,
  entityType,
  entityId,
  details,
) {
  await tx.auditLog.create({
    data: {
      actorId: req.user.id,
      action,
      entityType,
      entityId,
      details,
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent")?.slice(0, 300) || null,
    },
  });
}

/* =========================================================
   1. GET WORKSPACE
   GET /api/v1/manager/workspace
========================================================= */

export const getWorkspace = managerController(async (req, res) => {
  const outletId = requireManagerOutletId(req);
  const managerId = requireManagerId(req);
  const now = new Date();

  const [
    manager,
    outlet,
    statusRows,
    lateOrders,
    totalMenuItems,
    availableMenuItems,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: managerId,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),

    prisma.outlet.findFirst({
      where: {
        id: outletId,
        managerId,
        isActive: true,
      },
      include: {
        city: {
          select: {
            name: true,
          },
        },
      },
    }),

    prisma.order.groupBy({
      by: ["status"],
      where: {
        outletId,
        paymentStatus: "SUCCEEDED",
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
      },
      _count: {
        _all: true,
      },
    }),

    prisma.order.count({
      where: {
        outletId,
        paymentStatus: "SUCCEEDED",
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
        promisedAt: {
          lt: now,
        },
      },
    }),

    prisma.outletMenuItem.count({
      where: {
        outletId,
      },
    }),

    prisma.outletMenuItem.count({
      where: {
        outletId,
        isAvailable: true,
        stockQuantity: {
          gt: 0,
        },
        foodItem: {
          isActive: true,
        },
      },
    }),
  ]);

  if (!manager || manager.role !== "OUTLET_MANAGER" || !manager.isActive) {
    throw new HttpError(
      "Manager account is unavailable.",
      403,
      "MANAGER_UNAVAILABLE",
    );
  }

  if (!outlet) {
    throw new HttpError(
      "The assigned outlet is unavailable.",
      403,
      "OUTLET_UNAVAILABLE",
    );
  }

  const statusCounts = new Map(
    statusRows.map((row) => [row.status, row._count._all]),
  );

  const newOrders = statusCounts.get("PLACED") || 0;
  const acceptedOrders = statusCounts.get("ACCEPTED") || 0;
  const preparingOrders = statusCounts.get("PREPARING") || 0;
  const readyOrders = statusCounts.get("READY") || 0;

  return success(
    res,
    {
      manager: mapManagerProfile(manager),

      outlet: {
        ...mapOutletSummary(outlet),
        address: managerOutletAddress(outlet),
      },

      operations: {
        newOrders,
        acceptedOrders,
        preparingOrders,
        readyOrders,
        lateOrders,
      },

      menu: {
        totalItems: totalMenuItems,
        availableItems: availableMenuItems,
        unavailableItems: Math.max(0, totalMenuItems - availableMenuItems),
      },

      serverTime: now.toISOString(),
      timezone: TIME_ZONE,
    },
    "Manager workspace retrieved successfully.",
  );
});

/* =========================================================
   2. GET OVERVIEW
   GET /api/v1/manager/overview
========================================================= */

export const getOverview = managerController(async (req, res) => {
  assertQueryKeys(req.query, ["from", "to", "range"]);

  const outletId = requireManagerOutletId(req);
  const now = new Date();

  const period = resolveDateRange(req.query, 1, "today");

  const baseWhere = {
    outletId,
    placedAt: {
      gte: period.from,
      lte: period.to,
    },
  };

  const paidWhere = {
    ...baseWhere,
    paymentStatus: "SUCCEEDED",
  };

  const revenueWhere = {
    ...paidWhere,
    status: {
      not: "CANCELLED",
    },
  };

  const [
    totalOrders,
    statusRows,
    revenueAggregate,
    paidOrderCount,
    activeOrders,
    lateOrders,
    preparationRows,
    promisedPreparationAggregate,
    completionRows,
    hourlyRows,
    recentOrders,
  ] = await Promise.all([
    // Includes all order records created in the period,
    // including failed checkout drafts.
    prisma.order.count({
      where: baseWhere,
    }),

    prisma.order.groupBy({
      by: ["status"],
      where: paidWhere,
      _count: {
        _all: true,
      },
    }),

    prisma.order.aggregate({
      where: revenueWhere,
      _sum: {
        totalAmount: true,
      },
    }),

    prisma.order.count({
      where: revenueWhere,
    }),

    prisma.order.count({
      where: {
        outletId,
        paymentStatus: "SUCCEEDED",
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
      },
    }),

    // Current overdue work, not historical late handoffs.
    prisma.order.count({
      where: {
        outletId,
        paymentStatus: "SUCCEEDED",
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
        promisedAt: {
          lt: now,
        },
      },
    }),

    // Order-to-ready duration, not kitchen-only duration.
    prisma.$queryRaw`
      SELECT
        ROUND(
          AVG(
            EXTRACT(
              EPOCH FROM ("ready_at" - "placed_at")
            ) / 60.0
          )
        )::int AS "averageOrderToReadyMinutes"

      FROM "orders"

      WHERE "outlet_id" = ${outletId}
        AND "placed_at" >= ${period.from}
        AND "placed_at" <= ${period.to}
        AND "payment_status" = 'SUCCEEDED'
        AND "status" = 'HANDED_OFF'
        AND "ready_at" IS NOT NULL
        AND "ready_at" >= "placed_at"
    `,

    prisma.order.aggregate({
      where: {
        ...paidWhere,
        status: "HANDED_OFF",
      },
      _avg: {
        estimatedPrepMinutes: true,
      },
    }),

    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (
          WHERE "ready_at" IS NOT NULL
        )::int AS "onTimeMeasured",

        COUNT(*) FILTER (
          WHERE "ready_at" IS NOT NULL
            AND "ready_at" <= "promised_at"
        )::int AS "completedOnTime",

        COUNT(*) FILTER (
          WHERE "ready_at" IS NOT NULL
            AND "ready_at" > "promised_at"
        )::int AS "completedLate"

      FROM "orders"

      WHERE "outlet_id" = ${outletId}
        AND "placed_at" >= ${period.from}
        AND "placed_at" <= ${period.to}
        AND "payment_status" = 'SUCCEEDED'
        AND "status" = 'HANDED_OFF'
    `,

    // Orders grouped by their India-local hour of placement.
    prisma.$queryRaw`
      SELECT
        EXTRACT(
          HOUR FROM ("placed_at" AT TIME ZONE 'Asia/Kolkata')
        )::int AS "hour",

        COUNT(*)::int AS "orders"

      FROM "orders"

      WHERE "outlet_id" = ${outletId}
        AND "placed_at" >= ${period.from}
        AND "placed_at" <= ${period.to}

      GROUP BY
        EXTRACT(
          HOUR FROM ("placed_at" AT TIME ZONE 'Asia/Kolkata')
        )

      ORDER BY "hour" ASC
    `,

    prisma.order.findMany({
      where: baseWhere,
      orderBy: {
        placedAt: "desc",
      },
      take: 7,
      include: MANAGER_ORDER_LIST_INCLUDE,
    }),
  ]);

  const counts = new Map(
    statusRows.map((row) => [row.status, row._count._all]),
  );

  const totalRevenue = roundMoney(revenueAggregate._sum.totalAmount || 0);

  const averageOrderValue = paidOrderCount
    ? roundMoney(totalRevenue / paidOrderCount)
    : 0;

  const averageOrderToReadyMinutes =
    preparationRows[0]?.averageOrderToReadyMinutes == null
      ? null
      : Number(preparationRows[0].averageOrderToReadyMinutes);

  const averagePromisedPreparationMinutes =
    promisedPreparationAggregate._avg.estimatedPrepMinutes == null
      ? null
      : Math.round(promisedPreparationAggregate._avg.estimatedPrepMinutes);

  const completion = completionRows[0] || {
    onTimeMeasured: 0,
    completedOnTime: 0,
    completedLate: 0,
  };

  const hourlyMap = new Map(
    hourlyRows.map((row) => [Number(row.hour), Number(row.orders)]),
  );

  const hourlyTrend = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: new Date(
      `2000-01-01T${String(hour).padStart(2, "0")}:00:00+05:30`,
    ).toLocaleTimeString("en-IN", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      hour12: true,
    }),
    orders: hourlyMap.get(hour) || 0,
  }));

  const statusDistribution = ORDER_STATUSES.map((status) => ({
    status,
    name: STATUS_LABELS[status],
    count: counts.get(status) || 0,
  }));

  const newOrders = counts.get("PLACED") || 0;
  const acceptedOrders = counts.get("ACCEPTED") || 0;
  const preparingOrders = counts.get("PREPARING") || 0;
  const readyOrders = counts.get("READY") || 0;
  const completedOrders = counts.get("HANDED_OFF") || 0;

  const cancelledOrders = await prisma.order.count({
    where: {
      ...baseWhere,
      status: "CANCELLED",
    },
  });

  const recent = recentOrders.map(mapOrderListItem);

  return success(
    res,
    {
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        label: period.label,
        timezone: TIME_ZONE,
      },

      ordersToday: totalOrders,
      totalOrders,

      newOrders,
      acceptedOrders,
      preparingOrders,
      readyOrders,
      completedOrders,
      cancelledOrders,
      lateOrders,

      activeOrders,

      revenueToday: totalRevenue,
      revenue: totalRevenue,
      averageOrderValue,
      paidOrders: paidOrderCount,

      averageOrderToReadyMinutes,
      averagePreparationMinutes: averageOrderToReadyMinutes,
      averagePrep: averageOrderToReadyMinutes,
      averagePromisedPreparationMinutes,

      completedOnTime: Number(completion.completedOnTime),
      completedLate: Number(completion.completedLate),
      onTimeMeasured: Number(completion.onTimeMeasured),

      hourlyTrend,
      statusDistribution,

      queue: {
        new: newOrders,
        preparing: acceptedOrders + preparingOrders,
        ready: readyOrders,
        late: lateOrders,
      },

      recentOrders: recent,
    },
    "Manager overview retrieved successfully.",
  );
});

/* =========================================================
   3. GET KITCHEN ORDERS
   GET /api/v1/manager/kitchen/orders
========================================================= */

export const getKitchenOrders = managerController(async (req, res) => {
  assertQueryKeys(req.query, [
    "status",
    "page",
    "limit",
    "search",
    "sortOrder",
  ]);

  const outletId = requireManagerOutletId(req);
  const { page, limit, skip } = parsePagination(req.query, 50);

  const search =
    req.query.search === undefined
      ? ""
      : requiredText(req.query.search, "Search", 120);

  const sortOrder =
    req.query.sortOrder === undefined
      ? "asc"
      : String(req.query.sortOrder).toLowerCase();

  if (!["asc", "desc"].includes(sortOrder)) {
    throw new HttpError("sortOrder must be asc or desc.", 400);
  }

  let selectedStatus = null;
  let filterMode = "ACTIVE";

  if (req.query.status !== undefined) {
    const rawStatus = String(req.query.status).trim();

    if (rawStatus.toLowerCase() === "all") {
      filterMode = "ALL";
    } else {
      selectedStatus = normalizeOrderStatus(rawStatus);
      filterMode = "ONE";
    }
  }

  const where = {
    outletId,
    paymentStatus: "SUCCEEDED",
  };

  if (filterMode === "ACTIVE") {
    where.status = {
      in: ACTIVE_ORDER_STATUSES,
    };
  } else if (filterMode === "ONE") {
    where.status = selectedStatus;
  }

  if (search) {
    where.OR = [
      {
        orderNumber: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        customerName: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  /*
   * Use SQL only to obtain the bounded, priority-sorted ID page.
   * Hydration and response mapping remain Prisma-based.
   *
   * Lanes are ordered:
   * PLACED → ACCEPTED/PREPARING → READY.
   */
  const [idRows, total] = await Promise.all([
    prisma.$queryRaw`
      SELECT "id"

      FROM "orders"

      WHERE "outlet_id" = ${outletId}
        AND "payment_status" = 'SUCCEEDED'

        AND (
          (
            ${filterMode} = 'ACTIVE'
            AND "status" IN (
              'PLACED',
              'ACCEPTED',
              'PREPARING',
              'READY'
            )
          )
          OR ${filterMode} = 'ALL'
          OR (
            ${filterMode} = 'ONE'
            AND "status" = ${selectedStatus || "PLACED"}
          )
        )

        AND (
          ${search} = ''
          OR "order_number" ILIKE '%' || ${search} || '%'
          OR "customer_name" ILIKE '%' || ${search} || '%'
        )

      ORDER BY
        CASE "status"
          WHEN 'PLACED' THEN 0
          WHEN 'ACCEPTED' THEN 1
          WHEN 'PREPARING' THEN 1
          WHEN 'READY' THEN 2
          WHEN 'HANDED_OFF' THEN 3
          ELSE 4
        END ASC,

        CASE
          WHEN ${sortOrder} = 'desc' THEN "placed_at"
          ELSE NULL
        END DESC,

        CASE
          WHEN ${sortOrder} = 'asc' THEN "placed_at"
          ELSE NULL
        END ASC,

        "id" ASC

      LIMIT ${limit}
      OFFSET ${skip}
    `,

    prisma.order.count({
      where,
    }),
  ]);

  const ids = idRows.map((row) => row.id);

  const fetchedOrders = ids.length
    ? await prisma.order.findMany({
        where: {
          outletId,
          id: {
            in: ids,
          },
        },
        include: MANAGER_ORDER_INCLUDE,
      })
    : [];

  const orderMap = new Map(fetchedOrders.map((order) => [order.id, order]));

  const now = new Date();

  const orders = ids
    .map((id) => orderMap.get(id))
    .filter(Boolean)
    .map((order) => mapManagerOrder(order, now));

  const lanes = {
    new: orders.filter((order) => order.rawStatus === "PLACED"),
    preparing: orders.filter((order) =>
      ["ACCEPTED", "PREPARING"].includes(order.rawStatus),
    ),
    ready: orders.filter((order) => order.rawStatus === "READY"),
  };

  return success(
    res,
    {
      orders,
      lanes,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
      serverTime: now.toISOString(),
      timezone: TIME_ZONE,
    },
    "Kitchen orders retrieved successfully.",
  );
});

/* =========================================================
   4. GET LATE ORDERS
   GET /api/v1/manager/kitchen/late-orders
========================================================= */

export const getLateOrders = managerController(async (req, res) => {
  assertQueryKeys(req.query, ["page", "limit"]);

  const outletId = requireManagerOutletId(req);
  const managerId = requireManagerId(req);
  const { page, limit, skip } = parsePagination(req.query, 20);
  const now = new Date();

  const where = {
    outletId,
    paymentStatus: "SUCCEEDED",
    status: {
      in: ACTIVE_ORDER_STATUSES,
    },
    promisedAt: {
      lt: now,
    },
  };

  const [orders, total, outlet] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [
        {
          promisedAt: "asc",
        },
        {
          placedAt: "asc",
        },
      ],
      skip,
      take: limit,
      include: {
        items: {
          select: {
            itemName: true,
            portionName: true,
            quantity: true,
            preparationNote: true,
          },
        },
        events: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          include: {
            actor: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    }),

    prisma.order.count({
      where,
    }),

    prisma.outlet.findUnique({
      where: {
        id: outletId,
      },
      select: {
        name: true,
      },
    }),
  ]);

  const orderIds = orders.map((order) => order.id);

  const recordedLateAlerts = orderIds.length
    ? await prisma.notification.findMany({
        where: {
          userId: managerId,
          orderId: {
            in: orderIds,
          },
          eventKey: {
            contains: ":late10:",
          },
        },
        select: {
          orderId: true,
          eventKey: true,
          createdAt: true,
        },
      })
    : [];

  const alertedOrderIds = new Set(
    recordedLateAlerts.map((entry) => entry.orderId),
  );

  const mapped = orders.map((order) => {
    const lateMinutes = Math.floor(
      (now.getTime() - order.promisedAt.getTime()) / MINUTE_MS,
    );

    const lastEvent = order.events[0] || null;

    return {
      id: order.orderNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customer: order.customerName,
      customerName: order.customerName,
      status: STATUS_LABELS[order.status],
      rawStatus: order.status,
      placedAt: iso(order.placedAt),
      promisedAt: iso(order.promisedAt),
      estimatedPrepMinutes: order.estimatedPrepMinutes,
      prepMinutes: order.estimatedPrepMinutes,
      lateMinutes,
      isCriticalLate: lateMinutes >= 10,
      outletName: outlet?.name || null,

      itemSummary: order.items
        .map((item) => `${item.itemName} ×${item.quantity}`)
        .join(", "),

      items: order.items.map((item) => ({
        name: item.itemName,
        portion: item.portionName,
        quantity: item.quantity,
        qty: item.quantity,
        preparationNote: item.preparationNote,
      })),

      lastEvent: lastEvent
        ? {
            id: lastEvent.id,
            eventType: lastEvent.eventType,
            fromStatus: lastEvent.fromStatus,
            toStatus: lastEvent.toStatus,
            note: lastEvent.note,
            actor: lastEvent.actor
              ? {
                  id: lastEvent.actor.id,
                  name: lastEvent.actor.fullName,
                }
              : null,
            createdAt: iso(lastEvent.createdAt),
          }
        : null,

      lateNotificationRecorded: alertedOrderIds.has(order.id),
    };
  });

  return success(
    res,
    {
      orders: mapped,
      pagination: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
      checkedAt: now.toISOString(),
    },
    "Late orders retrieved successfully.",
  );
});

/* =========================================================
   5. GET ORDER DETAILS
   GET /api/v1/manager/orders/:orderId
========================================================= */

export const getOrderDetails = managerController(async (req, res) => {
  const outletId = requireManagerOutletId(req);
  const orderIdentifier = getOrderIdentifier(req);

  const order = await findManagerOrder(prisma, outletId, orderIdentifier);

  if (!order) {
    throw new HttpError(
      "Order not found in your assigned outlet.",
      404,
      "ORDER_NOT_FOUND",
    );
  }

  return success(
    res,
    {
      order: mapManagerOrder(order),
    },
    "Order details retrieved successfully.",
  );
});

/* =========================================================
   6. UPDATE ORDER STATUS
   PATCH /api/v1/manager/orders/:orderId/status
========================================================= */

export const updateOrderStatus = managerController(async (req, res) => {
  assertObject(req.body);
  assertAllowedKeys(req.body, ["status", "note"]);

  const outletId = requireManagerOutletId(req);
  const managerId = requireManagerId(req);
  const orderIdentifier = getOrderIdentifier(req);

  const nextStatus = normalizeOrderStatus(req.body.status);

  const note =
    req.body.note === undefined || req.body.note === null
      ? null
      : requiredText(req.body.note, "Note", 500);

  if (nextStatus === "CANCELLED") {
    throw new HttpError(
      "Managers cannot cancel orders through the kitchen status workflow. Use the approved cancellation process.",
      409,
      "MANAGER_CANCELLATION_NOT_ALLOWED",
    );
  }

  const now = new Date();

  const updated = await prisma.$transaction(
    async (tx) => {
      const order = await findManagerOrder(tx, outletId, orderIdentifier, {
        items: {
          orderBy: {
            id: "asc",
          },
          include: {
            addons: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
        events: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            actor: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
        etaOverrides: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            manager: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        notifications: {
          orderBy: {
            createdAt: "desc",
          },
          take: 30,
        },
      });

      if (!order) {
        throw new HttpError(
          "Order not found in your assigned outlet.",
          404,
          "ORDER_NOT_FOUND",
        );
      }

      if (order.paymentStatus !== "SUCCEEDED") {
        throw new HttpError(
          "Only successfully paid orders can enter kitchen processing.",
          409,
          "ORDER_NOT_PAID",
        );
      }

      if (order.status === "HANDED_OFF" || order.status === "CANCELLED") {
        throw new HttpError(
          "This order is already in a terminal state.",
          409,
          "ORDER_ALREADY_FINAL",
        );
      }

      const expectedNext = STATUS_TRANSITIONS[order.status];

      if (!expectedNext || expectedNext !== nextStatus) {
        throw new HttpError(
          `Invalid transition: ${STATUS_LABELS[order.status]} cannot move to ${STATUS_LABELS[nextStatus]}.`,
          409,
          "INVALID_ORDER_TRANSITION",
        );
      }

      const updateData = {
        status: nextStatus,
      };

      if (nextStatus === "PREPARING" && !order.startedAt) {
        updateData.startedAt = now;
      }

      if (nextStatus === "READY" && !order.readyAt) {
        updateData.readyAt = now;
      }

      if (nextStatus === "HANDED_OFF" && !order.handedOffAt) {
        updateData.handedOffAt = now;
      }

      /*
       * Optimistic concurrency guard:
       * only update if the status is still the one we read.
       * Two tablets cannot both advance the same old state.
       */
      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          outletId,
          status: order.status,
          paymentStatus: "SUCCEEDED",
        },
        data: updateData,
      });

      if (changed.count !== 1) {
        throw new HttpError(
          "The order was changed by another request. Refresh the kitchen board.",
          409,
          "ORDER_STATE_CHANGED",
        );
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          actorId: managerId,
          fromStatus: order.status,
          toStatus: nextStatus,
          eventType: "ORDER_STATUS_UPDATED",
          note:
            note ||
            `Order moved from ${STATUS_LABELS[order.status]} to ${STATUS_LABELS[nextStatus]}.`,
          metadata: {
            source: "MANAGER_DASHBOARD",
          },
        },
      });

      const notifications = [];

      const customerStatusNotification = statusNotification(
        order,
        nextStatus,
        now,
      );

      if (customerStatusNotification) {
        notifications.push(customerStatusNotification);
      }

      const outlet = await tx.outlet.findUnique({
        where: {
          id: outletId,
        },
        select: {
          name: true,
        },
      });

      notifications.push(
        ...lateNotificationRows(
          {
            ...order,
            status: nextStatus,
          },
          managerId,
          outlet?.name || "your outlet",
          now,
        ),
      );

      await createNotifications(tx, notifications);

      const freshOrder = await tx.order.findFirst({
        where: {
          id: order.id,
          outletId,
        },
        include: MANAGER_ORDER_INCLUDE,
      });

      return freshOrder;
    },
    {
      isolationLevel: "Serializable",
    },
  );

  try {
    emitOrderStatusUpdated({
      outletId,
      customerId: updated.customerId,
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
      updatedAt: updated.updatedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Failed to emit order:status-updated:", error.message);
  }
  return success(
    res,
    {
      order: mapManagerOrder(updated, now),
      latestEvent: updated.events?.length
        ? mapOrderEvent(updated.events[updated.events.length - 1])
        : null,
    },
    "Order status updated successfully.",
  );
});

/* =========================================================
   7. OVERRIDE ORDER ETA
   PATCH /api/v1/manager/orders/:orderId/eta
========================================================= */

export const overrideOrderEta = managerController(async (req, res) => {
  assertObject(req.body);

  assertAllowedKeys(req.body, ["estimatedPrepMinutes", "minutes", "reason"]);

  const outletId = requireManagerOutletId(req);
  const managerId = requireManagerId(req);
  const orderIdentifier = getOrderIdentifier(req);

  if (
    req.body.estimatedPrepMinutes !== undefined &&
    req.body.minutes !== undefined
  ) {
    throw new HttpError(
      "Send either minutes or estimatedPrepMinutes, not both.",
      400,
    );
  }

  const requestedMinutes = req.body.estimatedPrepMinutes ?? req.body.minutes;

  const reason = requiredText(req.body.reason, "Reason", 250);

  const now = new Date();

  const result = await prisma.$transaction(
    async (tx) => {
      const order = await findManagerOrder(tx, outletId, orderIdentifier, {
        items: {
          orderBy: {
            id: "asc",
          },
          include: {
            addons: true,
          },
        },
        events: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            actor: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
        etaOverrides: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            manager: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        notifications: {
          orderBy: {
            createdAt: "desc",
          },
          take: 30,
        },
      });

      if (!order) {
        throw new HttpError(
          "Order not found in your assigned outlet.",
          404,
          "ORDER_NOT_FOUND",
        );
      }

      if (
        order.paymentStatus !== "SUCCEEDED" ||
        !["ACCEPTED", "PREPARING"].includes(order.status)
      ) {
        throw new HttpError(
          "ETA can only be overridden for paid orders that are accepted or being prepared.",
          409,
          "ETA_OVERRIDE_NOT_ALLOWED",
        );
      }

      const outlet = await tx.outlet.findFirst({
        where: {
          id: outletId,
          managerId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          minimumPrepMinutes: true,
        },
      });

      if (!outlet) {
        throw new HttpError(
          "The assigned outlet is unavailable.",
          403,
          "OUTLET_UNAVAILABLE",
        );
      }

      const newMinutes = positiveInteger(
        requestedMinutes,
        "Estimated preparation minutes",
        outlet.minimumPrepMinutes,
        240,
      );

      if (newMinutes === order.estimatedPrepMinutes) {
        throw new HttpError(
          "The new estimate must be different from the current estimate.",
          400,
          "ETA_UNCHANGED",
        );
      }

      /*
       * Checkout initially sets promisedAt = placedAt + estimate.
       * Keep that total-from-placement meaning consistent here.
       */
      const newPromisedAt = new Date(
        order.placedAt.getTime() + newMinutes * MINUTE_MS,
      );

      const previousMinutes = order.estimatedPrepMinutes;
      const previousPromisedAt = order.promisedAt;

      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          outletId,
          status: order.status,
          paymentStatus: "SUCCEEDED",
          estimatedPrepMinutes: previousMinutes,
          promisedAt: previousPromisedAt,
        },
        data: {
          estimatedPrepMinutes: newMinutes,
          promisedAt: newPromisedAt,
        },
      });

      if (changed.count !== 1) {
        throw new HttpError(
          "The order ETA was changed by another request. Refresh and try again.",
          409,
          "ORDER_ETA_CHANGED",
        );
      }

      const etaOverride = await tx.etaOverride.create({
        data: {
          orderId: order.id,
          managerId,
          previousMinutes,
          newMinutes,
          previousPromisedAt,
          newPromisedAt,
          reason,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          actorId: managerId,
          fromStatus: order.status,
          toStatus: order.status,
          eventType: "ETA_OVERRIDDEN",
          note: reason,
          metadata: {
            previousMinutes,
            newMinutes,
            previousPromisedAt: previousPromisedAt.toISOString(),
            newPromisedAt: newPromisedAt.toISOString(),
          },
        },
      });

      const notificationRows = [];

      if (order.customerId) {
        notificationRows.push({
          userId: order.customerId,
          orderId: order.id,
          channel: "IN_APP",
          status: "RECORDED",
          eventKey: `order:${order.id}:eta:${etaOverride.id}`,
          title: `Preparation estimate updated for ${order.orderNumber}`,
          body:
            `The estimated preparation time is now ${newMinutes} minutes. ` +
            `The updated expected ready time is ${formatIstTime(newPromisedAt)} IST.`,
          metadata: {
            orderNumber: order.orderNumber,
            previousMinutes,
            newMinutes,
            promisedAt: newPromisedAt.toISOString(),
            outletId,
          },
        });
      }

      notificationRows.push(
        ...lateNotificationRows(
          {
            ...order,
            promisedAt: newPromisedAt,
          },
          managerId,
          outlet.name,
          now,
        ),
      );

      await createNotifications(tx, notificationRows);

      const freshOrder = await tx.order.findFirst({
        where: {
          id: order.id,
          outletId,
        },
        include: MANAGER_ORDER_INCLUDE,
      });

      return {
        freshOrder,
        etaOverride,
        previousMinutes,
        previousPromisedAt,
        newMinutes,
        newPromisedAt,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );

  try {
    emitOrderEtaUpdated({
      outletId,
      customerId: result.freshOrder.customerId,
      orderId: result.freshOrder.id,
      orderNumber: result.freshOrder.orderNumber,
      estimatedPrepMinutes: result.newMinutes,
      promisedAt: result.newPromisedAt.toISOString(),
      updatedAt: result.freshOrder.updatedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Failed to emit order:eta-updated:", error.message);
  }
  return success(
    res,
    {
      orderId: result.freshOrder.id,
      orderNumber: result.freshOrder.orderNumber,
      previousEstimatedPrepMinutes: result.previousMinutes,
      estimatedPrepMinutes: result.newMinutes,
      previousPromisedAt: result.previousPromisedAt.toISOString(),
      promisedAt: result.newPromisedAt.toISOString(),
      reason,
      updatedAt: result.freshOrder.updatedAt.toISOString(),
      etaOverride: mapEtaOverride({
        ...result.etaOverride,
        manager: {
          id: managerId,
          fullName: req.user.name,
        },
      }),
      order: mapManagerOrder(result.freshOrder, now),
    },
    "Order ETA updated successfully.",
  );
});

/* =========================================================
   8. GET ORDERS
   GET /api/v1/manager/orders
========================================================= */

export const getOrders = managerController(async (req, res) => {
  assertQueryKeys(req.query, [
    "page",
    "limit",
    "status",
    "paymentStatus",
    "paymentMethod",
    "fulfillmentType",
    "search",
    "from",
    "to",
    "sortBy",
    "sortOrder",
    "scope",
  ]);

  const outletId = requireManagerOutletId(req);
  const { page, limit, skip } = parsePagination(req.query, 20);

  const where = {
    outletId,
  };

  let statusFilter;

  if (
    req.query.status !== undefined &&
    String(req.query.status).toLowerCase() !== "all"
  ) {
    statusFilter = normalizeOrderStatus(req.query.status);
  }

  const scope =
    req.query.scope === undefined
      ? "all"
      : String(req.query.scope).trim().toLowerCase();

  if (!["all", "active", "completed", "cancelled"].includes(scope)) {
    throw new HttpError(
      "scope must be all, active, completed, or cancelled.",
      400,
    );
  }

  if (scope === "active") {
    where.paymentStatus = "SUCCEEDED";

    if (statusFilter) {
      where.AND = [
        {
          status: statusFilter,
        },
        {
          status: {
            in: ACTIVE_ORDER_STATUSES,
          },
        },
      ];
    } else {
      where.status = {
        in: ACTIVE_ORDER_STATUSES,
      };
    }
  } else if (scope === "completed") {
    where.status = "HANDED_OFF";
  } else if (scope === "cancelled") {
    where.status = "CANCELLED";
  } else if (statusFilter) {
    where.status = statusFilter;
  }

  if (req.query.paymentStatus !== undefined) {
    where.paymentStatus = normalizePaymentStatus(req.query.paymentStatus);
  }

  if (req.query.paymentMethod !== undefined) {
    where.paymentMethod = normalizePaymentMethod(req.query.paymentMethod);
  }

  if (req.query.fulfillmentType !== undefined) {
    where.fulfillmentType = normalizeFulfillmentType(req.query.fulfillmentType);
  }

  if (req.query.search !== undefined) {
    const search = requiredText(req.query.search, "Search", 120);

    where.OR = [
      {
        orderNumber: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        customerName: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (req.query.from !== undefined || req.query.to !== undefined) {
    if (!req.query.from || !req.query.to) {
      throw new HttpError("Both from and to dates are required.", 400);
    }

    const from = parseDateOnly(req.query.from, "From date");
    const to = parseDateOnly(req.query.to, "To date", true);

    if (from > to) {
      throw new HttpError("The from date must not be after the to date.", 400);
    }

    where.placedAt = {
      gte: from,
      lte: to,
    };
  }

  const sortBy =
    req.query.sortBy === undefined ? "placedAt" : String(req.query.sortBy);

  const sortOrder =
    req.query.sortOrder === undefined
      ? "desc"
      : String(req.query.sortOrder).toLowerCase();

  const allowedSortFields = [
    "placedAt",
    "updatedAt",
    "promisedAt",
    "totalAmount",
  ];

  if (!allowedSortFields.includes(sortBy)) {
    throw new HttpError(
      `sortBy must be one of: ${allowedSortFields.join(", ")}.`,
      400,
    );
  }

  if (!["asc", "desc"].includes(sortOrder)) {
    throw new HttpError("sortOrder must be asc or desc.", 400);
  }

  const orderBy = [
    {
      [sortBy]: sortOrder,
    },
    {
      id: "asc",
    },
  ];

  const [orders, totalItems] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: MANAGER_ORDER_LIST_INCLUDE,
    }),

    prisma.order.count({
      where,
    }),
  ]);

  return success(
    res,
    {
      orders: orders.map(mapOrderListItem),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPreviousPage: page > 1,
      },
    },
    "Outlet orders retrieved successfully.",
  );
});

/* =========================================================
   9. GET ORDER TIMELINE
   GET /api/v1/manager/orders/:orderId/timeline
========================================================= */

export const getOrderTimeline = managerController(async (req, res) => {
  const outletId = requireManagerOutletId(req);
  const orderIdentifier = getOrderIdentifier(req);

  const order = await prisma.order.findFirst({
    where: {
      outletId,
      OR: [{ id: orderIdentifier }, { orderNumber: orderIdentifier }],
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,

      events: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
      },

      etaOverrides: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          manager: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new HttpError(
      "Order not found in your assigned outlet.",
      404,
      "ORDER_NOT_FOUND",
    );
  }

  return success(
    res,
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      currentStatus: order.status,
      currentStatusLabel: STATUS_LABELS[order.status],
      events: order.events.map(mapOrderEvent),
      etaOverrides: order.etaOverrides.map(mapEtaOverride),
    },
    "Order timeline retrieved successfully.",
  );
});

/* =========================================================
   10. GET MENU AVAILABILITY
   GET /api/v1/manager/menu-availability
========================================================= */

export const getMenuAvailability = managerController(async (req, res) => {
  assertQueryKeys(req.query, [
    "page",
    "limit",
    "search",
    "category",
    "foodType",
    "isAvailable",
  ]);

  const outletId = requireManagerOutletId(req);
  const { page, limit, skip } = parsePagination(req.query, 20);

  const where = {
    outletId,
  };

  if (req.query.search !== undefined) {
    const search = requiredText(req.query.search, "Search", 120);

    where.foodItem = {
      ...(where.foodItem || {}),
      name: {
        contains: search,
        mode: "insensitive",
      },
    };
  }

  if (req.query.category !== undefined) {
    const category = requiredText(req.query.category, "Category", 80);

    where.foodItem = {
      ...(where.foodItem || {}),
      category: {
        equals: category,
        mode: "insensitive",
      },
    };
  }

  if (req.query.foodType !== undefined) {
    const foodType = normalizeEnum(
      req.query.foodType,
      ["VEG", "NON_VEG"],
      "food type",
      {
        veg: "VEG",
        vegetarian: "VEG",
        nonveg: "NON_VEG",
        "non-veg": "NON_VEG",
        "non vegetarian": "NON_VEG",
      },
    );

    where.foodItem = {
      ...(where.foodItem || {}),
      foodType,
    };
  }

  if (req.query.isAvailable !== undefined) {
    where.isAvailable = parseBooleanQuery(req.query.isAvailable, "isAvailable");
  }

  const [mappings, totalItems, allMappings, availableItems] = await Promise.all(
    [
      prisma.outletMenuItem.findMany({
        where,
        include: {
          foodItem: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              category: true,
              foodType: true,
              spiceLevel: true,
              allergens: true,
              prepTimeMinutes: true,
              isActive: true,
            },
          },
        },
        orderBy: [
          {
            foodItem: {
              name: "asc",
            },
          },
          {
            id: "asc",
          },
        ],
        skip,
        take: limit,
      }),

      prisma.outletMenuItem.count({
        where,
      }),

      prisma.outletMenuItem.count({
        where: {
          outletId,
        },
      }),

      prisma.outletMenuItem.count({
        where: {
          outletId,
          isAvailable: true,
          stockQuantity: {
            gt: 0,
          },
          foodItem: {
            isActive: true,
          },
        },
      }),
    ],
  );

  return success(
    res,
    {
      menuItems: mappings.map(mapMenuMapping),

      summary: {
        totalItems: allMappings,
        availableItems,
        unavailableItems: Math.max(0, allMappings - availableItems),
      },

      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
        hasPreviousPage: page > 1,
      },
    },
    "Outlet menu availability retrieved successfully.",
  );
});

/* =========================================================
   11. UPDATE MENU AVAILABILITY
   PATCH /api/v1/manager/menu-availability/:itemId
========================================================= */

export const updateMenuAvailability = managerController(async (req, res) => {
  assertObject(req.body);

  assertAllowedKeys(req.body, [
    "isAvailable",
    "unavailabilityReason",
    "expectedRestockAt",

    // Compatibility with the current manager UI:
    // { available, reason, restockAt }
    "available",
    "reason",
    "restockAt",
  ]);

  const outletId = requireManagerOutletId(req);
  const managerId = requireManagerId(req);

  /*
   * The existing UI passes item.id from the menu item, which is
   * the central FoodItem.id. The lookup below therefore uses
   * foodItemId + outletId, not an arbitrary mapping ID.
   */
  const foodItemId = validateId(req.params.itemId, "food item ID");

  if (req.body.isAvailable !== undefined && req.body.available !== undefined) {
    throw new HttpError("Send either isAvailable or available, not both.", 400);
  }

  const availabilityValue = req.body.isAvailable ?? req.body.available;

  if (typeof availabilityValue !== "boolean") {
    throw new HttpError("isAvailable must be true or false.", 400);
  }

  if (
    req.body.unavailabilityReason !== undefined &&
    req.body.reason !== undefined
  ) {
    throw new HttpError(
      "Send either unavailabilityReason or reason, not both.",
      400,
    );
  }

  if (
    req.body.expectedRestockAt !== undefined &&
    req.body.restockAt !== undefined
  ) {
    throw new HttpError(
      "Send either expectedRestockAt or restockAt, not both.",
      400,
    );
  }

  const reasonValue =
    req.body.unavailabilityReason !== undefined
      ? req.body.unavailabilityReason
      : req.body.reason;

  const restockValue =
    req.body.expectedRestockAt !== undefined
      ? req.body.expectedRestockAt
      : req.body.restockAt;

  const reason = optionalText(reasonValue, "Unavailability reason", 120);

  const restockAt =
    restockValue === undefined ? undefined : parseRestockDate(restockValue);

  const updated = await prisma.$transaction(async (tx) => {
    const mapping = await tx.outletMenuItem.findFirst({
      where: {
        outletId,
        foodItemId,
      },
      include: {
        foodItem: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            category: true,
            foodType: true,
            spiceLevel: true,
            allergens: true,
            prepTimeMinutes: true,
            isActive: true,
          },
        },
      },
    });

    if (!mapping) {
      throw new HttpError(
        "This food item is not mapped to your assigned outlet.",
        404,
        "OUTLET_MENU_MAPPING_NOT_FOUND",
      );
    }

    if (availabilityValue && !mapping.foodItem.isActive) {
      throw new HttpError(
        "This food item is inactive in the central catalog and cannot be enabled by an outlet manager.",
        409,
        "CENTRAL_FOOD_ITEM_INACTIVE",
      );
    }

    const updateData = {
      isAvailable: availabilityValue,
      unavailabilityReason: availabilityValue
        ? null
        : reason !== undefined
          ? reason
          : mapping.unavailabilityReason,
      expectedRestockAt: availabilityValue
        ? null
        : restockAt !== undefined
          ? restockAt
          : mapping.expectedRestockAt,
    };

    const changed = await tx.outletMenuItem.updateMany({
      where: {
        id: mapping.id,
        outletId,
        foodItemId,
      },
      data: updateData,
    });

    if (changed.count !== 1) {
      throw new HttpError(
        "The menu mapping changed before the update completed. Refresh and try again.",
        409,
        "MENU_MAPPING_CHANGED",
      );
    }

    await writeManagerAudit(
      tx,
      req,
      "MANAGER_MENU_AVAILABILITY_UPDATED",
      "OutletMenuItem",
      mapping.id,
      {
        outletId,
        foodItemId,
        foodItemName: mapping.foodItem.name,
        previous: {
          isAvailable: mapping.isAvailable,
          unavailabilityReason: mapping.unavailabilityReason,
          expectedRestockAt: iso(mapping.expectedRestockAt),
        },
        next: {
          isAvailable: updateData.isAvailable,
          unavailabilityReason: updateData.unavailabilityReason,
          expectedRestockAt: iso(updateData.expectedRestockAt),
        },
      },
    );

    return tx.outletMenuItem.findFirst({
      where: {
        id: mapping.id,
        outletId,
      },
      include: {
        foodItem: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            category: true,
            foodType: true,
            spiceLevel: true,
            allergens: true,
            prepTimeMinutes: true,
            isActive: true,
          },
        },
      },
    });
  });

  try {
    emitMenuAvailabilityUpdated({
      outletId,
      foodItemId: updated.foodItemId,
      isAvailable: updated.isAvailable,
      stockQuantity: updated.stockQuantity,
      updatedAt: updated.updatedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Failed to emit menu:availability-updated:", error.message);
  }
  return success(
    res,
    {
      menuItem: mapMenuMapping(updated),
    },
    "Menu availability updated successfully.",
  );
});

/* =========================================================
   12. GET PERFORMANCE
   GET /api/v1/manager/performance
========================================================= */

export const getPerformance = managerController(async (req, res) => {
  assertQueryKeys(req.query, ["from", "to", "range"]);

  const outletId = requireManagerOutletId(req);
  const now = new Date();

  const period = resolveDateRange(req.query, 7, "7d");

  const baseWhere = {
    outletId,
    placedAt: {
      gte: period.from,
      lte: period.to,
    },
  };

  const paidWhere = {
    ...baseWhere,
    paymentStatus: "SUCCEEDED",
  };

  const revenueWhere = {
    ...paidWhere,
    status: {
      not: "CANCELLED",
    },
  };

  const [
    totalOrders,
    completedOrders,
    cancelledOrders,
    revenueAggregate,
    paidOrderCount,
    completedTimingRows,
    activeLateOrders,
    dailyTrendRows,
    popularItemRows,
    overrides,
    orderStatusRows,
    lateDelayRows,
    promisedPreparationAggregate,
  ] = await Promise.all([
    prisma.order.count({
      where: baseWhere,
    }),

    prisma.order.count({
      where: {
        ...paidWhere,
        status: "HANDED_OFF",
      },
    }),

    prisma.order.count({
      where: {
        ...baseWhere,
        status: "CANCELLED",
      },
    }),

    prisma.order.aggregate({
      where: revenueWhere,
      _sum: {
        totalAmount: true,
      },
    }),

    prisma.order.count({
      where: revenueWhere,
    }),

    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (
          WHERE "ready_at" IS NOT NULL
        )::int AS "onTimeMeasured",

        COUNT(*) FILTER (
          WHERE "ready_at" IS NOT NULL
            AND "ready_at" <= "promised_at"
        )::int AS "onTime",

        COUNT(*) FILTER (
          WHERE "ready_at" IS NOT NULL
            AND "ready_at" > "promised_at"
        )::int AS "completedLate",

        ROUND(
          AVG(
            CASE
              WHEN "ready_at" IS NOT NULL
               AND "ready_at" >= "placed_at"
              THEN EXTRACT(
                EPOCH FROM ("ready_at" - "placed_at")
              ) / 60.0
              ELSE NULL
            END
          )
        )::int AS "averageOrderToReadyMinutes"

      FROM "orders"

      WHERE "outlet_id" = ${outletId}
        AND "placed_at" >= ${period.from}
        AND "placed_at" <= ${period.to}
        AND "payment_status" = 'SUCCEEDED'
        AND "status" = 'HANDED_OFF'
    `,

    // Active overdue orders inside the selected period.
    prisma.order.count({
      where: {
        ...paidWhere,
        status: {
          in: ACTIVE_ORDER_STATUSES,
        },
        promisedAt: {
          lt: now,
        },
      },
    }),

    prisma.$queryRaw`
      SELECT
        DATE(
          "placed_at" AT TIME ZONE 'Asia/Kolkata'
        )::text AS "date",

        COUNT(*)::int AS "orders",

        COUNT(*) FILTER (
          WHERE "payment_status" = 'SUCCEEDED'
            AND "status" = 'HANDED_OFF'
        )::int AS "completedOrders",

        COUNT(*) FILTER (
          WHERE "status" = 'CANCELLED'
        )::int AS "cancelledOrders",

        COALESCE(
          SUM(
            CASE
              WHEN "payment_status" = 'SUCCEEDED'
               AND "status" <> 'CANCELLED'
              THEN "total_amount"
              ELSE 0
            END
          ),
          0
        )::float AS "revenue",

        ROUND(
          AVG(
            CASE
              WHEN "payment_status" = 'SUCCEEDED'
               AND "status" = 'HANDED_OFF'
               AND "ready_at" IS NOT NULL
               AND "ready_at" >= "placed_at"
              THEN EXTRACT(
                EPOCH FROM ("ready_at" - "placed_at")
              ) / 60.0
              ELSE NULL
            END
          )
        )::int AS "averageOrderToReadyMinutes"

      FROM "orders"

      WHERE "outlet_id" = ${outletId}
        AND "placed_at" >= ${period.from}
        AND "placed_at" <= ${period.to}

      GROUP BY DATE(
        "placed_at" AT TIME ZONE 'Asia/Kolkata'
      )

      ORDER BY "date" ASC
    `,

    // Item snapshots preserve historical names and line totals.
    prisma.$queryRaw`
      SELECT
        oi."item_name" AS "name",

        SUM(oi."quantity")::int AS "quantity",

        COUNT(DISTINCT o."id")::int AS "orderCount",

        COALESCE(
          SUM(oi."line_total"),
          0
        )::float AS "revenue"

      FROM "order_items" oi

      INNER JOIN "orders" o
        ON o."id" = oi."order_id"

      WHERE o."outlet_id" = ${outletId}
        AND o."placed_at" >= ${period.from}
        AND o."placed_at" <= ${period.to}
        AND o."payment_status" = 'SUCCEEDED'
        AND o."status" <> 'CANCELLED'

      GROUP BY oi."item_name"

      ORDER BY
        SUM(oi."quantity") DESC,
        oi."item_name" ASC

      LIMIT 6
    `,

    prisma.etaOverride.count({
      where: {
        order: {
          is: {
            outletId,
            placedAt: {
              gte: period.from,
              lte: period.to,
            },
          },
        },
      },
    }),

    prisma.order.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: {
        _all: true,
      },
    }),

    /*
     * Average delay combines:
     * - current lateness for still-active orders;
     * - actual readyAt - promisedAt for late completed orders.
     */
    prisma.$queryRaw`
      SELECT
        ROUND(
          AVG("delayMinutes")
        )::int AS "averageDelay"

      FROM (
        SELECT
          GREATEST(
            0,
            EXTRACT(
              EPOCH FROM (${now} - "promised_at")
            ) / 60.0
          ) AS "delayMinutes"

        FROM "orders"

        WHERE "outlet_id" = ${outletId}
          AND "placed_at" >= ${period.from}
          AND "placed_at" <= ${period.to}
          AND "payment_status" = 'SUCCEEDED'
          AND "status" IN (
            'PLACED',
            'ACCEPTED',
            'PREPARING',
            'READY'
          )
          AND "promised_at" < ${now}

        UNION ALL

        SELECT
          EXTRACT(
            EPOCH FROM ("ready_at" - "promised_at")
          ) / 60.0 AS "delayMinutes"

        FROM "orders"

        WHERE "outlet_id" = ${outletId}
          AND "placed_at" >= ${period.from}
          AND "placed_at" <= ${period.to}
          AND "payment_status" = 'SUCCEEDED'
          AND "status" = 'HANDED_OFF'
          AND "ready_at" IS NOT NULL
          AND "ready_at" > "promised_at"
      ) AS late_delays
    `,

    prisma.order.aggregate({
      where: paidWhere,
      _avg: {
        estimatedPrepMinutes: true,
      },
    }),
  ]);

  const revenue = roundMoney(revenueAggregate._sum.totalAmount || 0);

  const averageOrderValue = paidOrderCount
    ? roundMoney(revenue / paidOrderCount)
    : 0;

  const timing = completedTimingRows[0] || {
    onTimeMeasured: 0,
    onTime: 0,
    completedLate: 0,
    averageOrderToReadyMinutes: null,
  };

  const currentStatusMap = new Map(
    orderStatusRows.map((row) => [row.status, row._count._all]),
  );

  const activeOrders = await prisma.order.count({
    where: {
      outletId,
      paymentStatus: "SUCCEEDED",
      status: {
        in: ACTIVE_ORDER_STATUSES,
      },
    },
  });

  const activeLate = activeLateOrders;
  const completedLate = Number(timing.completedLate || 0);

  const dailyTrend = dailyTrendRows.map((row) => ({
    date: row.date,
    label: formatTrendLabel(row.date),
    orders: Number(row.orders),
    revenue: roundMoney(row.revenue),
    completedOrders: Number(row.completedOrders),
    cancelledOrders: Number(row.cancelledOrders),
    avgPrep:
      row.averageOrderToReadyMinutes == null
        ? null
        : Number(row.averageOrderToReadyMinutes),
  }));

  const popular = popularItemRows.map((row, index) => ({
    id: `${row.name}-${index}`,
    name: row.name,
    quantity: Number(row.quantity),
    orderCount: Number(row.orderCount),
    revenue: roundMoney(row.revenue),
  }));

  const averagePromisedPreparationMinutes =
    promisedPreparationAggregate._avg.estimatedPrepMinutes == null
      ? null
      : Math.round(promisedPreparationAggregate._avg.estimatedPrepMinutes);

  const averageOrderToReadyMinutes =
    timing.averageOrderToReadyMinutes == null
      ? null
      : Number(timing.averageOrderToReadyMinutes);

  return success(
    res,
    {
      period: {
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        label: period.label,
        timezone: TIME_ZONE,
      },

      totalOrders,
      completedOrders,
      cancelledOrders,

      activeOrders,

      lateOrders: activeLate + completedLate,

      revenue,
      paidOrders: paidOrderCount,
      averageOrderValue,

      averagePrep: averageOrderToReadyMinutes,
      averagePreparation: averageOrderToReadyMinutes,
      averageOrderToReadyMinutes,
      averagePromisedPreparationMinutes,

      onTime: Number(timing.onTime || 0),
      onTimeMeasured: Number(timing.onTimeMeasured || 0),
      averageDelay:
        lateDelayRows[0]?.averageDelay == null
          ? null
          : Number(lateDelayRows[0].averageDelay),

      overrides,

      statusDistribution: ORDER_STATUSES.map((status) => ({
        status: STATUS_LABELS[status],
        rawStatus: status,
        count: currentStatusMap.get(status) || 0,
      })),

      trend: dailyTrend,
      popular,
    },
    "Outlet performance retrieved successfully.",
  );
});

/* =========================================================
   13. GET ACCOUNT
   GET /api/v1/manager/account
========================================================= */

export const getAccount = managerController(async (req, res) => {
  const managerId = requireManagerId(req);
  const outletId = requireManagerOutletId(req);

  const manager = await prisma.user.findUnique({
    where: {
      id: managerId,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      phoneVerifiedAt: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,

      managedOutlet: {
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          locality: true,
          isActive: true,
          openingTime: true,
          closingTime: true,
          city: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!manager || manager.role !== "OUTLET_MANAGER") {
    throw new HttpError("Manager account not found.", 404, "MANAGER_NOT_FOUND");
  }

  if (!manager.managedOutlet || manager.managedOutlet.id !== outletId) {
    throw new HttpError(
      "The assigned outlet could not be verified.",
      403,
      "OUTLET_ASSIGNMENT_MISMATCH",
    );
  }

  const outlet = manager.managedOutlet;

  return success(
    res,
    {
      manager: mapManagerProfile(manager),

      outlet: {
        id: outlet.id,
        name: outlet.name,
        code: outlet.code,
        type: outlet.type,
        city: outlet.city?.name || null,
        locality: outlet.locality,
        active: outlet.isActive,
        isActive: outlet.isActive,
        openTime: outlet.openingTime,
        closeTime: outlet.closingTime,
      },
    },
    "Manager account retrieved successfully.",
  );
});

/* =========================================================
   14. UPDATE ACCOUNT
   PATCH /api/v1/manager/account
========================================================= */

export const updateAccount = managerController(async (req, res) => {
  assertObject(req.body);

  assertAllowedKeys(req.body, ["fullName", "email", "avatarUrl"]);

  const managerId = requireManagerId(req);
  const outletId = requireManagerOutletId(req);

  const keys = Object.keys(req.body);

  if (!keys.length) {
    throw new HttpError("Provide at least one profile field to update.", 400);
  }

  const updateData = {};

  if (req.body.fullName !== undefined) {
    updateData.fullName = requiredText(req.body.fullName, "Full name", 120);
  }

  if (req.body.email !== undefined) {
    if (req.body.email === null || req.body.email === "") {
      updateData.email = null;
    } else {
      if (typeof req.body.email !== "string") {
        throw new HttpError("Email must be a string or null.", 400);
      }

      const email = req.body.email.trim().toLowerCase();

      if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        throw new HttpError("Enter a valid email address.", 400);
      }

      updateData.email = email;
    }
  }

  if (req.body.avatarUrl !== undefined) {
    if (req.body.avatarUrl === null || req.body.avatarUrl === "") {
      updateData.avatarUrl = null;
    } else {
      if (
        typeof req.body.avatarUrl !== "string" ||
        req.body.avatarUrl.trim().length > 2048
      ) {
        throw new HttpError(
          "Avatar URL must be a valid HTTP or HTTPS URL.",
          400,
        );
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(req.body.avatarUrl.trim());
      } catch {
        throw new HttpError(
          "Avatar URL must be a valid HTTP or HTTPS URL.",
          400,
        );
      }

      if (
        !["http:", "https:"].includes(parsedUrl.protocol) ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        throw new HttpError(
          "Avatar URL must use HTTP or HTTPS and cannot contain credentials.",
          400,
        );
      }

      updateData.avatarUrl = parsedUrl.toString();
    }
  }

  const updatedManager = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: {
        id: managerId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
    });

    if (!current || current.role !== "OUTLET_MANAGER" || !current.isActive) {
      throw new HttpError(
        "Manager account is unavailable.",
        403,
        "MANAGER_UNAVAILABLE",
      );
    }

    /*
     * A changed email becomes unverified.
     * The manager cannot manually set emailVerifiedAt.
     */
    if (
      Object.hasOwn(updateData, "email") &&
      updateData.email !== current.email
    ) {
      updateData.emailVerifiedAt = null;
    }

    const updated = await tx.user.update({
      where: {
        id: managerId,
      },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeManagerAudit(
      tx,
      req,
      "MANAGER_PROFILE_UPDATED",
      "User",
      managerId,
      {
        outletId,
        previous: {
          fullName: current.fullName,
          email: current.email,
          avatarUrl: current.avatarUrl,
        },
        next: {
          fullName: updated.fullName,
          email: updated.email,
          avatarUrl: updated.avatarUrl,
        },
      },
    );

    return updated;
  });

  const outlet = await prisma.outlet.findFirst({
    where: {
      id: outletId,
      managerId,
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      locality: true,
      isActive: true,
      openingTime: true,
      closingTime: true,
      city: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!outlet) {
    throw new HttpError(
      "The assigned outlet could not be verified.",
      403,
      "OUTLET_ASSIGNMENT_MISMATCH",
    );
  }

  return success(
    res,
    {
      manager: mapManagerProfile(updatedManager),
      outlet: {
        id: outlet.id,
        name: outlet.name,
        code: outlet.code,
        type: outlet.type,
        city: outlet.city?.name || null,
        locality: outlet.locality,
        active: outlet.isActive,
        openTime: outlet.openingTime,
        closeTime: outlet.closingTime,
      },
    },
    "Manager profile updated successfully.",
  );
});
