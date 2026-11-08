import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError, validateId } from "../utils/customerDomain.js";

/* =========================================================
   CONSTANTS
========================================================= */

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

const PAYMENT_METHODS = [
  "UPI",
  "CARD",
  "CASH",
  "WALLET",
  "OTHER",
];

const FULFILLMENT_TYPES = [
  "DELIVERY",
  "PICKUP",
];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const SORT_FIELDS = new Set([
  "placedAt",
  "createdAt",
  "updatedAt",
  "promisedAt",
  "totalAmount",
  "orderNumber",
  "status",
  "paymentStatus",
]);

const ORDER_STATUS_LABELS = {
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

const FULFILLMENT_LABELS = {
  DELIVERY: "Delivery",
  PICKUP: "Pickup",
};

/* =========================================================
   COMMON HELPERS
========================================================= */

function success(res, data, message) {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
}

function decimalToNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function toIso(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toTimeLabel(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toDateLabel(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normaliseLabel(value, labels) {
  return labels[value] || value || null;
}

function validateEnum(value, allowedValues, field) {
  if (typeof value !== "string") {
    throw new HttpError(`Invalid ${field} filter.`, 400);
  }

  const normalized = value.trim().toUpperCase();

  if (!allowedValues.includes(normalized)) {
    throw new HttpError(
      `Invalid ${field}. Allowed values: ${allowedValues.join(", ")}.`,
      400,
    );
  }

  return normalized;
}

function validatePagination(query) {
  const page =
    query.page === undefined
      ? DEFAULT_PAGE
      : Number(query.page);

  const limit =
    query.limit === undefined
      ? DEFAULT_LIMIT
      : Number(query.limit);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    throw new HttpError(
      `Page must be a positive integer and limit must be between 1 and ${MAX_LIMIT}.`,
      400,
    );
  }

  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(skip)) {
    throw new HttpError("Pagination offset is too large.", 400);
  }

  return {
    page,
    limit,
    skip,
  };
}

/* =========================================================
   DATE FILTERING

   Date-only filters represent Indian business calendar days.

   Example:
   from=2026-11-01
   to=2026-11-08

   The upper boundary is exclusive so all of November 8
   is included.

   Asia/Kolkata = UTC +05:30.
========================================================= */

function parseBusinessDate(value, field) {
  if (value === undefined || value === "") {
    return null;
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new HttpError(
      `${field} must use YYYY-MM-DD format.`,
      400,
    );
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(
      `${field} is not a valid calendar date.`,
      400,
    );
  }

  // Convert Indian local midnight to UTC.
  return new Date(
    date.getTime() - 330 * 60 * 1000,
  );
}

function buildDateFilter(from, to) {
  const start = parseBusinessDate(from, "from");
  const end = parseBusinessDate(to, "to");

  if (start && end && start > end) {
    throw new HttpError(
      "The from date must be before or equal to the to date.",
      400,
    );
  }

  if (!start && !end) {
    return undefined;
  }

  const filter = {};

  if (start) {
    filter.gte = start;
  }

  if (end) {
    // Include the entire final Indian business day.
    filter.lt = new Date(
      end.getTime() + 24 * 60 * 60 * 1000,
    );
  }

  return filter;
}

/* =========================================================
   QUERY VALIDATION
========================================================= */

function validateOrderQuery(query) {
  const allowedKeys = new Set([
    "page",
    "limit",
    "search",
    "outletId",
    "status",
    "paymentStatus",
    "paymentMethod",
    "fulfillmentType",
    "from",
    "to",
    "sortBy",
    "sortOrder",
  ]);

  for (const key of Object.keys(query)) {
    if (!allowedKeys.has(key)) {
      throw new HttpError(
        `Unexpected query parameter: ${key}.`,
        400,
      );
    }
  }

  const pagination = validatePagination(query);

  let search;

  if (query.search !== undefined) {
    if (typeof query.search !== "string") {
      throw new HttpError(
        "Search must be a string.",
        400,
      );
    }

    search = query.search.trim();

    if (search.length > 120) {
      throw new HttpError(
        "Search cannot exceed 120 characters.",
        400,
      );
    }

    if (/[\u0000-\u001F\u007F]/.test(search)) {
      throw new HttpError(
        "Search contains invalid characters.",
        400,
      );
    }

    if (!search) {
      search = undefined;
    }
  }

  let outletId;

  if (query.outletId !== undefined && query.outletId !== "") {
    outletId = validateId(
      query.outletId,
      "outlet ID",
    );
  }

  let status;

  if (query.status !== undefined && query.status !== "") {
    status = validateEnum(
      query.status,
      ORDER_STATUSES,
      "order status",
    );
  }

  let paymentStatus;

  if (
    query.paymentStatus !== undefined &&
    query.paymentStatus !== ""
  ) {
    paymentStatus = validateEnum(
      query.paymentStatus,
      PAYMENT_STATUSES,
      "payment status",
    );
  }

  let paymentMethod;

  if (
    query.paymentMethod !== undefined &&
    query.paymentMethod !== ""
  ) {
    paymentMethod = validateEnum(
      query.paymentMethod,
      PAYMENT_METHODS,
      "payment method",
    );
  }

  let fulfillmentType;

  if (
    query.fulfillmentType !== undefined &&
    query.fulfillmentType !== ""
  ) {
    fulfillmentType = validateEnum(
      query.fulfillmentType,
      FULFILLMENT_TYPES,
      "fulfilment type",
    );
  }

  const placedAt = buildDateFilter(
    query.from,
    query.to,
  );

  const sortBy =
    query.sortBy === undefined
      ? "placedAt"
      : query.sortBy;

  if (
    typeof sortBy !== "string" ||
    !SORT_FIELDS.has(sortBy)
  ) {
    throw new HttpError(
      "Invalid sorting field.",
      400,
    );
  }

  const sortOrder =
    query.sortOrder === undefined
      ? "desc"
      : query.sortOrder.toLowerCase();

  if (!["asc", "desc"].includes(sortOrder)) {
    throw new HttpError(
      "sortOrder must be asc or desc.",
      400,
    );
  }

  return {
    ...pagination,
    search,
    outletId,
    status,
    paymentStatus,
    paymentMethod,
    fulfillmentType,
    placedAt,
    sortBy,
    sortOrder,
  };
}

/* =========================================================
   PRISMA WHERE BUILDER
========================================================= */

function buildOrderWhere(filters) {
  const where = {};

  if (filters.outletId) {
    where.outletId = filters.outletId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.paymentStatus) {
    where.paymentStatus = filters.paymentStatus;
  }

  if (filters.paymentMethod) {
    where.paymentMethod = filters.paymentMethod;
  }

  if (filters.fulfillmentType) {
    where.fulfillmentType = filters.fulfillmentType;
  }

  if (filters.placedAt) {
    where.placedAt = filters.placedAt;
  }

  if (filters.search) {
    const search = filters.search;

    const searchConditions = [
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
      {
        customerPhone: {
          contains: search,
        },
      },
    ];

    where.OR = searchConditions;
  }

  return where;
}

/* =========================================================
   ORDER LIST SELECTION
========================================================= */

const ORDER_LIST_SELECT = {
  id: true,
  orderNumber: true,
  customerId: true,
  customerName: true,
  customerPhone: true,

  outletId: true,

  fulfillmentType: true,

  status: true,
  paymentStatus: true,
  paymentMethod: true,

  currency: true,
  totalAmount: true,

  placedAt: true,
  promisedAt: true,

  estimatedPrepMinutes: true,

  updatedAt: true,

  outlet: {
    select: {
      id: true,
      code: true,
      name: true,
      city: {
        select: {
          name: true,
        },
      },
    },
  },

  _count: {
    select: {
      items: true,
    },
  },

  items: {
    select: {
      itemName: true,
      quantity: true,
    },
  },
};

/* =========================================================
   MAP ORDER LIST ROW

   Historical order prices are not recalculated.
========================================================= */

function mapOrderListRow(order) {
  const itemSummary = order.items
    .map(
      (item) => `${item.itemName} ×${item.quantity}`,
    )
    .join(", ");

  return {
    id: order.id,
    orderId: order.id,

    orderNumber: order.orderNumber,

    customerId: order.customerId,

    customerName: order.customerName,
    customerPhone: order.customerPhone,

    // Compatibility with existing Central Admin UI.
    customer: order.customerName,
    phone: order.customerPhone,

    outletId: order.outletId,

    outlet: {
      id: order.outlet.id,
      name: order.outlet.name,
      code: order.outlet.code,
      city: order.outlet.city?.name || null,
    },

    outletName: order.outlet.name,
    outletCode: order.outlet.code,
    cityName: order.outlet.city?.name || null,

    fulfillmentType: order.fulfillmentType,
    fulfillmentLabel:
      normaliseLabel(
        order.fulfillmentType,
        FULFILLMENT_LABELS,
      ),

    status: order.status,
    statusLabel:
      normaliseLabel(
        order.status,
        ORDER_STATUS_LABELS,
      ),

    paymentStatus: order.paymentStatus,
    paymentStatusLabel:
      normaliseLabel(
        order.paymentStatus,
        PAYMENT_STATUS_LABELS,
      ),

    paymentMethod: order.paymentMethod,
    paymentMethodLabel:
      normaliseLabel(
        order.paymentMethod,
        PAYMENT_METHOD_LABELS,
      ),

    totalAmount: decimalToNumber(order.totalAmount),

    // Compatibility with existing Central Admin UI.
    amount: decimalToNumber(order.totalAmount),

    currency: order.currency,

    itemCount: order._count.items,

    itemSummary,

    placedAt: toIso(order.placedAt),
    placedLabel: toTimeLabel(order.placedAt),
    placedDateLabel: toDateLabel(order.placedAt),

    promisedAt: toIso(order.promisedAt),
    promisedLabel: toTimeLabel(order.promisedAt),

    estimatedPrepMinutes: order.estimatedPrepMinutes,

    // Existing UI expects prepMinutes.
    prepMinutes: order.estimatedPrepMinutes,

    updatedAt: toIso(order.updatedAt),
  };
}

/* =========================================================
   A. LIST ORDERS

   GET /api/v1/admin/orders

   CENTRAL_ADMIN ONLY

   The route already enforces:
   authenticate + authorize("central_admin")
========================================================= */

export const listOrders = asyncHandler(async (req, res) => {
  const filters = validateOrderQuery(req.query);

  const where = buildOrderWhere(filters);

  const orderBy = {
    [filters.sortBy]: filters.sortOrder,
  };

  // Stable ordering when multiple orders share the same
  // selected sort field.
  if (filters.sortBy !== "id") {
    orderBy.id = "desc";
  }

  const [orders, totalItems] = await Promise.all([
    prisma.order.findMany({
      where,
      select: ORDER_LIST_SELECT,
      orderBy,
      skip: filters.skip,
      take: filters.limit,
    }),

    prisma.order.count({
      where,
    }),
  ]);

  const totalPages = Math.ceil(
    totalItems / filters.limit,
  );

  return success(
    res,
    {
      orders: orders.map(mapOrderListRow),

      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalItems,
        totalPages,

        hasNextPage:
          filters.page < totalPages,

        hasPreviousPage:
          filters.page > 1 && totalItems > 0,
      },
    },
    "Orders retrieved successfully.",
  );
});

/* =========================================================
   ORDER DETAIL SELECTION

   Only the Central Admin detail endpoint loads the complete
   order relationships.
========================================================= */

const ORDER_DETAIL_INCLUDE = {
  customer: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },

  outlet: {
    include: {
      city: {
        select: {
          id: true,
          name: true,
          state: true,
          country: true,
        },
      },
    },
  },

  address: {
    select: {
      id: true,
      label: true,
      recipientName: true,
      phone: true,
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
      },
    },
  },

  payments: {
    orderBy: {
      createdAt: "desc",
    },

    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      provider: true,
      providerReference: true,
      failureReason: true,
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
};

