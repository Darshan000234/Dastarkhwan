import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../utils/customerDomain.js";

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const AUDIT_ACTION_MAX_LENGTH = 100;

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

const AUDIT_ACTIONS = new Set([
  "OUTLET_CREATED",
  "OUTLET_UPDATED",
  "OUTLET_ACTIVATED",
  "OUTLET_DEACTIVATED",
  "OUTLET_MANAGER_CREATED_AND_ASSIGNED",
  "OUTLET_MANAGER_ASSIGNED",
  "OUTLET_MANAGER_REMOVED",
  "MENU_ITEM_CREATED",
  "MENU_ITEM_UPDATED",
  "MENU_ITEM_ARCHIVED",
  "OUTLET_MENU_ITEM_ASSIGNED",
  "OUTLET_MENU_ITEM_UPDATED",
  "OUTLET_MENU_ITEM_REMOVED",
  "TIME_MENU_CREATED",
  "TIME_MENU_UPDATED",
  "TIME_MENU_DELETED",
  "ADMIN_SETTINGS_UPDATED",
  "ADMIN_DEMO_RESET",
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

const INR = "INR";

const PLATFORM_SETTING_KEY = "platform";

const PLATFORM_SETTING_FIELDS = [
  "brandName",
  "defaultCity",
  "gstInclusive",
  "gstRate",
  "defaultPrepTime",
];

/* =========================================================
   COMMON HELPERS
========================================================= */

function success(res, data, message) {
  return res.status(200).json({
    success: true,
    ...(message ? { message } : {}),
    data,
  });
}

function toNumber(value) {
  return Number(value ?? 0);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toTimeLabel(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toDateTimeLabel(value) {
  if (!value) return null;

  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function requiredString(value, field, min = 1, max = 150) {
  if (typeof value !== "string") {
    throw new HttpError(`${field} must be a string.`, 400);
  }

  const clean = value.trim();

  if (
    clean.length < min ||
    clean.length > max ||
    /[\u0000-\u001F\u007F]/.test(clean)
  ) {
    throw new HttpError(
      `${field} must contain between ${min} and ${max} valid characters.`,
      400,
    );
  }

  return clean;
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
      `Page must be positive and limit must be between 1 and ${MAX_LIMIT}.`,
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
   IST DATE HELPERS
========================================================= */

const IST_OFFSET_MS = 330 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

function getIstParts(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

function getIstMidnight(date = new Date()) {
  const parts = getIstParts(date);

  return new Date(
    Date.UTC(
      parts.year,
      parts.month,
      parts.day,
    ) - IST_OFFSET_MS,
  );
}

function getIstStartOfWeek(date = new Date()) {
  const today = getIstMidnight(date);

  const weekday = getIstParts(date).weekday;

  // Monday = 0, Sunday = 6.
  const daysSinceMonday = (weekday + 6) % 7;

  return new Date(
    today.getTime() - daysSinceMonday * DAY_MS,
  );
}

function getIstStartOfMonth(date = new Date()) {
  const parts = getIstParts(date);

  return new Date(
    Date.UTC(
      parts.year,
      parts.month,
      1,
    ) - IST_OFFSET_MS,
  );
}

function getIstEndOfDay(date = new Date()) {
  const start = getIstMidnight(date);

  return new Date(
    start.getTime() + DAY_MS,
  );
}

/* =========================================================
   DATE QUERY VALIDATION
========================================================= */

function parseDateOnly(value, field) {
  const match =
    typeof value === "string"
      ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
      : null;

  if (!match) {
    throw new HttpError(
      `${field} must use YYYY-MM-DD format.`,
      400,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const calendarDate = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new HttpError(
      `${field} is not a valid calendar date.`,
      400,
    );
  }

  // Convert IST midnight into UTC.
  return new Date(
    calendarDate.getTime() - IST_OFFSET_MS,
  );
}

function buildDateRange(fromValue, toValue) {
  const from =
    fromValue !== undefined
      ? parseDateOnly(fromValue, "from")
      : null;

  const to =
    toValue !== undefined
      ? parseDateOnly(toValue, "to")
      : null;

  if (from && to && from > to) {
    throw new HttpError(
      "The from date must be before or equal to the to date.",
      400,
    );
  }

  if (!from && !to) {
    return undefined;
  }

  return {
    ...(from ? { gte: from } : {}),
    ...(to
      ? {
          lt: new Date(to.getTime() + DAY_MS),
        }
      : {}),
  };
}

/* =========================================================
   AUDIT LOG WRITER

   Follow the existing outlet.controller.js convention.

   All entries are saved in the same transaction as the
   operation they describe.
========================================================= */

async function writeAudit(
  tx,
  req,
  action,
  entityType,
  entityId,
  details = {},
) {
  await tx.auditLog.create({
    data: {
      actorId: req.user.id,
      action,
      entityType,
      entityId,
      details,
      ipAddress: req.ip || null,
      userAgent:
        req.get("user-agent")?.slice(0, 300) || null,
    },
  });
}

/* =========================================================
   A. GET OVERVIEW

   GET /api/v1/admin/overview
========================================================= */

export const getOverview = asyncHandler(async (req, res) => {
  const now = new Date();

  const todayStart = getIstMidnight(now);
  const tomorrowStart = getIstEndOfDay(now);

  const weekStart = getIstStartOfWeek(now);
  const monthStart = getIstStartOfMonth(now);

  const paidWhere = {
    paymentStatus: "SUCCEEDED",
  };

  const todayOrdersWhere = {
    placedAt: {
      gte: todayStart,
      lt: tomorrowStart,
    },
  };

  const weekOrdersWhere = {
    placedAt: {
      gte: weekStart,
      lt: tomorrowStart,
    },
  };

  const monthOrdersWhere = {
    placedAt: {
      gte: monthStart,
      lt: tomorrowStart,
    },
  };

  const [
    outletCounts,
    customerCount,
    managerCount,
    foodCounts,

    totalOrders,
    todayOrders,
    weekOrders,
    monthOrders,

    orderStatusGroups,
    paymentStatusGroups,

    totalRevenue,
    todayRevenue,
    weekRevenue,
    monthRevenue,

    recentOrders,
    recentActivity,
  ] = await Promise.all([
    // ---------------------------------------------------
    // OUTLET COUNTS
    // ---------------------------------------------------

    prisma.outlet.groupBy({
      by: ["isActive"],
      _count: {
        _all: true,
      },
    }),

    // ---------------------------------------------------
    // USER COUNTS
    // ---------------------------------------------------

    prisma.user.count({
      where: {
        role: "CUSTOMER",
      },
    }),

    prisma.user.count({
      where: {
        role: "OUTLET_MANAGER",
      },
    }),

    // ---------------------------------------------------
    // FOOD ITEM COUNTS
    // ---------------------------------------------------

    prisma.foodItem.groupBy({
      by: ["isActive"],
      _count: {
        _all: true,
      },
    }),

    // ---------------------------------------------------
    // ORDER COUNTS
    // ---------------------------------------------------

    prisma.order.count(),

    prisma.order.count({
      where: todayOrdersWhere,
    }),

    prisma.order.count({
      where: weekOrdersWhere,
    }),

    prisma.order.count({
      where: monthOrdersWhere,
    }),

    // ---------------------------------------------------
    // ORDER STATUS COUNTS
    // ---------------------------------------------------

    prisma.order.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    }),

    // ---------------------------------------------------
    // PAYMENT STATUS COUNTS
    // ---------------------------------------------------

    prisma.order.groupBy({
      by: ["paymentStatus"],
      _count: {
        _all: true,
      },
    }),

    // ---------------------------------------------------
    // REVENUE
    //
    // Revenue only includes SUCCEEDED orders.
    // Refunds, failures and pending payments are excluded.
    // totalAmount is already GST-inclusive.
    // ---------------------------------------------------

    prisma.order.aggregate({
      where: paidWhere,
      _sum: {
        totalAmount: true,
      },
    }),

    prisma.order.aggregate({
      where: {
        ...paidWhere,
        ...todayOrdersWhere,
      },
      _sum: {
        totalAmount: true,
      },
    }),

    prisma.order.aggregate({
      where: {
        ...paidWhere,
        ...weekOrdersWhere,
      },
      _sum: {
        totalAmount: true,
      },
    }),

    prisma.order.aggregate({
      where: {
        ...paidWhere,
        ...monthOrdersWhere,
      },
      _sum: {
        totalAmount: true,
      },
    }),

    // ---------------------------------------------------
    // RECENT ORDERS
    // ---------------------------------------------------

    prisma.order.findMany({
      take: 10,

      orderBy: [
        {
          placedAt: "desc",
        },
        {
          id: "desc",
        },
      ],

      select: {
        id: true,
        orderNumber: true,

        customerId: true,
        customerName: true,
        customerPhone: true,

        outletId: true,

        status: true,
        paymentStatus: true,
        paymentMethod: true,

        totalAmount: true,
        currency: true,

        placedAt: true,
        promisedAt: true,

        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    }),

    // ---------------------------------------------------
    // RECENT AUDIT ACTIVITY
    // ---------------------------------------------------

    prisma.auditLog.findMany({
      take: 10,

      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        details: true,
        createdAt: true,

        actor: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    }),
  ]);

  // -----------------------------------------------------
  // NORMALIZE OUTLET COUNTS
  // -----------------------------------------------------

  const outletSummary = {
    total: 0,
    active: 0,
    inactive: 0,
  };

  for (const row of outletCounts) {
    const count = row._count._all;

    outletSummary.total += count;

    if (row.isActive) {
      outletSummary.active = count;
    } else {
      outletSummary.inactive = count;
    }
  }

  // -----------------------------------------------------
  // NORMALIZE FOOD ITEM COUNTS
  // -----------------------------------------------------

  const foodSummary = {
    total: 0,
    active: 0,
    inactive: 0,
  };

  for (const row of foodCounts) {
    const count = row._count._all;

    foodSummary.total += count;

    if (row.isActive) {
      foodSummary.active = count;
    } else {
      foodSummary.inactive = count;
    }
  }

  // -----------------------------------------------------
  // NORMALIZE ORDER STATUS COUNTS
  // -----------------------------------------------------

  const ordersByStatus = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, 0]),
  );

  for (const row of orderStatusGroups) {
    ordersByStatus[row.status] = row._count._all;
  }

  // -----------------------------------------------------
  // NORMALIZE PAYMENT STATUS COUNTS
  // -----------------------------------------------------

  const ordersByPaymentStatus = Object.fromEntries(
    PAYMENT_STATUSES.map((status) => [status, 0]),
  );

  for (const row of paymentStatusGroups) {
    ordersByPaymentStatus[row.paymentStatus] =
      row._count._all;
  }

  // -----------------------------------------------------
  // NORMALIZE RECENT ORDERS
  // -----------------------------------------------------

  const mappedRecentOrders = recentOrders.map((order) => ({
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,

    customerId: order.customerId,
    customer: order.customerName,
    phone: order.customerPhone,

    outletId: order.outletId,

    outlet: order.outlet,

    status: order.status,
    statusLabel:
      ORDER_STATUS_LABELS[order.status] || order.status,

    paymentStatus: order.paymentStatus,
    paymentStatusLabel:
      PAYMENT_STATUS_LABELS[order.paymentStatus] ||
      order.paymentStatus,

    paymentMethod: order.paymentMethod,

    amount: decimalToMoney(order.totalAmount),
    totalAmount: decimalToMoney(order.totalAmount),

    currency: order.currency,

    placedAt: toIso(order.placedAt),
    placedLabel: toTimeLabel(order.placedAt),

    promisedAt: toIso(order.promisedAt),
    promisedLabel: toTimeLabel(order.promisedAt),
  }));

  // -----------------------------------------------------
  // NORMALIZE AUDIT ACTIVITY
  //
  // Audit details are included because the model stores
  // a Json object. Never return request headers or tokens.
  // -----------------------------------------------------

  const mappedRecentActivity = recentActivity.map((entry) => ({
    id: entry.id,

    action: entry.action,

    entityType: entry.entityType,
    entityId: entry.entityId,

    details: entry.details,

    actor: entry.actor
      ? {
          id: entry.actor.id,
          name: entry.actor.fullName,
          role: entry.actor.role,
        }
      : null,

    actorName: entry.actor?.fullName || "Deleted user",

    createdAt: toIso(entry.createdAt),
    timestamp: toDateTimeLabel(entry.createdAt),
  }));

  const revenue = {
    total: decimalToMoney(totalRevenue._sum.totalAmount),

    today: decimalToMoney(todayRevenue._sum.totalAmount),

    thisWeek: decimalToMoney(weekRevenue._sum.totalAmount),

    thisMonth: decimalToMoney(monthRevenue._sum.totalAmount),

    currency: INR,

    gstInclusive: true,
  };

  return success(
    res,
    {
      summary: {
        outlets: outletSummary,

        customers: {
          total: customerCount,
        },

        managers: {
          total: managerCount,
        },

        foodItems: foodSummary,

        orders: {
          total: totalOrders,
          today: todayOrders,
          thisWeek: weekOrders,
          thisMonth: monthOrders,
        },
      },

      orders: {
        total: totalOrders,

        byStatus: ordersByStatus,

        byPaymentStatus: ordersByPaymentStatus,
      },

      revenue,

      recentOrders: mappedRecentOrders,

      recentActivity: mappedRecentActivity,

      generatedAt: now.toISOString(),

      timezone: "Asia/Kolkata",
    },
    "Admin overview retrieved successfully.",
  );
});

/* =========================================================
   COMMON MONEY HELPERS
========================================================= */

function decimalToMoney(value) {
  return roundMoney(Number(value ?? 0));
}

/* =========================================================
   B. GET AUDIT LOG

   GET /api/v1/admin/audit-log
========================================================= */

export const getAuditLog = asyncHandler(async (req, res) => {
  const allowedQuery = [
    "page",
    "limit",
    "action",
    "actorId",
    "entityType",
    "entityId",
    "from",
    "to",
  ];

  for (const key of Object.keys(req.query)) {
    if (!allowedQuery.includes(key)) {
      throw new HttpError(
        `Unexpected audit filter: ${key}.`,
        400,
      );
    }
  }

  const { page, limit, skip } = validatePagination(
    req.query,
  );

  const where = {};

  // -----------------------------------------------------
  // ACTION FILTER
  // -----------------------------------------------------

  if (req.query.action !== undefined) {
    const action = requiredString(
      req.query.action,
      "Action",
      1,
      AUDIT_ACTION_MAX_LENGTH,
    );

    where.action = {
      contains: action,
      mode: "insensitive",
    };
  }

  // -----------------------------------------------------
  // ACTOR FILTER
  // -----------------------------------------------------

  if (req.query.actorId !== undefined) {
    where.actorId = requiredString(
      req.query.actorId,
      "Actor ID",
      1,
      100,
    );
  }

  // -----------------------------------------------------
  // ENTITY TYPE FILTER
  // -----------------------------------------------------

  if (req.query.entityType !== undefined) {
    where.entityType = requiredString(
      req.query.entityType,
      "Entity type",
      1,
      80,
    );
  }

  // -----------------------------------------------------
  // ENTITY ID FILTER
  // -----------------------------------------------------

  if (req.query.entityId !== undefined) {
    where.entityId = requiredString(
      req.query.entityId,
      "Entity ID",
      1,
      100,
    );
  }

  // -----------------------------------------------------
  // DATE FILTER
  // -----------------------------------------------------

  const createdAt = buildDateRange(
    req.query.from,
    req.query.to,
  );

  if (createdAt) {
    where.createdAt = createdAt;
  }

  // -----------------------------------------------------
  // FETCH LOGS
  // -----------------------------------------------------

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,

      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],

      skip,
      take: limit,

      select: {
        id: true,

        actorId: true,

        action: true,

        entityType: true,
        entityId: true,

        details: true,

        ipAddress: true,

        userAgent: true,

        createdAt: true,

        actor: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    }),

    prisma.auditLog.count({
      where,
    }),
  ]);

  const mappedLogs = logs.map((log) => ({
    id: log.id,

    actorId: log.actorId,

    actor: log.actor
      ? {
          id: log.actor.id,
          name: log.actor.fullName,
          role: log.actor.role,
        }
      : null,

    actorName:
      log.actor?.fullName || "Deleted user",

    action: log.action,

    entityType: log.entityType,
    entityId: log.entityId,

    details: log.details,

    ipAddress: log.ipAddress,

    userAgent: log.userAgent,

    createdAt: toIso(log.createdAt),

    timestamp: toDateTimeLabel(log.createdAt),
  }));

  const totalPages = Math.ceil(total / limit);

  return success(
    res,
    {
      logs: mappedLogs,

      pagination: {
        page,
        limit,
        total,

        totalPages,

        hasNextPage:
          page < totalPages,

        hasPreviousPage:
          page > 1 && total > 0,
      },
    },
    "Audit logs retrieved successfully.",
  );
});

