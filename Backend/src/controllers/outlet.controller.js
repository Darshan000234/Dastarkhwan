import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import prisma from "../db/prisma.js";

/* =========================================================
   CONSTANTS
========================================================= */

const PHONE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^[1-9]\d{5}$/;
const OTP_REGEX = /^\d{6}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const OTP_PURPOSE = "MANAGER_ASSIGNMENT";

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

const WEEKDAY_MAP = {
  MON: "Mon",
  MONDAY: "Mon",
  TUE: "Tue",
  TUESDAY: "Tue",
  WED: "Wed",
  WEDNESDAY: "Wed",
  THU: "Thu",
  THURSDAY: "Thu",
  FRI: "Fri",
  FRIDAY: "Fri",
  SAT: "Sat",
  SATURDAY: "Sat",
  SUN: "Sun",
  SUNDAY: "Sun",
};

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* =========================================================
   COMMON ERROR AND VALIDATION HELPERS
========================================================= */

function createError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (code) {
    error.code = code;
  }

  return error;
}

function assertObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw createError(400, "Invalid request body.");
  }
}

function assertOnlyKeys(value, allowedKeys) {
  const unknown = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknown.length) {
    throw createError(400, `Unsupported field(s): ${unknown.join(", ")}.`);
  }
}

function requiredString(value, field, min = 1, max = 150) {
  if (typeof value !== "string") {
    throw createError(400, `${field} must be a string.`);
  }

  const result = value.trim();

  if (
    result.length < min ||
    result.length > max ||
    /[\u0000-\u001F\u007F]/.test(result)
  ) {
    throw createError(
      400,
      `${field} must contain between ${min} and ${max} valid characters.`,
    );
  }

  return result;
}

function optionalString(value, field, max = 150) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return requiredString(value, field, 1, max);
}

function positiveInteger(value, field, min = 1, max = 180) {
  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw createError(
      400,
      `${field} must be a whole number between ${min} and ${max}.`,
    );
  }

  return number;
}

function validBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw createError(400, `${field} must be true or false.`);
  }

  return value;
}

function validPhone(value) {
  if (typeof value !== "string") {
    throw createError(400, "Enter a valid 10-digit Indian mobile number.");
  }

  const phone = value.trim();

  if (!PHONE_REGEX.test(phone)) {
    throw createError(400, "Enter a valid 10-digit Indian mobile number.");
  }

  return phone;
}

function validPincode(value, field = "Pincode") {
  if (typeof value !== "string") {
    throw createError(400, `${field} must be a string.`);
  }

  const pincode = value.trim();

  if (!PINCODE_REGEX.test(pincode)) {
    throw createError(400, `${field} must be a valid 6-digit Indian pincode.`);
  }

  return pincode;
}

function validTime(value, field) {
  if (typeof value !== "string" || !TIME_REGEX.test(value)) {
    throw createError(400, `${field} must use HH:mm format.`);
  }

  return value;
}

function validDays(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) {
    throw createError(400, "Select at least one operating day.");
  }

  const normalised = value.map((day) => {
    if (typeof day !== "string") {
      throw createError(400, "Operating days must be strings.");
    }

    const key = day.trim().toUpperCase();
    const mapped = WEEKDAY_MAP[key];

    if (!mapped) {
      throw createError(400, `Invalid operating day: ${day}.`);
    }

    return mapped;
  });

  const unique = [...new Set(normalised)];

  if (unique.length !== normalised.length) {
    throw createError(400, "Operating days cannot contain duplicate values.");
  }

  return WEEKDAY_ORDER.filter((day) => unique.includes(day));
}

function validOutletType(value) {
  if (typeof value !== "string") {
    throw createError(400, "Invalid outlet type.");
  }

  const type = value.trim().toUpperCase().replaceAll(" ", "_");

  if (!["RESTAURANT", "CLOUD_KITCHEN"].includes(type)) {
    throw createError(400, "Outlet type must be RESTAURANT or CLOUD_KITCHEN.");
  }

  return type;
}

function parsePagination(query, defaultLimit = 10) {
  const page = query.page === undefined ? 1 : Number(query.page);

  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);

  if (!Number.isSafeInteger(page) || page < 1) {
    throw createError(400, "Page must be a positive integer.");
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw createError(400, "Limit must be between 1 and 100.");
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function parseBooleanQuery(value, field) {
  if (value === undefined) return undefined;

  if (value === "true") return true;
  if (value === "false") return false;

  throw createError(400, `${field} must be either true or false.`);
}

function getOutletId(req) {
  const outletId = req.params.outletId;

  if (
    typeof outletId !== "string" ||
    !outletId.trim() ||
    outletId.length > 100
  ) {
    throw createError(400, "A valid outlet ID is required.");
  }

  return outletId;
}

function decimalNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function validateMoneyLikeNumber(value, field, min = 0, max = 10000000) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw createError(400, `${field} must be between ${min} and ${max}.`);
  }

  return number;
}