/* =========================================================
   MAP ORDER ITEM

   Use item and add-on snapshot fields.
   Do not read current menu pricing.
========================================================= */

function mapOrderItem(item) {
  const addons = item.addons.map((addon) => ({
    id: addon.id,
    addonOptionId: addon.addonOptionId,

    name: addon.addonName,

    unitPrice: decimalToNumber(addon.unitPrice),

    quantity: addon.quantity,

    // Compatibility with the existing detail drawer.
    price: decimalToNumber(addon.unitPrice),
  }));

  const addonUnitTotal = addons.reduce(
    (total, addon) =>
      total + addon.unitPrice,
    0,
  );

  const unitPrice = decimalToNumber(item.unitPrice);

  return {
    id: item.id,

    foodItemId: item.foodItemId,
    outletMenuItemId: item.outletMenuItemId,
    portionId: item.portionId,

    itemName: item.itemName,
    portionName: item.portionName,

    quantity: item.quantity,

    unitPrice,
    lineTotal: decimalToNumber(item.lineTotal),

    preparationNote: item.preparationNote,

    addons,

    addonUnitTotal,

    // A display-only unit amount including add-ons.
    // The stored unitPrice remains the authoritative
    // historical base/portion price.
    displayUnitPrice: unitPrice + addonUnitTotal,

    // Compatibility with the detail drawer.
    name: item.itemName,
    qty: item.quantity,
    price: unitPrice + addonUnitTotal,
    portion: item.portionName,
    instructions: item.preparationNote,

    addonNames: addons.map((addon) => addon.name),

    addonTotal: addonUnitTotal * item.quantity,
  };
}