/* =========================================================
   SETTINGS VALIDATION

   Only the five fields defined by the existing seed
   configuration are supported.
========================================================= */

function validatePlatformSettings(input, existing = {}) {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new HttpError(
      "Settings must be provided as an object.",
      400,
    );
  }

  const unknown = Object.keys(input).filter(
    (key) => !PLATFORM_SETTING_FIELDS.includes(key),
  );

  if (unknown.length) {
    throw new HttpError(
      `Unsupported setting(s): ${unknown.join(", ")}.`,
      400,
    );
  }

  const updated = {
    ...existing,
  };

  if (Object.prototype.hasOwnProperty.call(input, "brandName")) {
    updated.brandName = requiredString(
      input.brandName,
      "Brand name",
      2,
      80,
    );
  }

  if (Object.prototype.hasOwnProperty.call(input, "defaultCity")) {
    updated.defaultCity = requiredString(
      input.defaultCity,
      "Default city",
      2,
      100,
    );
  }

  if (Object.prototype.hasOwnProperty.call(input, "gstInclusive")) {
    if (typeof input.gstInclusive !== "boolean") {
      throw new HttpError(
        "gstInclusive must be a boolean.",
        400,
      );
    }

    if (input.gstInclusive !== true) {
      throw new HttpError(
        "GST-inclusive pricing is required by the current checkout implementation.",
        422,
      );
    }

    updated.gstInclusive = input.gstInclusive;
  }

  if (Object.prototype.hasOwnProperty.call(input, "gstRate")) {
    const gstRate = input.gstRate;

    if (
      typeof gstRate !== "number" ||
      !Number.isFinite(gstRate) ||
      gstRate < 0 ||
      gstRate > 100
    ) {
      throw new HttpError(
        "gstRate must be a number between 0 and 100.",
        400,
      );
    }

    // The checkout implementation currently uses a fixed 5% rate.
    // Do not allow a settings update to create inconsistent prices.
    if (gstRate !== 5) {
      throw new HttpError(
        "The current checkout implementation supports a 5% GST rate only.",
        422,
      );
    }

    updated.gstRate = gstRate;
  }

  if (Object.prototype.hasOwnProperty.call(input, "defaultPrepTime")) {
    const defaultPrepTime = input.defaultPrepTime;

    if (
      !Number.isSafeInteger(defaultPrepTime) ||
      defaultPrepTime < 1 ||
      defaultPrepTime > 240
    ) {
      throw new HttpError(
        "defaultPrepTime must be a whole number between 1 and 240.",
        400,
      );
    }

    updated.defaultPrepTime = defaultPrepTime;
  }

  return updated;
}