function parseDateOnly(value, field, endOfDay = false) {
  const match =
    typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;

  if (!match) {
    throw createError(400, `${field} must use YYYY-MM-DD format.`);
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
    throw createError(400, `${field} is not a valid calendar date.`);
  }

  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}+05:30`);
}

function getIstStartOfToday(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);

  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) -
      330 * 60 * 1000,
  );
}

function resolveAnalyticsRange(query) {
  const now = new Date();

  if (query.from !== undefined || query.to !== undefined) {
    if (!query.from || !query.to) {
      throw createError(
        400,
        "Both from and to dates are required for a custom range.",
      );
    }

    const from = parseDateOnly(query.from, "From date");
    const to = parseDateOnly(query.to, "To date", true);

    if (from > to) {
      throw createError(400, "From date must not be after to date.");
    }

    if ((to.getTime() - from.getTime()) / 86400000 > 90) {
      throw createError(400, "Custom analytics ranges cannot exceed 90 days.");
    }

    if (from > now) {
      throw createError(400, "Analytics range cannot start in the future.");
    }

    return {
      from,
      to,
      label: "custom",
    };
  }

  // Default outlet analytics range: last 30 calendar days including today.
  const todayStart = getIstStartOfToday(now);

  return {
    from: new Date(todayStart.getTime() - 29 * 86400000),
    to: now,
    label: "30d",
  };
}

function formatTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) return null;

  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
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

function displayOrderStatus(status) {
  const labels = {
    PLACED: "Placed",
    ACCEPTED: "Accepted",
    PREPARING: "Preparing",
    READY: "Ready",
    HANDED_OFF: "Handed Off",
    CANCELLED: "Cancelled",
  };

  return labels[status] || status;
}

function displayPaymentStatus(status) {
  const labels = {
    PENDING: "Pending",
    SUCCEEDED: "Succeeded",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
  };

  return labels[status] || status;
}

function maskPhone(phone) {
  if (typeof phone !== "string" || phone.length !== 10) {
    return null;
  }

  return `${phone.slice(0, 5)}XXXXX`;
}

/* =========================================================
   PRISMA ERROR MAPPING
========================================================= */

function mapPrismaError(error) {
  if (error?.code === "P2002") {
    const target = error.meta?.target;
    const targetText = Array.isArray(target)
      ? target.join(",")
      : String(target || "");

    if (targetText.includes("code")) {
      return createError(
        409,
        "Outlet code must be unique.",
        "OUTLET_CODE_EXISTS",
      );
    }

    if (targetText.includes("manager_id")) {
      return createError(
        409,
        "This manager is already assigned to another outlet.",
        "MANAGER_ALREADY_ASSIGNED",
      );
    }

    if (targetText.includes("phone")) {
      return createError(
        409,
        "An account already exists with this phone number.",
        "PHONE_ALREADY_REGISTERED",
      );
    }

    return createError(
      409,
      "A record with the supplied unique value already exists.",
      "DUPLICATE_RECORD",
    );
  }

  if (error?.code === "P2003") {
    return createError(
      422,
      "A referenced record does not exist or cannot be used.",
      "INVALID_RELATION",
    );
  }

  if (error?.code === "P2025") {
    return createError(404, "The requested record was not found.");
  }

  if (error?.code === "P2034") {
    return createError(
      409,
      "This operation conflicted with another request. Please try again.",
      "TRANSACTION_CONFLICT",
    );
  }

  return error;
}

/* =========================================================
   AUDIT LOGGING
========================================================= */

async function writeAudit(tx, req, action, entityType, entityId, details = {}) {
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

function outletAuditSnapshot(outlet) {
  return {
    id: outlet.id,
    code: outlet.code,
    name: outlet.name,
    type: outlet.type,
    cityId: outlet.cityId,
    addressLine1: outlet.addressLine1,
    addressLine2: outlet.addressLine2,
    locality: outlet.locality,
    state: outlet.state,
    pincode: outlet.pincode,
    primaryPincode: outlet.primaryPincode,
    deliveryPincodes: outlet.deliveryPincodes,
    deliveryRadiusKm: decimalNumber(outlet.deliveryRadiusKm),
    openingTime: outlet.openingTime,
    closingTime: outlet.closingTime,
    operatingDays: outlet.operatingDays,
    minimumPrepMinutes: outlet.minimumPrepMinutes,
    isActive: outlet.isActive,
    supportsVeg: outlet.supportsVeg,
    supportsNonVeg: outlet.supportsNonVeg,
    hasFssaiLicense: Boolean(outlet.fssaiLicense),
  };
}

/* =========================================================
   CITY HELPERS
========================================================= */

async function findActiveCityById(cityId) {
  if (typeof cityId !== "string" || !cityId.trim() || cityId.length > 100) {
    throw createError(400, "A valid cityId is required.");
  }

  const city = await prisma.city.findFirst({
    where: {
      id: cityId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      state: true,
    },
  });

  if (!city) {
    throw createError(
      422,
      "The selected city does not exist or is inactive.",
      "INVALID_CITY",
    );
  }

  return city;
}

async function findActiveCityByName(name) {
  const cityName = requiredString(name, "City", 2, 100);

  const city = await prisma.city.findFirst({
    where: {
      name: {
        equals: cityName,
        mode: "insensitive",
      },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      state: true,
    },
  });

  if (!city) {
    throw createError(
      422,
      `City "${cityName}" does not exist or is inactive.`,
      "INVALID_CITY",
    );
  }

  return city;
}

/* =========================================================
   OUTLET RESPONSE MAPPING
========================================================= */

const outletManagerSelect = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  isActive: true,
  phoneVerifiedAt: true,
};

const outletListInclude = {
  city: {
    select: {
      id: true,
      name: true,
      state: true,
    },
  },

  manager: {
    select: outletManagerSelect,
  },

  _count: {
    select: {
      orders: true,
      menuItems: true,
    },
  },
};

function mapManager(manager) {
  if (!manager) return null;

  return {
    id: manager.id,
    name: manager.fullName,
    fullName: manager.fullName,
    phone: manager.phone,
    email: manager.email,
    active: manager.isActive,
    isActive: manager.isActive,
    verified: Boolean(manager.phoneVerifiedAt),
  };
}

function mapOutlet(outlet, metrics = {}) {
  const address = [outlet.addressLine1, outlet.addressLine2, outlet.locality]
    .filter(Boolean)
    .join(", ");

  const pincodes = [
    ...new Set([outlet.primaryPincode, ...(outlet.deliveryPincodes || [])]),
  ];

  return {
    id: outlet.id,
    code: outlet.code,
    name: outlet.name,

    type: outlet.type === "CLOUD_KITCHEN" ? "Cloud Kitchen" : "Restaurant",

    typeValue: outlet.type,

    city: outlet.city?.name || "",
    cityId: outlet.cityId,
    state: outlet.state,

    address,
    addressLine1: outlet.addressLine1,
    addressLine2: outlet.addressLine2,
    locality: outlet.locality,

    pincode: outlet.pincode,
    primaryPincode: outlet.primaryPincode,
    pincodes,
    deliveryPincodes: outlet.deliveryPincodes,

    phone: outlet.phone || "",

    radius: decimalNumber(outlet.deliveryRadiusKm),
    deliveryRadiusKm: decimalNumber(outlet.deliveryRadiusKm),

    openTime: outlet.openingTime,
    closeTime: outlet.closingTime,
    openingTime: outlet.openingTime,
    closingTime: outlet.closingTime,

    days: outlet.operatingDays,
    operatingDays: outlet.operatingDays,

    prepTime: outlet.minimumPrepMinutes,
    minimumPrepMinutes: outlet.minimumPrepMinutes,

    fssai: outlet.fssaiLicense || "",
    fssaiLicense: outlet.fssaiLicense,

    veg: outlet.supportsVeg,
    nonVeg: outlet.supportsNonVeg,
    supportsVeg: outlet.supportsVeg,
    supportsNonVeg: outlet.supportsNonVeg,

    active: outlet.isActive,
    isActive: outlet.isActive,

    manager: mapManager(outlet.manager),

    orderCount: metrics.orderCount ?? outlet._count?.orders ?? 0,
    ordersToday: metrics.ordersToday ?? 0,
    revenueToday: metrics.revenueToday ?? 0,
    avgPrep: metrics.avgPrep ?? null,

    mappedItemCount: metrics.mappedItemCount ?? outlet._count?.menuItems ?? 0,

    unavailableItemCount: metrics.unavailableItemCount ?? 0,

    createdAt: outlet.createdAt?.toISOString() || null,
    updatedAt: outlet.updatedAt?.toISOString() || null,

    // Keep these properties available for the current edit form.
    // The menu tab loads actual mappings from its dedicated endpoint.
    menu: [],
  };
}

/* =========================================================
   OUTLET INPUT VALIDATION AND MAPPING
========================================================= */

const OUTLET_INPUT_KEYS = [
  // Actual Prisma fields supported by the outlet API.
  "code",
  "name",
  "type",
  "cityId",
  "addressLine1",
  "addressLine2",
  "locality",
  "state",
  "pincode",
  "primaryPincode",
  "phone",
  "fssaiLicense",
  "supportsVeg",
  "supportsNonVeg",
  "latitude",
  "longitude",
  "deliveryRadiusKm",
  "deliveryPincodes",
  "openingTime",
  "closingTime",
  "operatingDays",
  "minimumPrepMinutes",

  // Existing React form names.
  "city",
  "address",
  "radius",
  "pincodes",
  "openTime",
  "closeTime",
  "days",
  "prepTime",
  "fssai",
  "veg",
  "nonVeg",
  "active",
  "isActive",
  "statistics",

  // Existing outlet object properties copied into edit form state.
  // They are accepted as read-only and never written to Prisma.
  "id",
  "manager",
  "menu",
  "createdAt",
  "updatedAt",
  "orderCount",
  "ordersToday",
  "revenueToday",
  "avgPrep",
  "mappedItemCount",
  "unavailableItemCount",
  "typeValue",
];

function parseCoordinate(value, field, min, max) {
  if (value === undefined) return undefined;

  if (value === null || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) {
    throw createError(400, `${field} must be between ${min} and ${max}.`);
  }

  return number;
}

function parseRadius(value) {
  if (value === undefined) return undefined;

  if (value === null || value === "") return null;

  const radius = validateMoneyLikeNumber(value, "Delivery radius", 0.01, 50);

  return radius;
}

function parseServicePincodes(value) {
  if (!Array.isArray(value) || value.length > 100) {
    throw createError(
      400,
      "Serviceable pincodes must be an array containing at most 100 values.",
    );
  }

  const pins = value.map((pin) => validPincode(pin, "Serviceable pincode"));

  return [...new Set(pins)];
}

function parseFssai(value) {
  const fssai = optionalString(value, "FSSAI licence", 80);

  if (fssai === undefined || fssai === null) {
    return fssai;
  }

  // The current frontend starts with DEMO-FSSAI-PENDING.
  // DEMO-prefixed placeholders must not become real licence records.
  if (fssai.toUpperCase().startsWith("DEMO-")) {
    return null;
  }

  return fssai;
}

async function mapOutletInput(body, existing = null) {
  assertObject(body);
  assertOnlyKeys(body, OUTLET_INPUT_KEYS);

  const data = {};

  // Name.
  if (body.name !== undefined) {
    data.name = requiredString(body.name, "Outlet name", 2, 150);
  }

  // Code.
  if (body.code !== undefined) {
    const code = requiredString(body.code, "Outlet code", 3, 20).toUpperCase();

    if (!/^[A-Z0-9-]+$/.test(code)) {
      throw createError(
        400,
        "Outlet code may contain only letters, numbers and hyphens.",
      );
    }

    data.code = code;
  }

  // Outlet type.
  if (body.type !== undefined) {
    data.type = validOutletType(body.type);
  }

  // City. The database relation is City -> Outlet.cityId.
  let city = null;

  if (body.cityId !== undefined && body.city !== undefined) {
    const cityById = await findActiveCityById(body.cityId);
    const cityByName = await findActiveCityByName(body.city);

    if (cityById.id !== cityByName.id) {
      throw createError(
        400,
        "cityId and city refer to different city records.",
      );
    }

    city = cityById;
    data.cityId = city.id;
  } else if (body.cityId !== undefined) {
    city = await findActiveCityById(body.cityId);
    data.cityId = city.id;
  } else if (body.city !== undefined) {
    city = await findActiveCityByName(body.city);
    data.cityId = city.id;
  } else if (existing) {
    city = existing.city;
  }

  // Address line 1. The existing form uses one complete address field.
  if (body.address !== undefined) {
    data.addressLine1 = requiredString(
      body.address,
      "Complete address",
      5,
      180,
    );
  } else if (body.addressLine1 !== undefined) {
    data.addressLine1 = requiredString(
      body.addressLine1,
      "Address line 1",
      3,
      180,
    );
  }

  if (body.addressLine2 !== undefined) {
    data.addressLine2 = optionalString(
      body.addressLine2,
      "Address line 2",
      180,
    );
  }

  if (body.locality !== undefined) {
    data.locality = requiredString(body.locality, "Locality", 2, 120);
  } else if (!existing && city) {
    /*
     * The current React outlet form does not collect locality separately.
     * The schema requires it. Use the selected city name as the fallback.
     * A dedicated locality input would be more accurate.
     */
    data.locality = city.name;
  }

  // City state is authoritative when present.
  if (body.state !== undefined) {
    const suppliedState = requiredString(body.state, "State", 2, 100);

    if (
      city?.state &&
      suppliedState.toLowerCase() !== city.state.toLowerCase()
    ) {
      throw createError(
        422,
        "The supplied state does not match the selected city.",
      );
    }

    data.state = city?.state || suppliedState;
  } else if (city?.state) {
    data.state = city.state;
  } else if (existing) {
    data.state = existing.state;
  }

  // Pincode.
  if (body.pincode !== undefined) {
    data.pincode = validPincode(body.pincode, "Outlet pincode");
  }

  if (body.primaryPincode !== undefined) {
    data.primaryPincode = validPincode(body.primaryPincode, "Primary pincode");

    // In the existing form the primary service pincode also represents
    // the outlet's registered pincode unless one is explicitly supplied.
    if (body.pincode === undefined) {
      data.pincode = data.primaryPincode;
    }
  }

  // Contact phone.
  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === "") {
      data.phone = null;
    } else {
      data.phone = validPhone(body.phone);
    }
  }

  // FSSAI.
  if (body.fssai !== undefined) {
    data.fssaiLicense = parseFssai(body.fssai);
  } else if (body.fssaiLicense !== undefined) {
    data.fssaiLicense = parseFssai(body.fssaiLicense);
  }

  // Food support flags.
  if (body.veg !== undefined) {
    data.supportsVeg = validBoolean(body.veg, "Vegetarian support");
  } else if (body.supportsVeg !== undefined) {
    data.supportsVeg = validBoolean(body.supportsVeg, "Vegetarian support");
  }

  if (body.nonVeg !== undefined) {
    data.supportsNonVeg = validBoolean(body.nonVeg, "Non-vegetarian support");
  } else if (body.supportsNonVeg !== undefined) {
    data.supportsNonVeg = validBoolean(
      body.supportsNonVeg,
      "Non-vegetarian support",
    );
  }

  // Coordinates.
  if (body.latitude !== undefined) {
    data.latitude = parseCoordinate(body.latitude, "Latitude", -90, 90);
  }

  if (body.longitude !== undefined) {
    data.longitude = parseCoordinate(body.longitude, "Longitude", -180, 180);
  }

  const effectiveLatitude =
    data.latitude !== undefined
      ? data.latitude
      : decimalNumber(existing?.latitude);

  const effectiveLongitude =
    data.longitude !== undefined
      ? data.longitude
      : decimalNumber(existing?.longitude);

  if (
    (effectiveLatitude === null || effectiveLatitude === undefined) !==
    (effectiveLongitude === null || effectiveLongitude === undefined)
  ) {
    throw createError(
      400,
      "Latitude and longitude must either both be supplied or both be empty.",
    );
  }

  // Delivery radius.
  if (body.radius !== undefined) {
    data.deliveryRadiusKm = parseRadius(body.radius);
  } else if (body.deliveryRadiusKm !== undefined) {
    data.deliveryRadiusKm = parseRadius(body.deliveryRadiusKm);
  }

  // Serviceable pincodes.
  let servicePincodes;

  if (body.pincodes !== undefined) {
    servicePincodes = parseServicePincodes(body.pincodes);
  } else if (body.deliveryPincodes !== undefined) {
    servicePincodes = parseServicePincodes(body.deliveryPincodes);
  }

  if (servicePincodes !== undefined) {
    data.deliveryPincodes = servicePincodes;
  }

  const effectivePrimaryPin = data.primaryPincode || existing?.primaryPincode;

  const effectiveServicePins =
    data.deliveryPincodes || existing?.deliveryPincodes || [];

  if (effectivePrimaryPin) {
    data.deliveryPincodes = [
      ...new Set([effectivePrimaryPin, ...effectiveServicePins]),
    ];
  }

  // Opening and closing times.
  if (body.openTime !== undefined) {
    data.openingTime = validTime(body.openTime, "Opening time");
  } else if (body.openingTime !== undefined) {
    data.openingTime = validTime(body.openingTime, "Opening time");
  }

  if (body.closeTime !== undefined) {
    data.closingTime = validTime(body.closeTime, "Closing time");
  } else if (body.closingTime !== undefined) {
    data.closingTime = validTime(body.closingTime, "Closing time");
  }

  const effectiveOpen = data.openingTime || existing?.openingTime;

  const effectiveClose = data.closingTime || existing?.closingTime;

  if (effectiveOpen && effectiveClose && effectiveOpen === effectiveClose) {
    throw createError(400, "Opening and closing times cannot be identical.");
  }

  // Operating days.
  if (body.days !== undefined) {
    data.operatingDays = validDays(body.days);
  } else if (body.operatingDays !== undefined) {
    data.operatingDays = validDays(body.operatingDays);
  }

  // Minimum preparation time.
  if (body.prepTime !== undefined) {
    data.minimumPrepMinutes = positiveInteger(
      body.prepTime,
      "Minimum preparation time",
      5,
      180,
    );
  } else if (body.minimumPrepMinutes !== undefined) {
    data.minimumPrepMinutes = positiveInteger(
      body.minimumPrepMinutes,
      "Minimum preparation time",
      5,
      180,
    );
  }

  // Active status can be set on create. Updating it later must use
  // the dedicated PATCH /:outletId/status endpoint.
  if (body.active !== undefined) {
    const active = validBoolean(body.active, "Active status");

    if (existing && active !== existing.isActive) {
      throw createError(
        400,
        "Change outlet status through the dedicated status endpoint.",
      );
    }

    if (!existing) {
      data.isActive = active;
    }
  }

  if (body.isActive !== undefined) {
    const active = validBoolean(body.isActive, "Active status");

    if (existing && active !== existing.isActive) {
      throw createError(
        400,
        "Change outlet status through the dedicated status endpoint.",
      );
    }

    if (!existing) {
      data.isActive = active;
    }
  }

  // Required field validation for create.
  if (!existing) {
    const requiredFields = [
      "name",
      "code",
      "type",
      "cityId",
      "addressLine1",
      "locality",
      "state",
      "pincode",
      "primaryPincode",
      "openingTime",
      "closingTime",
      "operatingDays",
    ];

    const missing = requiredFields.filter((field) => data[field] === undefined);

    if (missing.length) {
      throw createError(
        400,
        `Missing required outlet fields: ${missing.join(", ")}.`,
      );
    }

    // Schema defaults apply when these are omitted.
    if (data.isActive === undefined) {
      data.isActive = true;
    }

    if (data.supportsVeg === undefined) {
      data.supportsVeg = true;
    }

    if (data.supportsNonVeg === undefined) {
      data.supportsNonVeg = true;
    }

    if (data.minimumPrepMinutes === undefined) {
      data.minimumPrepMinutes = 25;
    }

    if (data.deliveryPincodes === undefined) {
      data.deliveryPincodes = [data.primaryPincode];
    }
  }

  return data;
}

/* =========================================================
   ORDER RESPONSE MAPPING
========================================================= */

const orderInclude = {
  outlet: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },

  items: {
    select: {
      itemName: true,
      portionName: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,

      addons: {
        select: {
          addonName: true,
          unitPrice: true,
          quantity: true,
        },
      },
    },
  },

  events: {
    orderBy: {
      createdAt: "asc",
    },

    take: 30,

    select: {
      eventType: true,
      note: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
    },
  },
};

function mapOrder(order) {
  const items = (order.items || []).map((item) => {
    const quantity = item.quantity || 1;
    const lineTotal = Number(item.lineTotal);

    return {
      name: item.itemName,
      qty: quantity,
      quantity,
      portion: item.portionName,
      price: lineTotal / quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal,
      addons: (item.addons || []).map((addon) => addon.addonName),
    };
  });

  const timeline = (order.events || []).map((event) => ({
    label:
      event.note ||
      event.eventType
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),

    time: formatDateTime(event.createdAt),
  }));

  if (timeline.length === 0) {
    timeline.push({
      label: "Order placed",
      time: formatDateTime(order.placedAt),
    });
  }

  const unfinished = ["PLACED", "ACCEPTED", "PREPARING", "READY"].includes(
    order.status,
  );

  const late =
    unfinished &&
    order.paymentStatus === "SUCCEEDED" &&
    new Date(order.promisedAt) < new Date();

  return {
    // The existing dashboard displays the human-readable order number.
    id: order.orderNumber,
    orderId: order.id,
    orderNumber: order.orderNumber,

    customer: order.customerName,
    customerName: order.customerName,
    phone: order.customerPhone,

    outletId: order.outletId,
    outlet: order.outlet
      ? {
          id: order.outlet.id,
          name: order.outlet.name,
          code: order.outlet.code,
        }
      : null,

    fulfillmentType: order.fulfillmentType,

    items,

    itemCount: items.reduce((total, item) => total + item.quantity, 0),

    itemSummary: items
      .map((item) => `${item.name} ×${item.quantity}`)
      .join(", "),

    amount: Number(order.totalAmount),
    totalAmount: Number(order.totalAmount),
    subtotal: Number(order.subtotal),

    couponDiscount: Number(order.couponDiscount),
    loyaltyDiscount: Number(order.loyaltyDiscount),
    taxAmount: Number(order.taxAmount),
    deliveryFee: Number(order.deliveryFee),

    gstRate: Number(order.gstRate),
    gstInclusive: order.gstInclusive,

    paymentMethod: order.paymentMethod || "—",
    paymentStatus: displayPaymentStatus(order.paymentStatus),
    status: displayOrderStatus(order.status),

    placedAt: order.placedAt.toISOString(),
    placedLabel: formatTime(order.placedAt),

    promisedAt: order.promisedAt.toISOString(),
    promisedLabel: formatTime(order.promisedAt),

    startedAt: order.startedAt?.toISOString() || null,
    readyAt: order.readyAt?.toISOString() || null,
    handedOffAt: order.handedOffAt?.toISOString() || null,
    cancelledAt: order.cancelledAt?.toISOString() || null,

    prepMinutes: order.estimatedPrepMinutes,
    late,

    instructions: order.specialInstructions,
    specialInstructions: order.specialInstructions,

    timeline,
  };
}

/* =========================================================
   A. LIST OUTLETS
   GET /admin/outlets
========================================================= */

export async function listOutlets(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query, 10);

    const where = {};

    if (req.query.search !== undefined) {
      const search = requiredString(req.query.search, "Search", 1, 100);

      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          code: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          locality: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          pincode: {
            contains: search,
          },
        },
        {
          city: {
            is: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ];
    }

    if (req.query.cityId !== undefined) {
      where.cityId = requiredString(req.query.cityId, "City ID", 1, 100);
    }

    if (req.query.type !== undefined) {
      where.type = validOutletType(req.query.type);
    }

    const isActive = parseBooleanQuery(req.query.isActive, "isActive");

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const allowedSortFields = [
      "name",
      "code",
      "createdAt",
      "updatedAt",
      "isActive",
      "type",
    ];

    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder || "desc";

    if (!allowedSortFields.includes(sortBy)) {
      throw createError(
        400,
        `sortBy must be one of: ${allowedSortFields.join(", ")}.`,
      );
    }

    if (!["asc", "desc"].includes(sortOrder)) {
      throw createError(400, "sortOrder must be asc or desc.");
    }

    const [outlets, total] = await Promise.all([
      prisma.outlet.findMany({
        where,
        include: outletListInclude,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),

      prisma.outlet.count({ where }),
    ]);

    const outletIds = outlets.map((outlet) => outlet.id);

    let dailyMetrics = [];
    let unavailableRows = [];

    if (outletIds.length > 0) {
      const todayStart = getIstStartOfToday();

      [dailyMetrics, unavailableRows] = await Promise.all([
        prisma.$queryRaw`
          SELECT
            "outlet_id" AS "outletId",
            COUNT(*)::int AS "ordersToday",

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
            )::float AS "revenueToday",

            ROUND(
              AVG(
                EXTRACT(EPOCH FROM ("ready_at" - "started_at")) / 60.0
              ) FILTER (
                WHERE "started_at" IS NOT NULL
                  AND "ready_at" IS NOT NULL
                  AND "ready_at" >= "started_at"
              )
            )::int AS "avgPrep"

          FROM "orders"
          WHERE "outlet_id" = ANY(${outletIds}::text[])
            AND "placed_at" >= ${todayStart}
          GROUP BY "outlet_id"
        `,

        prisma.outletMenuItem.groupBy({
          by: ["outletId"],
          where: {
            outletId: {
              in: outletIds,
            },
            isAvailable: false,
          },
          _count: {
            _all: true,
          },
        }),
      ]);
    }

    const dailyMap = new Map(
      dailyMetrics.map((row) => [
        row.outletId,
        {
          ordersToday: Number(row.ordersToday || 0),
          revenueToday: Number(row.revenueToday || 0),
          avgPrep: row.avgPrep === null ? null : Number(row.avgPrep),
        },
      ]),
    );

    const unavailableMap = new Map(
      unavailableRows.map((row) => [row.outletId, row._count._all]),
    );

    const result = outlets.map((outlet) => {
      const daily = dailyMap.get(outlet.id) || {};

      return mapOutlet(outlet, {
        orderCount: outlet._count.orders,
        ordersToday: daily.ordersToday || 0,
        revenueToday: daily.revenueToday || 0,
        avgPrep: daily.avgPrep ?? null,
        mappedItemCount: outlet._count.menuItems,
        unavailableItemCount: unavailableMap.get(outlet.id) || 0,
      });
    });

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Outlets retrieved successfully.",
      data: {
        outlets: result,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   B. GET OUTLET DETAILS
   GET /admin/outlets/:outletId
========================================================= */

export async function getOutlet(req, res, next) {
  try {
    const outletId = getOutletId(req);

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: outletId,
      },

      include: {
        ...outletListInclude,

        _count: {
          select: {
            orders: true,
            menuItems: true,
            inventoryMovements: true,
          },
        },
      },
    });

    if (!outlet) {
      throw createError(404, "Outlet not found.");
    }

    const [activeMenuItems, unavailableMenuItems, ordersToday, revenueToday] =
      await Promise.all([
        prisma.outletMenuItem.count({
          where: {
            outletId,
            isAvailable: true,
            foodItem: {
              isActive: true,
            },
          },
        }),

        prisma.outletMenuItem.count({
          where: {
            outletId,
            isAvailable: false,
          },
        }),

        prisma.order.count({
          where: {
            outletId,
            placedAt: {
              gte: getIstStartOfToday(),
            },
          },
        }),

        prisma.order.aggregate({
          where: {
            outletId,
            placedAt: {
              gte: getIstStartOfToday(),
            },
            paymentStatus: "SUCCEEDED",
            status: {
              not: "CANCELLED",
            },
          },
          _sum: {
            totalAmount: true,
          },
        }),
      ]);

    return res.status(200).json({
      success: true,
      message: "Outlet details retrieved successfully.",
      data: {
        outlet: {
          ...mapOutlet(outlet),

          latitude: decimalNumber(outlet.latitude),
          longitude: decimalNumber(outlet.longitude),

          statistics: {
            totalOrders: outlet._count.orders,
            totalMenuItems: outlet._count.menuItems,
            activeMenuItems,
            unavailableMenuItems,
            inventoryMovementCount: outlet._count.inventoryMovements,
            ordersToday,
            revenueToday: Number(revenueToday._sum.totalAmount || 0),
          },
        },
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   C. CREATE OUTLET
   POST /admin/outlets
========================================================= */

export async function createOutlet(req, res, next) {
  try {
    const data = await mapOutletInput(req.body);

    // The City relation must be valid and active.
    const city = await prisma.city.findFirst({
      where: {
        id: data.cityId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        state: true,
      },
    });

    if (!city) {
      throw createError(
        422,
        "The selected city does not exist or is inactive.",
        "INVALID_CITY",
      );
    }

    if (
      data.state &&
      city.state &&
      data.state.toLowerCase() !== city.state.toLowerCase()
    ) {
      throw createError(422, "Outlet state must match the selected city.");
    }

    // City state is authoritative when configured.
    if (city.state) {
      data.state = city.state;
    }

    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.create({
        data,
        include: outletListInclude,
      });

      await writeAudit(tx, req, "OUTLET_CREATED", "OUTLET", outlet.id, {
        after: outletAuditSnapshot(outlet),
      });

      return outlet;
    });

    return res.status(201).json({
      success: true,
      message: "Outlet created successfully.",
      data: {
        outlet: mapOutlet(result),
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   D. UPDATE OUTLET
   PATCH /admin/outlets/:outletId
========================================================= */

export async function updateOutlet(req, res, next) {
  try {
    const outletId = getOutletId(req);

    const existing = await prisma.outlet.findUnique({
      where: {
        id: outletId,
      },

      include: {
        city: {
          select: {
            id: true,
            name: true,
            state: true,
          },
        },
        manager: {
          select: outletManagerSelect,
        },
      },
    });

    if (!existing) {
      throw createError(404, "Outlet not found.");
    }

    const data = await mapOutletInput(req.body, existing);

    // A body containing only the read-only fields copied by the current
    // React edit form is not a real update.
    if (Object.keys(data).length === 0) {
      throw createError(400, "No editable outlet fields were supplied.");
    }

    // Do not allow the browser to change the manager relationship here.
    // It must use the manager OTP endpoints.
    if (Object.prototype.hasOwnProperty.call(req.body, "managerId")) {
      throw createError(
        400,
        "Manager assignment must use the dedicated manager endpoints.",
      );
    }

    // Validate the selected city if changed.
    if (data.cityId && data.cityId !== existing.cityId) {
      const city = await prisma.city.findFirst({
        where: {
          id: data.cityId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          state: true,
        },
      });

      if (!city) {
        throw createError(
          422,
          "The selected city does not exist or is inactive.",
        );
      }

      if (city.state) {
        data.state = city.state;
      }
    }

    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.outlet.findUnique({
        where: {
          code: data.code,
        },
        select: {
          id: true,
        },
      });

      if (duplicate && duplicate.id !== outletId) {
        throw createError(
          409,
          "Outlet code must be unique.",
          "OUTLET_CODE_EXISTS",
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.outlet.update({
        where: {
          id: outletId,
        },

        data,

        include: outletListInclude,
      });

      await writeAudit(tx, req, "OUTLET_UPDATED", "OUTLET", outletId, {
        before: outletAuditSnapshot(existing),
        after: outletAuditSnapshot(updated),
        changedFields: Object.keys(data),
      });

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: "Outlet updated successfully.",
      data: {
        outlet: mapOutlet(result),
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   E. UPDATE OUTLET STATUS
   PATCH /admin/outlets/:outletId/status
========================================================= */

export async function updateOutletStatus(req, res, next) {
  try {
    const outletId = getOutletId(req);

    assertObject(req.body);
    assertOnlyKeys(req.body, ["isActive", "active"]);

    const suppliedStatus =
      req.body.isActive !== undefined ? req.body.isActive : req.body.active;

    if (
      req.body.isActive !== undefined &&
      req.body.active !== undefined &&
      req.body.isActive !== req.body.active
    ) {
      throw createError(400, "isActive and active must have the same value.");
    }

    const isActive = validBoolean(suppliedStatus, "isActive");

    const existing = await prisma.outlet.findUnique({
      where: {
        id: outletId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!existing) {
      throw createError(404, "Outlet not found.");
    }

    if (existing.isActive === isActive) {
      return res.status(200).json({
        success: true,
        message: `Outlet is already ${isActive ? "active" : "inactive"}.`,
        data: {
          outlet: {
            id: existing.id,
            name: existing.name,
            previousIsActive: existing.isActive,
            isActive: existing.isActive,
            updatedAt: null,
          },
        },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.outlet.update({
        where: {
          id: outletId,
        },

        data: {
          isActive,
        },

        select: {
          id: true,
          name: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await writeAudit(
        tx,
        req,
        isActive ? "OUTLET_ACTIVATED" : "OUTLET_DEACTIVATED",
        "OUTLET",
        outletId,
        {
          before: {
            isActive: existing.isActive,
          },
          after: {
            isActive: updated.isActive,
          },
        },
      );

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: `Outlet ${isActive ? "activated" : "deactivated"} successfully.`,
      data: {
        outlet: {
          id: result.id,
          name: result.name,
          previousIsActive: existing.isActive,
          isActive: result.isActive,
          updatedAt: result.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   F. OUTLET ANALYTICS
   GET /admin/outlets/:outletId/analytics
========================================================= */

export async function getOutletAnalytics(req, res, next) {
  try {
    const outletId = getOutletId(req);

    const { from, to, label } = resolveAnalyticsRange(req.query);

    const now = new Date();

    // --------------------------------------------------
    // 1. Validate outlet
    // --------------------------------------------------

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: outletId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
      },
    });

    if (!outlet) {
      throw createError(404, "Outlet not found.");
    }

    // --------------------------------------------------
    // 2. Common filters
    // --------------------------------------------------

    const baseWhere = {
      outletId,
      placedAt: {
        gte: from,
        lte: to,
      },
    };

    // Revenue includes only successful payments
    // and excludes cancelled orders.
    const revenueWhere = {
      ...baseWhere,
      paymentStatus: "SUCCEEDED",
      status: {
        not: "CANCELLED",
      },
    };

    // Active orders are operationally active regardless
    // of their payment status or the selected date range.
    const activeStatuses = ["PLACED", "ACCEPTED", "PREPARING", "READY"];

    const activeWhere = {
      outletId,
      status: {
        in: activeStatuses,
      },
    };

    // Late orders are active orders from the selected period
    // whose promised delivery/preparation time has passed.
    const lateWhere = {
      ...baseWhere,
      status: {
        in: activeStatuses,
      },
      promisedAt: {
        lt: now,
      },
    };

    // --------------------------------------------------
    // 3. Main outlet analytics queries
    // --------------------------------------------------

    const [
      totalOrders,
      completedOrders,
      cancelledOrders,
      activeOrders,
      revenueAggregate,
      paidOrderCount,
      lateOrders,
      statusRows,
      fulfillmentRows,
      totalMenuItems,
      availableMenuItems,
      avgPrepRows,
      dailyTrendRows,
    ] = await Promise.all([
      // All orders placed during the selected period.
      prisma.order.count({
        where: baseWhere,
      }),

      // Successfully completed operational orders.
      prisma.order.count({
        where: {
          ...baseWhere,
          status: "HANDED_OFF",
        },
      }),

      // Cancelled orders during the selected period.
      prisma.order.count({
        where: {
          ...baseWhere,
          status: "CANCELLED",
        },
      }),

      // Current active orders, independent of date range.
      prisma.order.count({
        where: activeWhere,
      }),

      // Total revenue from successfully paid,
      // non-cancelled orders.
      prisma.order.aggregate({
        where: revenueWhere,
        _sum: {
          totalAmount: true,
        },
      }),

      // Same filter as revenue, ensuring a consistent
      // average order value denominator.
      prisma.order.count({
        where: revenueWhere,
      }),

      // Currently overdue active orders from the selected period.
      prisma.order.count({
        where: lateWhere,
      }),

      // Order status distribution.
      prisma.order.groupBy({
        by: ["status"],
        where: baseWhere,
        _count: {
          _all: true,
        },
      }),

      // Delivery versus pickup distribution.
      prisma.order.groupBy({
        by: ["fulfillmentType"],
        where: baseWhere,
        _count: {
          _all: true,
        },
      }),

      // Total outlet menu mappings.
      prisma.outletMenuItem.count({
        where: {
          outletId,
        },
      }),

      // Available mappings whose central food item is active.
      prisma.outletMenuItem.count({
        where: {
          outletId,
          isAvailable: true,
          foodItem: {
            isActive: true,
          },
        },
      }),

      // Actual preparation duration.
      // Only orders that reached READY or HANDED_OFF are included.
      // Payment status is deliberately not used here because
      // preparation time is an operational metric.
      prisma.$queryRaw`
        SELECT
          ROUND(
            AVG(
              EXTRACT(
                EPOCH FROM ("ready_at" - "started_at")
              ) / 60.0
            )
          )::int AS "averagePreparationMinutes"

        FROM "orders"

        WHERE "outlet_id" = ${outletId}
          AND "placed_at" >= ${from}
          AND "placed_at" <= ${to}
          AND "status" IN ('READY', 'HANDED_OFF')
          AND "started_at" IS NOT NULL
          AND "ready_at" IS NOT NULL
          AND "ready_at" >= "started_at"
      `,

      // Daily order count and revenue.
      // placed_at is a PostgreSQL timestamptz field.
      // Convert it to India time before grouping by date.
      prisma.$queryRaw`
        SELECT
          DATE(
            "placed_at" AT TIME ZONE 'Asia/Kolkata'
          )::text AS "date",

          COUNT(*)::int AS "orders",

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
          )::float AS "revenue"

        FROM "orders"

        WHERE "outlet_id" = ${outletId}
          AND "placed_at" >= ${from}
          AND "placed_at" <= ${to}

        GROUP BY DATE(
          "placed_at" AT TIME ZONE 'Asia/Kolkata'
        )

        ORDER BY "date" ASC
      `,
    ]);

    // --------------------------------------------------
    // 4. Calculate summary metrics
    // --------------------------------------------------

    const totalRevenue = Number(revenueAggregate._sum.totalAmount || 0);

    const averageOrderValue = paidOrderCount
      ? Math.round((totalRevenue / paidOrderCount) * 100) / 100
      : 0;

    const averagePreparationMinutes =
      avgPrepRows[0]?.averagePreparationMinutes == null
        ? null
        : Number(avgPrepRows[0].averagePreparationMinutes);

    // --------------------------------------------------
    // 5. Order status breakdown
    // --------------------------------------------------

    const statusMap = new Map(
      statusRows.map((row) => [row.status, row._count._all]),
    );

    const orderStatusBreakdown = ORDER_STATUSES.map((status) => {
      const count = statusMap.get(status) || 0;

      return {
        status,
        name: displayOrderStatus(status),
        count,
        value: count,
      };
    });

    // --------------------------------------------------
    // 6. Fulfillment breakdown
    // --------------------------------------------------

    const fulfillmentMap = new Map(
      fulfillmentRows.map((row) => [row.fulfillmentType, row._count._all]),
    );

    const fulfillmentBreakdown = FULFILLMENT_TYPES.map((type) => {
      const count = fulfillmentMap.get(type) || 0;

      return {
        type,
        name: type === "DELIVERY" ? "Delivery" : "Pickup",
        count,
        value: count,
      };
    });

    // --------------------------------------------------
    // 7. Daily trend
    // --------------------------------------------------

    const dailyTrend = dailyTrendRows.map((row) => ({
      date: row.date,

      label: new Date(`${row.date}T00:00:00+05:30`).toLocaleDateString(
        "en-IN",
        {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
        },
      ),

      orders: Number(row.orders),
      revenue: Number(row.revenue),
    }));

    // --------------------------------------------------
    // 8. Menu availability metrics
    // --------------------------------------------------

    const unavailableMenuItems = Math.max(
      0,
      totalMenuItems - availableMenuItems,
    );

    // --------------------------------------------------
    // 9. Customer metrics, popular items and recent orders
    // --------------------------------------------------

    const [repeatCustomerRows, popularItemRows, recentOrders] =
      await Promise.all([
        // Repeat customer calculation:
        // A repeat customer has placed more than one
        // successfully paid and handed-off order
        // during the selected period.
        prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (
            WHERE "orderCount" > 1
          )::int AS "repeatCustomers",

          COUNT(*)::int AS "uniqueCustomers"

        FROM (
          SELECT
            "customer_id",
            COUNT(*) AS "orderCount"

          FROM "orders"

          WHERE "outlet_id" = ${outletId}
            AND "placed_at" >= ${from}
            AND "placed_at" <= ${to}
            AND "customer_id" IS NOT NULL
            AND "status" = 'HANDED_OFF'
            AND "payment_status" = 'SUCCEEDED'

          GROUP BY "customer_id"
        ) AS customer_orders
      `,

        // Top five items based on quantity sold.
        // Item names are snapshots stored in order_items,
        // so this works even if the original food item changes.
        prisma.$queryRaw`
        SELECT
          oi."item_name" AS "name",
          SUM(oi."quantity")::int AS "quantity"

        FROM "order_items" oi

        INNER JOIN "orders" o
          ON o."id" = oi."order_id"

        WHERE o."outlet_id" = ${outletId}
          AND o."placed_at" >= ${from}
          AND o."placed_at" <= ${to}
          AND o."payment_status" = 'SUCCEEDED'
          AND o."status" <> 'CANCELLED'

        GROUP BY oi."item_name"

        ORDER BY
          SUM(oi."quantity") DESC,
          oi."item_name" ASC

        LIMIT 5
      `,

        // Bounded recent-order data for existing UI components.
        // Do not calculate complete analytics from this array.
        prisma.order.findMany({
          where: baseWhere,
          include: orderInclude,
          orderBy: {
            placedAt: "desc",
          },
          take: 200,
        }),
      ]);

    // --------------------------------------------------
    // 10. Calculate repeat customer rate
    // --------------------------------------------------

    const repeatMetrics = repeatCustomerRows[0] || {
      repeatCustomers: 0,
      uniqueCustomers: 0,
    };

    const repeatCustomers = Number(repeatMetrics.repeatCustomers || 0);

    const uniqueCustomers = Number(repeatMetrics.uniqueCustomers || 0);

    const repeatRate = uniqueCustomers
      ? Math.round((repeatCustomers / uniqueCustomers) * 100)
      : 0;

    // --------------------------------------------------
    // 11. Format popular items
    // --------------------------------------------------

    const popularItems = popularItemRows.map((row) => ({
      name: row.name,
      value: Number(row.quantity),
    }));

    // --------------------------------------------------
    // 12. Send response
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Outlet analytics retrieved successfully.",

      data: {
        outlet: {
          id: outlet.id,
          name: outlet.name,
          code: outlet.code,
          isActive: outlet.isActive,
        },

        period: {
          from: from.toISOString(),
          to: to.toISOString(),
          label,
          timezone: "Asia/Kolkata",
        },

        summary: {
          totalOrders,
          completedOrders,
          cancelledOrders,
          activeOrders,

          totalRevenue,
          averageOrderValue,

          averagePreparationMinutes,
          lateOrders,
        },

        menu: {
          totalItems: totalMenuItems,
          availableItems: availableMenuItems,
          unavailableItems: unavailableMenuItems,
        },

        orderStatusBreakdown,
        fulfillmentBreakdown,
        dailyTrend,

        // Chart-friendly aliases.
        orderTrend: dailyTrend.map((row) => ({
          label: row.label,
          value: row.orders,
        })),

        revenueTrend: dailyTrend.map((row) => ({
          label: row.label,
          value: row.revenue,
        })),

        // Compatibility fields for existing frontend components.
        orderCount: totalOrders,
        revenue: totalRevenue,
        avgOrder: averageOrderValue,
        cancelled: cancelledOrders,
        late: lateOrders,
        avgPrep: averagePreparationMinutes,

        // Bounded recent order list.
        orders: recentOrders.map(mapOrder),

        // Customer and item analytics.
        repeatCustomers,
        repeatRate,
        popularItems,
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   G. OUTLET ORDERS
   GET /admin/outlets/:outletId/orders
========================================================= */

export async function getOutletOrders(req, res, next) {
  try {
    const outletId = getOutletId(req);

    const { page, limit, skip } = parsePagination(req.query, 20);

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: outletId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!outlet) {
      throw createError(404, "Outlet not found.");
    }

    const where = {
      // Every query is scoped to exactly the requested outlet.
      outletId,
    };

    if (req.query.status !== undefined && req.query.status !== "all") {
      const status = String(req.query.status)
        .trim()
        .toUpperCase()
        .replaceAll(" ", "_");

      if (!ORDER_STATUSES.includes(status)) {
        throw createError(400, "Invalid order status filter.");
      }

      where.status = status;
    }

    if (
      req.query.paymentStatus !== undefined &&
      req.query.paymentStatus !== "all"
    ) {
      const paymentStatus = String(req.query.paymentStatus)
        .trim()
        .toUpperCase();

      if (!PAYMENT_STATUSES.includes(paymentStatus)) {
        throw createError(400, "Invalid payment status filter.");
      }

      where.paymentStatus = paymentStatus;
    }

    if (
      req.query.paymentMethod !== undefined &&
      req.query.paymentMethod !== "all"
    ) {
      const paymentMethod = String(req.query.paymentMethod)
        .trim()
        .toUpperCase();

      if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw createError(400, "Invalid payment method filter.");
      }

      where.paymentMethod = paymentMethod;
    }

    if (
      req.query.fulfillmentType !== undefined &&
      req.query.fulfillmentType !== "all"
    ) {
      const fulfillmentType = String(req.query.fulfillmentType)
        .trim()
        .toUpperCase();

      if (!FULFILLMENT_TYPES.includes(fulfillmentType)) {
        throw createError(400, "Invalid fulfilment type filter.");
      }

      where.fulfillmentType = fulfillmentType;
    }

    if (req.query.search !== undefined) {
      const search = requiredString(req.query.search, "Search", 1, 100);

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
        {
          customerPhone: {
            contains: search,
          },
        },
      ];
    }

    if (req.query.from || req.query.to) {
      const placedAt = {};

      if (req.query.from) {
        placedAt.gte = parseDateOnly(req.query.from, "From date");
      }

      if (req.query.to) {
        placedAt.lte = parseDateOnly(req.query.to, "To date", true);
      }

      if (placedAt.gte && placedAt.lte && placedAt.gte > placedAt.lte) {
        throw createError(400, "From date must not be after to date.");
      }

      where.placedAt = placedAt;
    }

    const allowedSortFields = [
      "placedAt",
      "promisedAt",
      "totalAmount",
      "status",
      "paymentStatus",
    ];

    const sortBy = req.query.sortBy || "placedAt";
    const sortOrder = req.query.sortOrder || "desc";

    if (!allowedSortFields.includes(sortBy)) {
      throw createError(
        400,
        `sortBy must be one of: ${allowedSortFields.join(", ")}.`,
      );
    }

    if (!["asc", "desc"].includes(sortOrder)) {
      throw createError(400, "sortOrder must be asc or desc.");
    }

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: [
          {
            [sortBy]: sortOrder,
          },
          {
            id: "desc",
          },
        ],
        skip,
        take: limit,
      }),

      prisma.order.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Outlet orders retrieved successfully.",
      data: {
        outlet: {
          id: outlet.id,
          name: outlet.name,
        },

        orders: rows.map(mapOrder),

        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   H. OUTLET MENU
   GET /admin/outlets/:outletId/menu
========================================================= */

export async function getOutletMenu(req, res, next) {
  try {
    const outletId = getOutletId(req);

    const { page, limit, skip } = parsePagination(req.query, 50);

    const outlet = await prisma.outlet.findUnique({
      where: {
        id: outletId,
      },
      select: {
        id: true,
        name: true,
        cityId: true,
        city: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!outlet) {
      throw createError(404, "Outlet not found.");
    }

    const where = {
      outletId,
    };

    const foodItemWhere = {};

    if (req.query.search !== undefined) {
      const search = requiredString(req.query.search, "Search", 1, 100);

      foodItemWhere.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    if (req.query.category !== undefined && req.query.category !== "all") {
      foodItemWhere.category = {
        equals: requiredString(req.query.category, "Category", 1, 80),
        mode: "insensitive",
      };
    }

    // The current schema stores category as FoodItem.category (String).
    // There is no FoodCategory model or categoryId field.
    if (req.query.categoryId !== undefined && req.query.categoryId !== "all") {
      throw createError(
        400,
        "categoryId is not supported by the current schema. Use category.",
      );
    }

    if (req.query.foodType !== undefined && req.query.foodType !== "all") {
      const foodType = String(req.query.foodType).trim().toUpperCase();

      if (!["VEG", "NON_VEG"].includes(foodType)) {
        throw createError(400, "foodType must be VEG or NON_VEG.");
      }

      foodItemWhere.foodType = foodType;
    }

    if (Object.keys(foodItemWhere).length > 0) {
      where.foodItem = {
        is: foodItemWhere,
      };
    }
    const isAvailable = parseBooleanQuery(req.query.isAvailable, "isAvailable");

    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable;
    }

    const allowedSortFields = [
      "name",
      "category",
      "createdAt",
      "stockQuantity",
      "isAvailable",
    ];

    const sortBy = req.query.sortBy || "name";
    const sortOrder = req.query.sortOrder || "asc";

    if (!allowedSortFields.includes(sortBy)) {
      throw createError(
        400,
        `sortBy must be one of: ${allowedSortFields.join(", ")}.`,
      );
    }

    if (!["asc", "desc"].includes(sortOrder)) {
      throw createError(400, "sortOrder must be asc or desc.");
    }

    let orderBy;

    if (sortBy === "name") {
      orderBy = {
        foodItem: {
          name: sortOrder,
        },
      };
    } else if (sortBy === "category") {
      orderBy = {
        foodItem: {
          category: sortOrder,
        },
      };
    } else {
      orderBy = {
        [sortBy]: sortOrder,
      };
    }

    const [rows, total] = await Promise.all([
      prisma.outletMenuItem.findMany({
        where,

        include: {
          foodItem: {
            include: {
              portions: {
                orderBy: {
                  name: "asc",
                },
              },

              addonGroups: {
                orderBy: {
                  sortOrder: "asc",
                },

                include: {
                  options: {
                    orderBy: {
                      sortOrder: "asc",
                    },
                  },
                },
              },

              cityPrices: {
                where: {
                  cityId: outlet.cityId,
                },
                select: {
                  price: true,
                },
                take: 1,
              },
            },
          },
        },

        orderBy,

        skip,
        take: limit,
      }),

      prisma.outletMenuItem.count({
        where,
      }),
    ]);

    const menuItems = rows.map((mapping) => {
      const food = mapping.foodItem;

      const basePrice = Number(food.basePrice);

      const cityPrice = food.cityPrices[0]
        ? Number(food.cityPrices[0].price)
        : null;

      const outletOverride = decimalNumber(mapping.priceOverride);

      // Pricing precedence:
      // outlet override -> city price -> central default.
      const effectivePrice = outletOverride ?? cityPrice ?? basePrice;

      const addonGroups = food.addonGroups.map((group) => ({
        id: group.id,
        name: group.name,
        required: group.isRequired,
        isRequired: group.isRequired,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,

        options: group.options.map((option) => ({
          id: option.id,
          name: option.name,
          price: Number(option.price),
          active: option.isActive,
          isActive: option.isActive,
        })),
      }));

      const flattenedAddons = addonGroups.flatMap((group) =>
        group.options.map((option) => ({
          ...option,
          groupId: group.id,
          groupName: group.name,
        })),
      );

      return {
        // Food item fields used by the existing OutletMenuTab.
        id: food.id,
        itemId: food.id,
        name: food.name,
        description: food.description,
        image: food.imageUrl,
        imageUrl: food.imageUrl,
        category: food.category,

        veg: food.foodType === "VEG",
        foodType: food.foodType,
        spice: food.spiceLevel,
        spiceLevel: food.spiceLevel,
        allergens: food.allergens,

        prepTime: food.prepTimeMinutes,
        prepTimeMinutes: food.prepTimeMinutes,

        basePrice,
        cityPrice,
        effectivePrice,

        active: food.isActive,
        isActive: food.isActive,

        portions: food.portions.map((portion) => ({
          id: portion.id,
          name: portion.name,
          price: Number(portion.price),
          active: portion.isActive,
          isActive: portion.isActive,
        })),

        addonGroups,

        // Compatibility with current outlet menu UI.
        addons: flattenedAddons,
        addonGroupName: addonGroups[0]?.name || null,
        addonsRequired: addonGroups.some((group) => group.isRequired),

        mapping: {
          id: mapping.id,
          outletMenuItemId: mapping.id,
          outletId: mapping.outletId,
          itemId: mapping.foodItemId,

          available: mapping.isAvailable,
          isAvailable: mapping.isAvailable,

          stockQty: mapping.stockQuantity,
          stockQuantity: mapping.stockQuantity,

          priceOverride: outletOverride,
          timeMenu: mapping.timeMenuLabel,
          timeMenuLabel: mapping.timeMenuLabel,

          unavailabilityReason: mapping.unavailabilityReason,

          expectedRestockAt: mapping.expectedRestockAt?.toISOString() || null,

          updatedAt: mapping.updatedAt.toISOString(),
        },
      };
    });

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Outlet menu retrieved successfully.",
      data: {
        outlet: {
          id: outlet.id,
          name: outlet.name,
          cityId: outlet.cityId,
          city: outlet.city.name,
        },

        menuItems,

        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   MANAGER OTP CONFIGURATION AND CRYPTOGRAPHY
========================================================= */

function getOtpSettings() {
  function readInteger(name, fallback, allowZero = false) {
    const raw = process.env[name];

    if (raw === undefined || raw === "") {
      return fallback;
    }

    const value = Number(raw);

    if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value < 1)) {
      throw new Error(`${name} must be a valid integer.`);
    }

    return value;
  }

  return {
    maxAttempts: readInteger("OTP_MAX_ATTEMPTS", 5),
    expiryMinutes: readInteger("OTP_EXPIRES_MINUTES", 5),
    resendSeconds: readInteger("OTP_RESEND_SECONDS", 30, true),
    requestLimit: 5,
    requestWindowMinutes: 15,
  };
}

function getOtpSecret() {
  const secret = process.env.OTP_SECRET;

  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("OTP_SECRET must contain at least 32 bytes.");
  }

  return secret;
}

function generateOtp() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

/*
 * The challenge schema does not have an outletId field.
 *
 * Bind the outlet ID into the HMAC:
 *
 * phone : purpose : outletId : otp
 *
 * An OTP created for one outlet therefore cannot verify for another outlet.
 */
function normaliseManagerName(value) {
  return requiredString(value, "Manager name", 2, 120)
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

function hashManagerOtp(phone, outletId, managerName, otp) {
  const normalizedName = normaliseManagerName(managerName).toLowerCase();

  return createHmac("sha256", getOtpSecret())
    .update(`${phone}:${OTP_PURPOSE}:${outletId}:${normalizedName}:${otp}`)
    .digest("hex");
}

function safeCompareHash(first, second) {
  if (
    typeof first !== "string" ||
    typeof second !== "string" ||
    !/^[a-f0-9]{64}$/i.test(first) ||
    !/^[a-f0-9]{64}$/i.test(second)
  ) {
    return false;
  }

  return timingSafeEqual(Buffer.from(first, "hex"), Buffer.from(second, "hex"));
}

/* =========================================================
   MANAGER ACCOUNT VALIDATION
========================================================= */

async function findEligibleManagerByPhone(phone) {
  const manager = await prisma.user.findUnique({
    where: {
      phone,
    },

    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      phoneVerifiedAt: true,

      managedOutlet: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!manager) {
    throw createError(
      404,
      "No existing staff account was found for this mobile number. Create the Outlet Manager account through the approved staff provisioning process first.",
      "MANAGER_ACCOUNT_NOT_FOUND",
    );
  }

  if (manager.role !== "OUTLET_MANAGER") {
    throw createError(
      403,
      "Only an OUTLET_MANAGER account can be assigned to an outlet.",
      "INVALID_MANAGER_ROLE",
    );
  }

  if (!manager.isActive) {
    throw createError(
      403,
      "This Outlet Manager account is inactive.",
      "MANAGER_INACTIVE",
    );
  }

  return manager;
}

function validateManagerName(inputName, manager) {
  const name = requiredString(inputName, "Manager name", 2, 120);

  if (name.toLowerCase() !== manager.fullName.trim().toLowerCase()) {
    throw createError(
      422,
      "The entered manager name does not match the existing staff account.",
      "MANAGER_NAME_MISMATCH",
    );
  }
}

/* =========================================================
   OTP CHALLENGE LOOKUP
========================================================= */

/*
 * The current frontend verify call sends:
 *
 * { outletId, otp }
 *
 * It does not send the manager phone or challenge ID.
 *
 * Therefore, find a bounded list of recent pending manager challenges,
 * then compare the submitted OTP against the HMAC calculated for this
 * route's outlet ID.
 *
 * This also ensures an OTP for another outlet cannot pass verification.
 */

async function findMatchingManagerChallenge({
  outletId,
  phone,
  managerName,
  otp,
  tx = prisma,
}) {
  const settings = getOtpSettings();
  const now = new Date();

  const challenges = await tx.otpChallenge.findMany({
    where: {
      phone,
      purpose: OTP_PURPOSE,
      consumedAt: null,
      userId: null,
    },

    orderBy: {
      createdAt: "desc",
    },

    take: 25,
  });

  if (!challenges.length) {
    throw createError(
      400,
      "No pending manager OTP was found. Request a new code.",
      "MANAGER_OTP_NOT_FOUND",
    );
  }

  let mostRecentValidCandidate = null;
  let expiredCandidateFound = false;
  let exhaustedCandidateFound = false;

  for (const challenge of challenges) {
    if (challenge.expiresAt <= now) {
      expiredCandidateFound = true;
      continue;
    }

    if (challenge.attempts >= settings.maxAttempts) {
      exhaustedCandidateFound = true;
      continue;
    }

    if (!mostRecentValidCandidate) {
      mostRecentValidCandidate = challenge;
    }

    const expectedHash = hashManagerOtp(
      challenge.phone,
      outletId,
      managerName,
      otp,
    );

    if (safeCompareHash(challenge.codeHash, expectedHash)) {
      return {
        challenge,
        settings,
      };
    }
  }

  // Incorrect OTP: increment attempts on the latest
  // eligible challenge.
  if (mostRecentValidCandidate) {
    const updated = await tx.otpChallenge.updateMany({
      where: {
        id: mostRecentValidCandidate.id,
        phone,
        purpose: OTP_PURPOSE,
        userId: null,
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
        attempts: {
          lt: settings.maxAttempts,
        },
      },

      data: {
        attempts: {
          increment: 1,
        },
      },
    });

    if (updated.count === 1) {
      const latest = await tx.otpChallenge.findUnique({
        where: {
          id: mostRecentValidCandidate.id,
        },

        select: {
          attempts: true,
        },
      });

      const attempts = latest?.attempts || settings.maxAttempts;

      const remaining = Math.max(0, settings.maxAttempts - attempts);

      throw createError(
        remaining > 0 ? 400 : 429,

        remaining > 0
          ? `Incorrect OTP. ${remaining} attempts remaining.`
          : "Too many incorrect attempts. Request a new OTP.",

        remaining > 0 ? "INVALID_OTP" : "OTP_ATTEMPTS_EXCEEDED",
      );
    }
  }

  if (exhaustedCandidateFound) {
    throw createError(
      429,
      "Too many incorrect attempts. Request a new OTP.",
      "OTP_ATTEMPTS_EXCEEDED",
    );
  }

  if (expiredCandidateFound) {
    throw createError(
      400,
      "The manager OTP has expired. Request a new code.",
      "OTP_EXPIRED",
    );
  }

  throw createError(400, "Incorrect OTP.", "INVALID_OTP");
}

/* =========================================================
   OTP REQUEST COOLDOWN
========================================================= */

async function createManagerOtpChallenge({
  phone,
  outletId,
  managerName,
  otp,
}) {
  const settings = getOtpSettings();
  const now = new Date();

  const windowStart = new Date(
    now.getTime() - settings.requestWindowMinutes * 60 * 1000,
  );

  const expiresAt = new Date(
    now.getTime() + settings.expiryMinutes * 60 * 1000,
  );

  const codeHash = hashManagerOtp(phone, outletId, managerName, otp);

  await prisma.$transaction(
    async (tx) => {
      const requestCount = await tx.otpChallenge.count({
        where: {
          phone,
          purpose: OTP_PURPOSE,
          createdAt: {
            gte: windowStart,
          },
        },
      });

      if (requestCount >= settings.requestLimit) {
        throw createError(
          429,
          "Too many OTP requests. Try again later.",
          "OTP_REQUEST_LIMIT",
        );
      }

      const latest = await tx.otpChallenge.findFirst({
        where: {
          phone,
          purpose: OTP_PURPOSE,
        },

        orderBy: {
          createdAt: "desc",
        },

        select: {
          createdAt: true,
        },
      });

      if (latest) {
        const secondsSinceRequest =
          (now.getTime() - latest.createdAt.getTime()) / 1000;

        if (secondsSinceRequest < settings.resendSeconds) {
          const remaining = Math.ceil(
            settings.resendSeconds - secondsSinceRequest,
          );

          throw createError(
            429,
            `Wait ${remaining} seconds before requesting another OTP.`,
            "OTP_RESEND_COOLDOWN",
          );
        }
      }

      // Invalidate previous unused manager OTP challenges
      // for this phone number.
      await tx.otpChallenge.updateMany({
        where: {
          phone,
          purpose: OTP_PURPOSE,
          consumedAt: null,
        },

        data: {
          consumedAt: now,
        },
      });

      await tx.otpChallenge.create({
        data: {
          userId: null,
          phone,
          codeHash,
          purpose: OTP_PURPOSE,
          attempts: 0,
          expiresAt,
        },
      });
    },

    {
      isolationLevel: "Serializable",
    },
  );

  return {
    expiresAt,
    expiresInSeconds: settings.expiryMinutes * 60,
    resendAfterSeconds: settings.resendSeconds,
  };
}

/* =========================================================
   I. SEND MANAGER OTP
   POST /admin/outlets/:outletId/manager/otp
========================================================= */

export async function sendManagerOtp(req, res, next) {
  try {
    const outletId = getOutletId(req);

    assertObject(req.body);

    assertOnlyKeys(req.body, ["name", "phone", "outletId"]);

    if (req.body.outletId !== undefined && req.body.outletId !== outletId) {
      throw createError(
        400,
        "The outlet ID in the body does not match the URL.",
      );
    }

    const managerName = normaliseManagerName(req.body.name);
    const phone = validPhone(req.body.phone);

    // 1. Validate outlet.
    const outlet = await prisma.outlet.findUnique({
      where: {
        id: outletId,
      },

      select: {
        id: true,
        name: true,
        isActive: true,
        managerId: true,
      },
    });

    if (!outlet) {
      throw createError(404, "Outlet not found.");
    }

    if (!outlet.isActive) {
      throw createError(422, "Activate the outlet before assigning a manager.");
    }

    if (outlet.managerId) {
      throw createError(
        409,
        "This outlet already has a manager. Remove the existing manager first.",
        "OUTLET_MANAGER_ALREADY_ASSIGNED",
      );
    }

    // 2. Manager account must not already exist.
    const existingUser = await prisma.user.findUnique({
      where: {
        phone,
      },

      select: {
        id: true,
        role: true,
      },
    });

    if (existingUser) {
      throw createError(
        409,
        "An account already exists with this phone number. Use a phone number that is not registered.",
        "PHONE_ALREADY_REGISTERED",
      );
    }

    // 3. Do not create an OTP challenge in production
    // until an actual SMS provider is configured.
    if (process.env.NODE_ENV === "production") {
      throw createError(
        503,
        "Manager OTP delivery is not configured. Configure an SMS provider before using this operation in production.",
        "OTP_DELIVERY_UNAVAILABLE",
      );
    }

    // 4. Generate secure six-digit OTP.
    const otp = generateOtp();

    // 5. Store the hashed OTP challenge.
    // No User account is created at this stage.
    const challenge = await createManagerOtpChallenge({
      phone,
      outletId,
      managerName,
      otp,
    });

    // 6. Return development OTP only in development.
    return res.status(200).json({
      success: true,
      message:
        "Manager OTP generated successfully. No manager account has been created yet.",

      data: {
        outletId,

        manager: {
          name: managerName,
          phone: maskPhone(phone),
        },

        expiresAt: challenge.expiresAt.toISOString(),
        expiresInSeconds: challenge.expiresInSeconds,
        resendAfterSeconds: challenge.resendAfterSeconds,

        ...(process.env.NODE_ENV === "development" ? { devOtp: otp } : {}),
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   J. VERIFY MANAGER OTP
   POST /admin/outlets/:outletId/manager/verify
========================================================= */

export async function verifyManagerOtp(req, res, next) {
  try {
    const outletId = getOutletId(req);

    assertObject(req.body);

    assertOnlyKeys(req.body, ["outletId", "name", "phone", "otp"]);

    if (req.body.outletId !== undefined && req.body.outletId !== outletId) {
      throw createError(
        400,
        "The outlet ID in the body does not match the URL.",
      );
    }

    const managerName = normaliseManagerName(req.body.name);
    const phone = validPhone(req.body.phone);

    if (typeof req.body.otp !== "string" || !OTP_REGEX.test(req.body.otp)) {
      throw createError(400, "Enter a valid 6-digit OTP.");
    }

    const otp = req.body.otp;

    // --------------------------------------------------
    // 1. Find and verify the OTP challenge.
    // This also increments attempts for an incorrect OTP.
    // --------------------------------------------------

    const { challenge: matchedChallenge, settings } =
      await findMatchingManagerChallenge({
        outletId,
        phone,
        managerName,
        otp,
      });

    const now = new Date();

    // --------------------------------------------------
    // 2. Create manager and assign outlet atomically.
    // --------------------------------------------------

    const result = await prisma.$transaction(
      async (tx) => {
        // A. Validate outlet again inside transaction.
        const outlet = await tx.outlet.findUnique({
          where: {
            id: outletId,
          },

          select: {
            id: true,
            name: true,
            isActive: true,
            managerId: true,
          },
        });

        if (!outlet) {
          throw createError(404, "Outlet not found.");
        }

        if (!outlet.isActive) {
          throw createError(
            422,
            "The outlet is inactive. Activate it before assigning a manager.",
          );
        }

        if (outlet.managerId) {
          throw createError(
            409,
            "This outlet already has a manager. Remove the existing manager first.",
            "OUTLET_MANAGER_ALREADY_ASSIGNED",
          );
        }

        // B. Recheck phone uniqueness.
        // Another account might have registered this phone
        // after the OTP was generated.
        const existingUser = await tx.user.findUnique({
          where: {
            phone,
          },

          select: {
            id: true,
            role: true,
          },
        });

        if (existingUser) {
          throw createError(
            409,
            "An account already exists with this phone number. The manager account was not created.",
            "PHONE_ALREADY_REGISTERED",
          );
        }

        // C. Re-fetch the OTP challenge.
        const challenge = await tx.otpChallenge.findUnique({
          where: {
            id: matchedChallenge.id,
          },
        });

        if (
          !challenge ||
          challenge.userId !== null ||
          challenge.phone !== phone ||
          challenge.purpose !== OTP_PURPOSE ||
          challenge.consumedAt !== null ||
          challenge.expiresAt <= now ||
          challenge.attempts >= settings.maxAttempts ||
          challenge.codeHash !== matchedChallenge.codeHash
        ) {
          throw createError(
            409,
            "The manager OTP has expired, been consumed, or been replaced. Request a new OTP.",
            "OTP_NO_LONGER_VALID",
          );
        }

        // D. Verify the HMAC again inside the transaction.
        const expectedHash = hashManagerOtp(phone, outletId, managerName, otp);

        if (!safeCompareHash(challenge.codeHash, expectedHash)) {
          throw createError(
            400,
            "The manager OTP is no longer valid.",
            "INVALID_OTP",
          );
        }

        // E. Create the manager account.
        //
        // The role is assigned by the backend.
        // Never accept a role from the frontend.
        const manager = await tx.user.create({
          data: {
            fullName: managerName,
            phone,
            role: "OUTLET_MANAGER",
            isActive: true,
            phoneVerifiedAt: now,
          },

          select: outletManagerSelect,
        });

        // F. Consume and link the OTP challenge.
        //
        // Conditional update prevents the same OTP from
        // being used concurrently by two requests.
        const consumed = await tx.otpChallenge.updateMany({
          where: {
            id: challenge.id,
            phone,
            purpose: OTP_PURPOSE,
            userId: null,
            consumedAt: null,
            codeHash: expectedHash,

            expiresAt: {
              gt: now,
            },

            attempts: {
              lt: settings.maxAttempts,
            },
          },

          data: {
            userId: manager.id,
            consumedAt: now,
          },
        });

        if (consumed.count !== 1) {
          throw createError(
            409,
            "This OTP has already been used or is no longer valid. Request a new OTP.",
            "OTP_ALREADY_USED",
          );
        }

        // G. Assign the newly created manager.
        //
        // managerId: null makes this a conditional assignment.
        // A concurrent admin cannot silently overwrite a manager.
        const assigned = await tx.outlet.updateMany({
          where: {
            id: outletId,
            isActive: true,
            managerId: null,
          },

          data: {
            managerId: manager.id,
          },
        });

        if (assigned.count !== 1) {
          throw createError(
            409,
            "The outlet could not be assigned because its status or manager assignment changed. Please refresh and try again.",
            "OUTLET_ASSIGNMENT_CONFLICT",
          );
        }

        // H. Fetch the updated outlet response.
        const updatedOutlet = await tx.outlet.findUnique({
          where: {
            id: outletId,
          },

          include: outletListInclude,
        });

        // I. Record audit log.
        await writeAudit(
          tx,
          req,
          "OUTLET_MANAGER_CREATED_AND_ASSIGNED",
          "OUTLET",
          outletId,
          {
            managerId: manager.id,
            managerName: manager.fullName,
            managerPhone: maskPhone(manager.phone),
            otpChallengeId: challenge.id,
          },
        );

        return {
          outlet: updatedOutlet,
          manager,
        };
      },

      {
        isolationLevel: "Serializable",
      },
    );

    // --------------------------------------------------
    // 3. Return successful assignment.
    // --------------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Manager account created and assigned to the outlet successfully.",

      data: {
        outlet: mapOutlet(result.outlet),

        manager: mapManager(result.manager),

        assignedAt: now.toISOString(),
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

/* =========================================================
   K. ASSIGN / REPLACE MANAGER
   PUT /admin/outlets/:outletId/manager
========================================================= */

export async function assignManager(req, res, next) {
  try {
    const outletId = getOutletId(req);

    assertObject(req.body);

    assertOnlyKeys(req.body, ["otp", "phone", "outletId"]);

    if (req.body.outletId !== undefined && req.body.outletId !== outletId) {
      throw createError(
        400,
        "The outlet ID in the body does not match the URL.",
      );
    }

    if (typeof req.body.otp !== "string" || !OTP_REGEX.test(req.body.otp)) {
      throw createError(
        400,
        "A valid 6-digit OTP is required to assign the manager.",
      );
    }

    const phone =
      req.body.phone === undefined ? undefined : validPhone(req.body.phone);

    // Find the matching OTP challenge before opening the transaction.
    // The same challenge is checked again inside the transaction.
    const { challenge: matchedChallenge, settings } =
      await findMatchingManagerChallenge({
        outletId,
        otp: req.body.otp,
        phone,
      });

    if (!matchedChallenge.userId) {
      throw createError(
        400,
        "The manager OTP challenge has no associated user account.",
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        const outlet = await tx.outlet.findUnique({
          where: {
            id: outletId,
          },

          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            managerId: true,

            manager: {
              select: outletManagerSelect,
            },
          },
        });

        if (!outlet) {
          throw createError(404, "Outlet not found.");
        }

        if (!outlet.isActive) {
          throw createError(
            422,
            "Activate the outlet before assigning a manager.",
          );
        }

        const manager = await tx.user.findUnique({
          where: {
            id: matchedChallenge.userId,
          },

          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            role: true,
            isActive: true,
            phoneVerifiedAt: true,

            managedOutlet: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (
          !manager ||
          manager.phone !== matchedChallenge.phone ||
          manager.role !== "OUTLET_MANAGER" ||
          !manager.isActive
        ) {
          throw createError(
            403,
            "The verified manager account is no longer eligible.",
          );
        }

        if (manager.managedOutlet && manager.managedOutlet.id !== outletId) {
          throw createError(
            409,
            `This manager is already assigned to ${manager.managedOutlet.name}.`,
            "MANAGER_ALREADY_ASSIGNED",
          );
        }

        // Recheck the challenge inside the transaction.
        const challenge = await tx.otpChallenge.findUnique({
          where: {
            id: matchedChallenge.id,
          },
        });

        if (
          !challenge ||
          challenge.userId !== manager.id ||
          challenge.phone !== manager.phone ||
          challenge.purpose !== OTP_PURPOSE ||
          challenge.consumedAt !== null ||
          challenge.expiresAt <= now ||
          challenge.attempts >= settings.maxAttempts
        ) {
          throw createError(
            409,
            "The manager OTP has expired, been consumed, or been replaced. Request a new OTP.",
            "OTP_NO_LONGER_VALID",
          );
        }

        const expectedHash = hashManagerOtp(
          manager.phone,
          outletId,
          req.body.otp,
        );

        if (!safeCompareHash(challenge.codeHash, expectedHash)) {
          throw createError(
            400,
            "The manager OTP is no longer valid.",
            "INVALID_OTP",
          );
        }

        // Consume exactly once. A concurrent assignment request
        // will update zero rows and will fail.
        const consumed = await tx.otpChallenge.updateMany({
          where: {
            id: challenge.id,
            userId: manager.id,
            phone: manager.phone,
            purpose: OTP_PURPOSE,
            consumedAt: null,
            expiresAt: {
              gt: now,
            },
            attempts: {
              lt: settings.maxAttempts,
            },
          },

          data: {
            consumedAt: now,
          },
        });

        if (consumed.count !== 1) {
          throw createError(
            409,
            "The manager OTP was already used or replaced. Request a new OTP.",
            "OTP_ALREADY_USED",
          );
        }

        const previousManager = outlet.manager;

        // Record that this manager's phone was verified through the
        // manager assignment OTP flow.
        const updatedManager = await tx.user.update({
          where: {
            id: manager.id,
          },

          data: {
            phoneVerifiedAt: now,
          },

          select: outletManagerSelect,
        });

        // Setting this relation also releases the previous manager
        // from the outlet without deleting their User record.
        const updatedOutlet = await tx.outlet.update({
          where: {
            id: outletId,
          },

          data: {
            managerId: manager.id,
          },

          include: {
            city: {
              select: {
                id: true,
                name: true,
                state: true,
              },
            },

            manager: {
              select: outletManagerSelect,
            },

            _count: {
              select: {
                orders: true,
                menuItems: true,
              },
            },
          },
        });

        await writeAudit(
          tx,
          req,
          "OUTLET_MANAGER_ASSIGNED",
          "OUTLET",
          outletId,
          {
            previousManagerId: previousManager?.id || null,
            newManagerId: updatedManager.id,
          },
        );

        return {
          outlet: updatedOutlet,
          manager: updatedManager,
          previousManager,
        };
      },

      {
        isolationLevel: "Serializable",
      },
    );

    return res.status(200).json({
      success: true,
      message: result.previousManager
        ? "Outlet Manager replaced successfully."
        : "Outlet Manager assigned successfully.",

      data: {
        outlet: mapOutlet(result.outlet),

        manager: mapManager(result.manager),

        previousManager: mapManager(result.previousManager),

        assignedAt: now.toISOString(),
      },
    });
  } catch (error) {
    return next(mapPrismaError(error));
  }
}

// /* =========================================================
//    L. REMOVE MANAGER
//    DELETE /admin/outlets/:outletId/manager
// ========================================================= */

// export async function removeManager(req, res, next) {
//   try {
//     const outletId = getOutletId(req);

//     const existing = await prisma.outlet.findUnique({
//       where: {
//         id: outletId,
//       },

//       include: {
//         manager: {
//           select: outletManagerSelect,
//         },
//       },
//     });

//     if (!existing) {
//       throw createError(404, "Outlet not found.");
//     }

//     if (!existing.managerId || !existing.manager) {
//       throw createError(
//         409,
//         "This outlet does not have an assigned manager.",
//         "MANAGER_NOT_ASSIGNED",
//       );
//     }

//     const result = await prisma.$transaction(async (tx) => {
//       const updated = await tx.outlet.update({
//         where: {
//           id: outletId,
//         },

//         data: {
//           managerId: null,
//         },

//         select: {
//           id: true,
//           name: true,
//           managerId: true,
//           updatedAt: true,
//         },
//       });

//       await writeAudit(tx, req, "OUTLET_MANAGER_REMOVED", "OUTLET", outletId, {
//         previousManagerId: existing.manager.id,
//       });

//       return updated;
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Outlet Manager removed successfully.",

//       data: {
//         outletId: result.id,

//         previousManager: mapManager(existing.manager),

//         manager: null,

//         updatedAt: result.updatedAt.toISOString(),
//       },
//     });
//   } catch (error) {
//     return next(mapPrismaError(error));
//   }
// }