/* =========================================================
   MAP PAYMENT ATTEMPT
========================================================= */

function mapPayment(payment) {
  return {
    id: payment.id,

    method: payment.method,
    methodLabel:
      normaliseLabel(
        payment.method,
        PAYMENT_METHOD_LABELS,
      ),

    status: payment.status,
    statusLabel:
      normaliseLabel(
        payment.status,
        PAYMENT_STATUS_LABELS,
      ),

    amount: decimalToNumber(payment.amount),

    provider: payment.provider,

    providerReference: payment.providerReference,

    // Do not expose idempotency keys.
    // Do not expose any authentication-related data.

    failureReason: payment.failureReason,

    paidAt: toIso(payment.paidAt),

    createdAt: toIso(payment.createdAt),
  };
}

/* =========================================================
   MAP ORDER EVENT

   OrderEvent is the authoritative database-backed timeline.
========================================================= */

function mapOrderEvent(event) {
  return {
    id: event.id,

    actorId: event.actorId,

    actor: event.actor
      ? {
          id: event.actor.id,
          name: event.actor.fullName,
          role: event.actor.role,
        }
      : null,

    actorName:
      event.actor?.fullName || null,

    fromStatus: event.fromStatus,

    fromStatusLabel:
      event.fromStatus
        ? normaliseLabel(
            event.fromStatus,
            ORDER_STATUS_LABELS,
          )
        : null,

    toStatus: event.toStatus,

    toStatusLabel:
      event.toStatus
        ? normaliseLabel(
            event.toStatus,
            ORDER_STATUS_LABELS,
          )
        : null,

    eventType: event.eventType,

    note: event.note,

    metadata: event.metadata,

    createdAt: toIso(event.createdAt),

    timestamp: toIso(event.createdAt),

    // Compatibility with the existing timeline UI.
    label:
      event.toStatus
        ? normaliseLabel(
            event.toStatus,
            ORDER_STATUS_LABELS,
          )
        : event.eventType === "ETA_OVERRIDDEN"
          ? "Preparation estimate updated"
          : event.eventType === "PAYMENT_FAILED"
            ? "Payment failed"
            : event.eventType === "PAYMENT_CANCELLED"
              ? "Payment cancelled"
              : event.eventType === "CHECKOUT_DRAFT_CREATED"
                ? "Checkout initiated"
                : event.eventType.replaceAll("_", " "),

    time: toTimeLabel(event.createdAt),
  };
}