function safePlatformSettings(value) {
  const settings =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : {};

  // Only return explicitly supported safe fields.
  return {
    brandName: settings.brandName ?? "Dastarkhwan",

    defaultCity: settings.defaultCity ?? "Hyderabad",

    gstInclusive: settings.gstInclusive ?? true,

    gstRate: settings.gstRate ?? 5,

    defaultPrepTime: settings.defaultPrepTime ?? 25,
  };
}

function validatePlatformSettingsRecord(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new HttpError(
      "The stored platform settings are malformed.",
      500,
      "INVALID_STORED_SETTINGS",
    );
  }

  return value;
}

/* =========================================================
   C. GET SETTINGS

   GET /api/v1/admin/settings
========================================================= */

export const getSettings = asyncHandler(async (req, res) => {
  const record = await prisma.appSetting.findUnique({
    where: {
      key: PLATFORM_SETTING_KEY,
    },
    select: {
      id: true,
      key: true,
      value: true,
      updatedAt: true,
      updatedBy: true,
    },
  });

  if (!record) {
    throw new HttpError(
      "Platform settings have not been initialized. Run the database seed script.",
      503,
      "PLATFORM_SETTINGS_NOT_INITIALIZED",
    );
  }

  const stored = validatePlatformSettingsRecord(
    record.value,
  );

  return success(
    res,
    {
      settings: safePlatformSettings(stored),

      updatedAt: toIso(record.updatedAt),

      updatedBy: record.updatedBy,
    },
    "Settings retrieved successfully.",
  );
});