/* =========================================================
   MAP ETA OVERRIDE
========================================================= */

function mapEtaOverride(entry) {
  return {
    id: entry.id,

    previousMinutes: entry.previousMinutes,
    newMinutes: entry.newMinutes,

    previousPromisedAt: toIso(
      entry.previousPromisedAt,
    ),

    newPromisedAt: toIso(
      entry.newPromisedAt,
    ),

    reason: entry.reason,

    managerId: entry.managerId,

    managerName:
      entry.manager?.fullName || null,

    manager: entry.manager
      ? {
          id: entry.manager.id,
          name: entry.manager.fullName,
        }
      : null,

    createdAt: toIso(entry.createdAt),
  };
}

/* =========================================================
   B. GET ORDER DETAILS

   GET /api/v1/admin/orders/:orderId

   CENTRAL_ADMIN ONLY

   Supports:
   - Internal Order ID
   - Public Order Number

   Central Admin can inspect orders from every outlet.
========================================================= */

export const getOrder = asyncHandler(async (req, res) => {
  const orderId = validateId(
    req.params.orderId,
    "order ID",
  );

  const order = await prisma.order.findFirst({
    where: {
      OR: [
        {
          id: orderId,
        },
        {
          orderNumber: orderId,
        },
      ],
    },

    include: ORDER_DETAIL_INCLUDE,
  });

  if (!order) {
    throw new HttpError(
      "Order not found.",
      404,
      "ORDER_NOT_FOUND",
    );
  }

  const items = order.items.map(mapOrderItem);

  const payments = order.payments.map(mapPayment);

  const timeline = order.events.map(mapOrderEvent);

  const etaOverrides =
    order.etaOverrides.map(mapEtaOverride);

  const address = order.address
    ? {
        id: order.address.id,

        label: order.address.label,

        recipientName: order.address.recipientName,

        phone: order.address.phone,

        line1: order.address.line1,

        line2: order.address.line2,

        locality: order.address.locality,

        city: order.address.city,

        state: order.address.state,

        pincode: order.address.pincode,

        landmark: order.address.landmark,

        fullAddress: [
          order.address.line1,
          order.address.line2,
          order.address.locality,
          order.address.city,
          order.address.state,
          order.address.pincode,
        ]
          .filter(Boolean)
          .join(", "),
      }
    : null;

  const customer = {
    id: order.customerId,

    name: order.customerName,

    phone: order.customerPhone,

    email: order.customer?.email || null,

    accountName:
      order.customer?.fullName || null,
  };

  const outlet = {
    id: order.outlet.id,

    code: order.outlet.code,

    name: order.outlet.name,

    type: order.outlet.type,

    city: order.outlet.city?.name || null,

    cityId: order.outlet.cityId,

    state:
      order.outlet.city?.state ||
      order.outlet.state ||
      null,

    country:
      order.outlet.city?.country || "India",

    address: [
      order.outlet.addressLine1,
      order.outlet.addressLine2,
      order.outlet.locality,
      order.outlet.city?.name,
      order.outlet.state,
      order.outlet.pincode,
    ]
      .filter(Boolean)
      .join(", "),

    phone: order.outlet.phone,

    isActive: order.outlet.isActive,
  };

  const pricing = {
    currency: order.currency,

    subtotal: decimalToNumber(order.subtotal),

    couponDiscount: decimalToNumber(
      order.couponDiscount,
    ),

    loyaltyDiscount: decimalToNumber(
      order.loyaltyDiscount,
    ),

    deliveryFee: decimalToNumber(
      order.deliveryFee,
    ),

    taxAmount: decimalToNumber(
      order.taxAmount,
    ),

    gstRate: decimalToNumber(
      order.gstRate,
    ),

    gstInclusive: order.gstInclusive,

    totalAmount: decimalToNumber(
      order.totalAmount,
    ),

    // Compatibility with the existing Central Admin UI.
    amount: decimalToNumber(order.totalAmount),
  };

  const orderSummary = {
    id: order.id,

    orderId: order.id,

    orderNumber: order.orderNumber,

    status: order.status,

    statusLabel:
      normaliseLabel(
        order.status,
        ORDER_STATUS_LABELS,
      ),

    paymentStatus: order.paymentStatus,

    paymentStatusLabel:
      normaliseLabel(
        order.paymentStatus,
        PAYMENT_STATUS_LABELS,
      ),

    paymentMethod: order.paymentMethod,

    paymentMethodLabel:
      normaliseLabel(
        order.paymentMethod,
        PAYMENT_METHOD_LABELS,
      ),

    fulfillmentType: order.fulfillmentType,

    fulfillmentLabel:
      normaliseLabel(
        order.fulfillmentType,
        FULFILLMENT_LABELS,
      ),

    placedAt: toIso(order.placedAt),

    promisedAt: toIso(order.promisedAt),

    estimatedPrepMinutes:
      order.estimatedPrepMinutes,

    createdAt: toIso(order.createdAt),

    updatedAt: toIso(order.updatedAt),

    startedAt: toIso(order.startedAt),

    readyAt: toIso(order.readyAt),

    handedOffAt: toIso(order.handedOffAt),

    cancelledAt: toIso(order.cancelledAt),

    specialInstructions:
      order.specialInstructions,

    // Existing UI compatibility.
    idDisplay: order.orderNumber,

    customer: order.customerName,

    phone: order.customerPhone,

    placedLabel: toTimeLabel(order.placedAt),

    promisedLabel: toTimeLabel(order.promisedAt),

    prepMinutes: order.estimatedPrepMinutes,

    placedDateLabel: toDateLabel(order.placedAt),

    itemSummary: items
      .map(
        (item) => `${item.itemName} ×${item.quantity}`,
      )
      .join(", "),

    amount: decimalToNumber(order.totalAmount),

    instructions: order.specialInstructions,

    gstInclusive: order.gstInclusive,
  };

  return success(
    res,
    {
      order: orderSummary,

      customer,

      outlet,

      address,

      items,

      pricing,

      payments,

      timeline,

      etaOverrides,
    },
    "Order details retrieved successfully.",
  );
});