/* =========================================================
   D. UPDATE SETTINGS

   PATCH /api/v1/admin/settings

   Supported request body:

   {
     "brandName": "Dastarkhwan",
     "defaultCity": "Hyderabad",
     "gstInclusive": true,
     "gstRate": 5,
     "defaultPrepTime": 30
   }

   All supplied values are strictly validated.
========================================================= */

export const updateSettings = asyncHandler(async (req, res) => {
  if (
    req.body === null ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    throw new HttpError(
      "Request body must be a valid JSON object.",
      400,
    );
  }

  const input = req.body;

  if (!Object.keys(input).length) {
    throw new HttpError(
      "Provide at least one setting to update.",
      400,
    );
  }

  // Reject nested request structures and unknown fields
  // through the strict settings validator.
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const existingRecord = await tx.appSetting.findUnique({
        where: {
          key: PLATFORM_SETTING_KEY,
        },
      });

      if (!existingRecord) {
        throw new HttpError(
          "Platform settings have not been initialized. Run the database seed script.",
          503,
          "PLATFORM_SETTINGS_NOT_INITIALIZED",
        );
      }

      const existingValue = validatePlatformSettingsRecord(
        existingRecord.value,
      );

      const before = safePlatformSettings(existingValue);

      // Validate only supplied keys and preserve any other
      // pre-existing JSON fields without exposing them.
      const validatedValue = validatePlatformSettings(
        input,
        existingValue,
      );

      const after = safePlatformSettings(
        validatedValue,
      );

      const changedFields = PLATFORM_SETTING_FIELDS.filter(
        (field) =>
          JSON.stringify(before[field]) !==
          JSON.stringify(after[field]),
      );

      if (!changedFields.length) {
        return {
          record: existingRecord,
          settings: after,
          changedFields: [],
          unchanged: true,
        };
      }

      const updatedRecord = await tx.appSetting.update({
        where: {
          id: existingRecord.id,
        },

        data: {
          value: validatedValue,

          // Existing schema stores this as a String, so
          // persist the current user ID as the updater.
          updatedBy: req.user.id,
        },
      });

      // Audit only supported safe before/after values.
      // No environment secrets or credentials are stored.
      await writeAudit(
        tx,
        req,
        "ADMIN_SETTINGS_UPDATED",
        "APP_SETTING",
        updatedRecord.id,
        {
          settingKey: PLATFORM_SETTING_KEY,

          changedFields,

          before: Object.fromEntries(
            changedFields.map((field) => [
              field,
              before[field],
            ]),
          ),

          after: Object.fromEntries(
            changedFields.map((field) => [
              field,
              after[field],
            ]),
          ),
        },
      );

      return {
        record: updatedRecord,
        settings: after,
        changedFields,
        unchanged: false,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );

  return success(
    res,
    {
      settings: transactionResult.settings,

      updatedAt: toIso(
        transactionResult.record.updatedAt,
      ),

      updatedBy:
        transactionResult.record.updatedBy,

      changedFields:
        transactionResult.changedFields,

      unchanged: transactionResult.unchanged,
    },
    transactionResult.unchanged
      ? "Settings are already up to date."
      : "Settings updated successfully.",
  );
});

/* =========================================================
   E. RESET DEMO DATA

   POST /api/v1/admin/demo/reset

   SAFETY DECISION:

   Current Prisma schema does not identify demo-owned
   records, and existing seed logic is not a reset service.

   Do not delete tables or records using hardcoded IDs.

   Fail closed until a dedicated demo isolation mechanism
   exists.
========================================================= */

export const resetDemoData = asyncHandler(async (req, res) => {
  // -----------------------------------------------------
  // 1. Production must always be rejected.
  // -----------------------------------------------------

  if (process.env.NODE_ENV === "production") {
    throw new HttpError(
      "Demo data reset is disabled in production.",
      403,
      "DEMO_RESET_FORBIDDEN",
    );
  }

  // -----------------------------------------------------
  // 2. Reset must be explicitly enabled.
  //
  // This does not mean reset is currently safe.
  // It is an additional protection only.
  // -----------------------------------------------------

  if (process.env.DEMO_RESET_ENABLED !== "true") {
    throw new HttpError(
      "Demo data reset is disabled. Set DEMO_RESET_ENABLED=true only after configuring safe demo-data isolation.",
      503,
      "DEMO_RESET_DISABLED",
    );
  }

  // -----------------------------------------------------
  // 3. Require a reliable demo marker.
  //
  // No such marker currently exists in the repository.
  // -----------------------------------------------------

  throw new HttpError(
    "Demo reset cannot run safely because the database does not distinguish demo records from real records. Add explicit demo-data ownership before enabling this operation.",
    503,
    "DEMO_DATA_ISOLATION_MISSING",
  );
});