/* =========================================================
   LEGACY EXPORTS

   These operations are intentionally not implemented here.

   Their responsibilities already belong to dedicated
   controllers or currently have no registered backend route.

   Do not add new routes just to activate these exports.
========================================================= */

// Outlet Manager owns operational status transitions.
export const updateOrderStatus = asyncHandler(
  async () => {
    throw new HttpError(
      "Order status updates are handled by the Outlet Manager workflow.",
      405,
      "ORDER_STATUS_UPDATE_NOT_SUPPORTED_HERE",
    );
  },
);

// Outlet Manager owns ETA overrides and their history.
export const updateOrderEta = asyncHandler(
  async () => {
    throw new HttpError(
      "ETA updates are handled by the Outlet Manager workflow.",
      405,
      "ORDER_ETA_UPDATE_NOT_SUPPORTED_HERE",
    );
  },
);

// Admin order details already include the complete timeline.
export const getOrderTimeline = asyncHandler(
  async () => {
    throw new HttpError(
      "Use the authorised customer or manager timeline endpoint.",
      405,
      "ORDER_TIMELINE_NOT_SUPPORTED_HERE",
    );
  },
);

// Checkout controller owns order creation, payment confirmation,
// idempotency, inventory, coupon and loyalty operations.
export const createCustomerOrder = asyncHandler(
  async () => {
    throw new HttpError(
      "Customer orders must be created through the checkout workflow.",
      405,
      "CUSTOMER_CHECKOUT_REQUIRED",
    );
  },
);

// Customers must not directly modify operational order status.
export const updateCustomerOrderStatus = asyncHandler(
  async () => {
    throw new HttpError(
      "Customers cannot update operational order status.",
      403,
      "CUSTOMER_ORDER_STATUS_FORBIDDEN",
    );
  },
);

// customerOrders.controller.js owns customer-specific order
// retrieval and checks customer ownership.
export const getCustomerOrder = asyncHandler(
  async () => {
    throw new HttpError(
      "Use the authenticated customer order details endpoint.",
      405,
      "CUSTOMER_ORDER_READ_NOT_SUPPORTED_HERE",
    );
  },
);