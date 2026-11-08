import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  HttpError,
  assertObject,
  assertAllowedKeys,
  requiredString,
  validateId,
  validatePagination,
  paginationResponse,
} from "../utils/customerDomain.js";

/* =========================================================
   CONSTANTS
========================================================= */

const SPICE_LEVELS = ["NONE", "MILD", "MEDIUM", "HOT", "EXTRA_HOT"];
const SPICE_LABELS = {
  NONE: "None",
  MILD: "Mild",
  MEDIUM: "Medium",
  HOT: "Hot",
  EXTRA_HOT: "Extra Hot",
};
const FOOD_TYPE_ALIASES = {
  VEG: "VEG",
  VEGETARIAN: "VEG",
  NON_VEG: "NON_VEG",
  NONVEG: "NON_VEG",
  NON_VEGETARIAN: "NON_VEG",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_ALIASES = {
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

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const SKU_REGEX = /^[A-Z0-9][A-Z0-9_-]{1,47}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_PREP_MINUTES = 240;
const MAX_STOCK_QUANTITY = 1000000;
const MAX_PORTIONS = 30;
const MAX_ADDONS = 50;
const MAX_ASSIGNMENT_IDS = 100;

const TX_OPTIONS = { maxWait: 5000, timeout: 15000 };

/*
 * Request contract. The Central Admin UI currently runs on
 * mockApi.js, so these fields mirror the payloads built by
 * MenuItemModal, OutletAssignmentModal, CityPriceModal and
 * TimeBasedMenuTab. Canonical schema-style names are accepted
 * as aliases; sending both an alias and its canonical name is
 * rejected.
 */
const FOOD_ITEM_KEYS = [
  "name",
  "sku",
  "slug",
  "description",
  "category",
  "foodType",
  "veg",
  "spiceLevel",
  "spice",
  "allergens",
  "basePrice",
  "prepTimeMinutes",
  "prepTime",
  "imageUrl",
  "image",
  "isActive",
  "active",
  "portions",
  "addons",
  "addonGroupName",
  "addonsRequired",
  "defaultTimeMenu", // UI-only field; validated, never persisted centrally
];

const MAPPING_KEYS = [
  "isAvailable",
  "available",
  "stockQuantity",
  "stockQty",
  "priceOverride",
  "timeMenuLabel",
  "timeMenu",
  "unavailabilityReason",
  "availabilityReason",
  "reason",
  "expectedRestockAt",
  "restockAt",
];

const TIME_MENU_KEYS = [
  "name",
  "startTime",
  "start",
  "endTime",
  "end",
  "days",
  "outletIds",
  "itemIds",
  "isActive",
  "active",
];

const CATALOG_SORT_FIELDS = {
  name: (dir) => ({ name: dir }),
  category: (dir) => ({ category: dir }),
  basePrice: (dir) => ({ basePrice: dir }),
  createdAt: (dir) => ({ createdAt: dir }),
  updatedAt: (dir) => ({ updatedAt: dir }),
};

const CATALOG_QUERY_KEYS = [
  "page",
  "limit",
  "search",
  "category",
  "foodType",
  "spiceLevel",
  "spice",
  "isActive",
  "status",
  "outletId",
  "availability",
  "sortBy",
  "sortOrder",
];

const TIME_MENU_QUERY_KEYS = [
  "page",
  "limit",
  "search",
  "isActive",
  "status",
  "outletId",
];

/* Shared include used by every catalog response. */
const ITEM_INCLUDE = {
  portions: { orderBy: [{ price: "asc" }, { name: "asc" }] },
  addonGroups: {
    orderBy: { sortOrder: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  },
  cityPrices: {
    orderBy: { city: { name: "asc" } },
    include: { city: { select: { id: true, name: true, state: true } } },
  },
  outletMappings: {
    orderBy: { outlet: { name: "asc" } },
    include: {
      outlet: {
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          cityId: true,
          city: { select: { id: true, name: true } },
        },
      },
    },
  },
};

const TIME_MENU_INCLUDE = {
  outlets: {
    include: {
      outlet: {
        select: {
          id: true,
          name: true,
          city: { select: { name: true } },
        },
      },
    },
  },
  items: {
    include: { foodItem: { select: { id: true, name: true, isActive: true } } },
  },
};

/* =========================================================
   ERROR HANDLING
========================================================= */

function mapPrismaError(error) {
  if (error instanceof HttpError || !error?.code) return error;

  if (error.code === "P2002") {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(",")
      : String(error.meta?.target || "");
    const text = target.toLowerCase();

    if (text.includes("sku")) {
      return new HttpError(
        "A catalog item already uses this SKU.",
        409,
        "DUPLICATE_SKU",
      );
    }
    if (text.includes("slug")) {
      return new HttpError(
        "A catalog item already uses this slug.",
        409,
        "DUPLICATE_SLUG",
      );
    }
    return new HttpError(
      "A record with the supplied unique value already exists.",
      409,
      "DUPLICATE_RECORD",
    );
  }

  if (error.code === "P2003") {
    return new HttpError(
      "A referenced record does not exist or is still in use.",
      409,
      "INVALID_RELATION",
    );
  }

  if (error.code === "P2025") {
    return new HttpError("Record not found.", 404, "NOT_FOUND");
  }

  if (error.code === "P2034") {
    return new HttpError(
      "The request conflicted with another change. Please retry.",
      409,
      "TRANSACTION_CONFLICT",
    );
  }

  return error;
}

/* Keeps the project's asyncHandler and converts known Prisma errors. */
function controller(handler) {
  return asyncHandler(async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      throw mapPrismaError(error);
    }
  });
}

function respond(res, message, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

/* =========================================================
   VALIDATION HELPERS
========================================================= */

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/*
 * Resolves a canonical field and its aliases. Returns
 * { present, value }. Supplying more than one name is a conflict.
 */
function pick(body, ...names) {
  const present = names.filter((name) => hasOwn(body, name));

  if (present.length > 1) {
    throw new HttpError(
      `Send only one of: ${present.join(", ")}.`,
      400,
      "CONFLICTING_FIELDS",
    );
  }

  return present.length
    ? { present: true, value: body[present[0]], name: present[0] }
    : { present: false, value: undefined, name: null };
}

function assertQueryKeys(query, allowed) {
  const unknown = Object.keys(query).find((key) => !allowed.includes(key));

  if (unknown) {
    throw new HttpError(`Unsupported query parameter: ${unknown}.`, 400);
  }
}

function queryText(value, field, maxLength) {
  if (typeof value !== "string") {
    throw new HttpError(`${field} must be a single value.`, 400);
  }
  return requiredString(value, field, maxLength);
}

function parseBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw new HttpError(`${field} must be true or false.`, 400);
  }
  return value;
}

function parseBooleanQuery(value, field) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new HttpError(`${field} must be true or false.`, 400);
}

function parseInteger(value, field, min, max) {
  const number = typeof value === "string" ? Number(value) : value;

  if (
    typeof number !== "number" ||
    !Number.isSafeInteger(number) ||
    number < min ||
    number > max
  ) {
    throw new HttpError(
      `${field} must be a whole number between ${min} and ${max}.`,
      400,
    );
  }
  return number;
}

/*
 * Money is carried as a two-decimal string so Prisma writes it to
 * Decimal columns without any floating-point rounding.
 */
function parseMoney(value, field = "Price") {
  let text = value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new HttpError(`${field} must be a valid amount.`, 400);
    }
    text = String(value);
  }

  if (typeof text !== "string" || !/^\d{1,8}(\.\d{1,2})?$/.test(text.trim())) {
    throw new HttpError(
      `${field} must be a non-negative amount with at most two decimal places.`,
      400,
    );
  }

  const [whole, fraction = ""] = text.trim().split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

function parseNullableMoney(value, field) {
  if (value === null || value === "") return null;
  return parseMoney(value, field);
}

function num(value) {
  return value === null || value === undefined ? null : Number(value.toString());
}

function cents(value) {
  return Math.round(Number(value) * 100);
}

function fromCents(value) {
  return value / 100;
}

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function normalizeFoodType(value) {
  const key = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const mapped = FOOD_TYPE_ALIASES[key];

  if (!mapped) {
    throw new HttpError("Food type must be VEG or NON_VEG.", 400);
  }
  return mapped;
}

function normalizeSpiceLevel(value) {
  const key = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (!SPICE_LEVELS.includes(key)) {
    throw new HttpError(
      `Spice level must be one of: ${Object.values(SPICE_LABELS).join(", ")}.`,
      400,
    );
  }
  return key;
}

function parseTime(value, field) {
  if (typeof value !== "string" || !TIME_REGEX.test(value.trim())) {
    throw new HttpError(`${field} must use HH:mm format.`, 400);
  }
  return value.trim();
}

function normalizeDays(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 7) {
    throw new HttpError("Select between one and seven operating days.", 400);
  }

  const days = value.map((day) => {
    const mapped = WEEKDAY_ALIASES[String(day).trim().toUpperCase()];
    if (!mapped) throw new HttpError("Days contain an invalid weekday.", 400);
    return mapped;
  });

  if (new Set(days).size !== days.length) {
    throw new HttpError("Days cannot contain duplicates.", 400);
  }

  return WEEKDAYS.filter((day) => days.includes(day));
}

function parseIdArray(value, field, maxItems = MAX_ASSIGNMENT_IDS) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems) {
    throw new HttpError(
      `${field} must contain between 1 and ${maxItems} IDs.`,
      400,
    );
  }

  const ids = value.map((id) => validateId(id, field));

  if (new Set(ids).size !== ids.length) {
    throw new HttpError(`${field} cannot contain duplicate IDs.`, 400);
  }
  return ids;
}

function parseHttpUrl(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value !== "string" || value.trim().length > 2000) {
    throw new HttpError("Image URL must be a valid http(s) URL.", 400);
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new HttpError("Image URL must be a valid http(s) URL.", 400);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HttpError("Image URL must use http or https.", 400);
  }
  return url.toString();
}

function parseNullableDate(value, field) {
  if (value === null || value === "") return null;

  if (typeof value !== "string") {
    throw new HttpError(`${field} must be an ISO date-time or null.`, 400);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(`${field} must be a valid date-time.`, 400);
  }
  return date;
}

function normalizeSku(value) {
  if (value === null || value === undefined || value === "") return null;

  const sku = String(value).trim().toUpperCase();
  if (!SKU_REGEX.test(sku)) {
    throw new HttpError(
      "SKU must be 2-48 characters: letters, numbers, hyphen or underscore.",
      400,
    );
  }
  return sku;
}

function validateSlug(value) {
  const slug = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!slug || slug.length > 180 || !SLUG_REGEX.test(slug)) {
    throw new HttpError(
      "Slug may contain lowercase letters, numbers and single hyphens.",
      400,
    );
  }
  return slug;
}

function slugify(value) {
  return (
    String(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160) || "item"
  );
}

/* Descriptions may legitimately contain line breaks. */
function descriptionText(value) {
  if (typeof value !== "string") {
    throw new HttpError("Description must be a string.", 400);
  }

  const clean = value.trim();
  if (
    clean.length < 1 ||
    clean.length > 5000 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(clean)
  ) {
    throw new HttpError("Enter a valid description.", 400);
  }
  return clean;
}

function diffObjects(before, after) {
  const changedBefore = {};
  const changedAfter = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  return { before: changedBefore, after: changedAfter };
}

/* =========================================================
   AUDIT LOGGING
========================================================= */

function auditRow(req, action, entityType, entityId, details = {}) {
  return {
    actorId: req.user.id,
    action,
    entityType,
    entityId,
    details,
    ipAddress: req.ip || null,
    userAgent: req.get("user-agent")?.slice(0, 300) || null,
  };
}

async function writeAudit(tx, req, action, entityType, entityId, details) {
  await tx.auditLog.create({
    data: auditRow(req, action, entityType, entityId, details),
  });
}

function itemSnapshot(item) {
  return {
    sku: item.sku,
    slug: item.slug,
    name: item.name,
    category: item.category,
    foodType: item.foodType,
    spiceLevel: item.spiceLevel,
    allergens: item.allergens,
    basePrice: num(item.basePrice),
    prepTimeMinutes: item.prepTimeMinutes,
    imageUrl: item.imageUrl,
    isActive: item.isActive,
    portions: (item.portions || [])
      .filter((portion) => portion.isActive)
      .map((portion) => ({ name: portion.name, price: num(portion.price) })),
    addonGroups: (item.addonGroups || []).map((group) => ({
      name: group.name,
      isRequired: group.isRequired,
      options: group.options
        .filter((option) => option.isActive)
        .map((option) => ({ name: option.name, price: num(option.price) })),
    })),
  };
}

function mappingSnapshot(mapping) {
  return {
    isAvailable: mapping.isAvailable,
    stockQuantity: mapping.stockQuantity,
    priceOverride: num(mapping.priceOverride),
    timeMenuLabel: mapping.timeMenuLabel,
    unavailabilityReason: mapping.unavailabilityReason,
    expectedRestockAt: iso(mapping.expectedRestockAt),
  };
}

function timeMenuSnapshot(menu) {
  return {
    name: menu.name,
    startTime: menu.startTime,
    endTime: menu.endTime,
    days: menu.days,
    isActive: menu.isActive,
    outletIds: menu.outlets.map((entry) => entry.outletId).sort(),
    itemIds: menu.items.map((entry) => entry.foodItemId).sort(),
  };
}

/* =========================================================
   PRICING AND RESPONSE MAPPING
========================================================= */

/*
 * Precedence: outlet override -> city price -> central base price.
 * Nullish checks are intentional so a price of 0 is respected.
 * Food prices are already GST-inclusive; no tax is added here.
 */
function resolveEffectivePrice(basePrice, cityPrice, priceOverride) {
  return priceOverride ?? cityPrice ?? basePrice;
}

function mapPortion(portion) {
  return {
    id: portion.id,
    name: portion.name,
    price: num(portion.price),
  };
}

function mapAddonOption(option, group) {
  return {
    id: option.id,
    name: option.name,
    price: num(option.price),
    groupId: group.id,
    groupName: group.name,
  };
}

function mapOutletMapping(mapping, item, cityPriceByCityId) {
  const basePrice = num(item.basePrice);
  const cityPrice = cityPriceByCityId.get(mapping.outlet.cityId) ?? null;
  const priceOverride = num(mapping.priceOverride);
  const effectivePrice = resolveEffectivePrice(
    basePrice,
    cityPrice,
    priceOverride,
  );

  // Same rule as the customer menu / checkout: portions shift by the
  // difference between the effective base price and the central price.
  const offset = cents(effectivePrice) - cents(basePrice);

  return {
    id: mapping.id,
    itemId: mapping.foodItemId,
    outletId: mapping.outletId,
    outletName: mapping.outlet.name,
    outletCode: mapping.outlet.code,
    outletActive: mapping.outlet.isActive,
    cityId: mapping.outlet.cityId,
    city: mapping.outlet.city?.name || null,
    isAvailable: mapping.isAvailable,
    available: mapping.isAvailable,
    stockQuantity: mapping.stockQuantity,
    stockQty: mapping.stockQuantity,
    priceOverride,
    cityPrice,
    basePrice,
    effectivePrice,
    timeMenuLabel: mapping.timeMenuLabel,
    timeMenu: mapping.timeMenuLabel,
    unavailabilityReason: mapping.unavailabilityReason,
    availabilityReason: mapping.unavailabilityReason,
    expectedRestockAt: iso(mapping.expectedRestockAt),
    restockAt: iso(mapping.expectedRestockAt),
    portions: item.portions
      .filter((portion) => portion.isActive)
      .map((portion) => ({
        id: portion.id,
        name: portion.name,
        price: fromCents(cents(portion.price) + offset),
      })),
    createdAt: iso(mapping.createdAt),
    updatedAt: iso(mapping.updatedAt),
  };
}

function mapCatalogItem(item) {
  const portions = item.portions
    .filter((portion) => portion.isActive)
    .map(mapPortion);

  const addonGroups = item.addonGroups.map((group) => ({
    id: group.id,
    name: group.name,
    isRequired: group.isRequired,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    options: group.options
      .filter((option) => option.isActive)
      .map((option) => mapAddonOption(option, group)),
  }));

  const addons = addonGroups.flatMap((group) => group.options);
  const primaryGroup = item.addonGroups[0] || null;

  const cityPriceByCityId = new Map(
    item.cityPrices.map((entry) => [entry.cityId, num(entry.price)]),
  );

  const outletMappings = item.outletMappings.map((mapping) =>
    mapOutletMapping(mapping, item, cityPriceByCityId),
  );

  return {
    id: item.id,
    sku: item.sku,
    slug: item.slug,
    name: item.name,
    description: item.description,
    category: item.category,
    foodType: item.foodType,
    veg: item.foodType === "VEG",
    spiceLevel: item.spiceLevel,
    spice: SPICE_LABELS[item.spiceLevel] || item.spiceLevel,
    allergens: item.allergens,
    prepTimeMinutes: item.prepTimeMinutes,
    prepTime: item.prepTimeMinutes,
    basePrice: num(item.basePrice),
    imageUrl: item.imageUrl,
    image: item.imageUrl,
    isActive: item.isActive,
    active: item.isActive,
    portions,
    addonGroupName: primaryGroup?.name || null,
    addonsRequired: item.addonGroups.some(
      (group) => group.isRequired || group.minSelect > 0,
    ),
    addons,
    addonGroups,
    cityPrices: Object.fromEntries(
      item.cityPrices.map((entry) => [entry.city.name, num(entry.price)]),
    ),
    cityPriceList: item.cityPrices.map((entry) => ({
      cityId: entry.cityId,
      city: entry.city.name,
      state: entry.city.state,
      price: num(entry.price),
      updatedAt: iso(entry.updatedAt),
    })),
    outletMappings,
    outletIds: outletMappings.map((mapping) => mapping.outletId),
    counts: {
      portions: portions.length,
      addonGroups: addonGroups.length,
      addonOptions: addons.length,
      outletMappings: outletMappings.length,
      cityPrices: item.cityPrices.length,
    },
    createdAt: iso(item.createdAt),
    updatedAt: iso(item.updatedAt),
  };
}

function mapTimeMenu(menu) {
  return {
    id: menu.id,
    name: menu.name,
    startTime: menu.startTime,
    start: menu.startTime,
    endTime: menu.endTime,
    end: menu.endTime,
    days: menu.days,
    isActive: menu.isActive,
    active: menu.isActive,
    outletIds: menu.outlets.map((entry) => entry.outletId),
    itemIds: menu.items.map((entry) => entry.foodItemId),
    outlets: menu.outlets.map((entry) => ({
      id: entry.outlet.id,
      name: entry.outlet.name,
      city: entry.outlet.city?.name || null,
    })),
    items: menu.items.map((entry) => ({
      id: entry.foodItem.id,
      name: entry.foodItem.name,
      isActive: entry.foodItem.isActive,
    })),
    createdAt: iso(menu.createdAt),
    updatedAt: iso(menu.updatedAt),
  };
}

async function loadItem(db, itemId) {
  const item = await db.foodItem.findUnique({
    where: { id: itemId },
    include: ITEM_INCLUDE,
  });

  if (!item) {
    throw new HttpError("Catalog item not found.", 404, "ITEM_NOT_FOUND");
  }
  return item;
}

/* =========================================================
   FOOD ITEM INPUT
========================================================= */

function foodItemDataFromBody(body, { creating }) {
  const data = {};

  if (creating || hasOwn(body, "name")) {
    data.name = requiredString(body.name, "food name", 150, 2);
  }

  if (hasOwn(body, "sku")) data.sku = normalizeSku(body.sku);
  else if (creating) data.sku = null;

  if (hasOwn(body, "slug")) data.slug = validateSlug(body.slug);

  if (creating || hasOwn(body, "description")) {
    data.description = descriptionText(body.description);
  }

  if (creating || hasOwn(body, "category")) {
    data.category = requiredString(body.category, "category", 80);
  }

  const foodType = pick(body, "foodType", "veg");
  if (foodType.present) {
    data.foodType =
      foodType.name === "veg"
        ? parseBoolean(foodType.value, "veg")
          ? "VEG"
          : "NON_VEG"
        : normalizeFoodType(foodType.value);
  } else if (creating) {
    throw new HttpError("Food type is required.", 400);
  }

  const spice = pick(body, "spiceLevel", "spice");
  if (spice.present) data.spiceLevel = normalizeSpiceLevel(spice.value);
  else if (creating) data.spiceLevel = "MEDIUM";

  if (hasOwn(body, "allergens")) {
    if (!Array.isArray(body.allergens) || body.allergens.length > 30) {
      throw new HttpError("Allergens must be an array of at most 30 values.", 400);
    }

    const allergens = body.allergens.map((value) =>
      requiredString(value, "allergen", 60),
    );

    if (
      new Set(allergens.map((value) => value.toLowerCase())).size !==
      allergens.length
    ) {
      throw new HttpError("Allergens cannot contain duplicates.", 400);
    }
    data.allergens = allergens;
  } else if (creating) {
    data.allergens = [];
  }

  if (creating || hasOwn(body, "basePrice")) {
    data.basePrice = parseMoney(body.basePrice, "Base price");
  }

  const prep = pick(body, "prepTimeMinutes", "prepTime");
  if (prep.present) {
    data.prepTimeMinutes = parseInteger(
      prep.value,
      "Preparation time",
      1,
      MAX_PREP_MINUTES,
    );
  } else if (creating) {
    throw new HttpError("Preparation time is required.", 400);
  }

  const image = pick(body, "imageUrl", "image");
  if (image.present) data.imageUrl = parseHttpUrl(image.value);
  else if (creating) data.imageUrl = null;

  const active = pick(body, "isActive", "active");
  if (active.present) data.isActive = parseBoolean(active.value, "isActive");
  else if (creating) data.isActive = true;

  if (hasOwn(body, "defaultTimeMenu")) {
    requiredString(body.defaultTimeMenu, "default time menu", 80);
  }

  return data;
}

function normalizePortions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PORTIONS) {
    throw new HttpError(
      `Portions must contain between 1 and ${MAX_PORTIONS} entries.`,
      400,
    );
  }

  const portions = value.map((entry) => {
    assertObject(entry, "Each portion must be an object.");
    assertAllowedKeys(entry, ["name", "price"]);

    return {
      name: requiredString(entry.name, "portion name", 60),
      price: parseMoney(entry.price, "Portion price"),
    };
  });

  if (
    new Set(portions.map((portion) => portion.name.toLowerCase())).size !==
    portions.length
  ) {
    throw new HttpError("Portion names must be unique.", 400);
  }
  return portions;
}

function normalizeAddonOptions(value) {
  if (!Array.isArray(value) || value.length > MAX_ADDONS) {
    throw new HttpError(
      `Add-ons must be an array of at most ${MAX_ADDONS} entries.`,
      400,
    );
  }

  const options = value.map((entry) => {
    assertObject(entry, "Each add-on must be an object.");
    assertAllowedKeys(entry, ["name", "price"]);

    return {
      name: requiredString(entry.name, "add-on name", 100),
      price: parseMoney(entry.price, "Add-on price"),
    };
  });

  if (
    new Set(options.map((option) => option.name.toLowerCase())).size !==
    options.length
  ) {
    throw new HttpError("Add-on names must be unique.", 400);
  }
  return options;
}

/*
 * The UI manages a single add-on group per item (addonGroupName,
 * addonsRequired, addons). Nested structures beyond that are not
 * part of the current contract and are rejected as unknown fields.
 */
function addonSpecFromBody(body) {
  return {
    options: hasOwn(body, "addons") ? normalizeAddonOptions(body.addons) : undefined,
    groupName: hasOwn(body, "addonGroupName")
      ? requiredString(body.addonGroupName, "add-on group name", 80)
      : undefined,
    isRequired: hasOwn(body, "addonsRequired")
      ? parseBoolean(body.addonsRequired, "addonsRequired")
      : undefined,
  };
}

function hasAddonSpec(spec) {
  return (
    spec.options !== undefined ||
    spec.groupName !== undefined ||
    spec.isRequired !== undefined
  );
}

function groupCreateData(spec) {
  const options = spec.options || [];
  const isRequired = spec.isRequired === true;

  if (isRequired && options.length === 0) {
    throw new HttpError(
      "A required add-on group needs at least one add-on.",
      400,
    );
  }
  if (options.length === 0) return null;

  return {
    name: spec.groupName ?? "Add-ons",
    isRequired,
    minSelect: isRequired ? 1 : 0,
    maxSelect: Math.max(1, options.length),
    sortOrder: 0,
    options: {
      create: options.map((option, index) => ({
        name: option.name,
        price: option.price,
        sortOrder: index,
      })),
    },
  };
}

/*
 * Portions and add-on options are matched by name. Anything that is
 * omitted from a replacement list is deactivated, never deleted, so
 * carts and historical orders keep their references.
 */
async function syncPortions(tx, foodItemId, portions) {
  const existing = await tx.foodPortion.findMany({ where: { foodItemId } });
  const byName = new Map(existing.map((row) => [row.name.toLowerCase(), row]));
  const keep = new Set();

  for (const portion of portions) {
    const match = byName.get(portion.name.toLowerCase());

    if (match) {
      keep.add(match.id);
      await tx.foodPortion.update({
        where: { id: match.id },
        data: { name: portion.name, price: portion.price, isActive: true },
      });
    } else {
      await tx.foodPortion.create({
        data: { foodItemId, name: portion.name, price: portion.price },
      });
    }
  }

  const omitted = existing
    .filter((row) => row.isActive && !keep.has(row.id))
    .map((row) => row.id);

  if (omitted.length) {
    await tx.foodPortion.updateMany({
      where: { id: { in: omitted } },
      data: { isActive: false },
    });
  }
}

async function syncAddons(tx, foodItemId, spec) {
  const group = await tx.addonGroup.findFirst({
    where: { foodItemId },
    orderBy: { sortOrder: "asc" },
    include: { options: true },
  });

  if (!group) {
    const data = groupCreateData(spec);
    if (data) await tx.addonGroup.create({ data: { ...data, foodItemId } });
    return;
  }

  const activeCount =
    spec.options !== undefined
      ? spec.options.length
      : group.options.filter((option) => option.isActive).length;
  const isRequired = spec.isRequired ?? group.isRequired;

  if (isRequired && activeCount === 0) {
    throw new HttpError(
      "A required add-on group needs at least one add-on.",
      400,
    );
  }

  await tx.addonGroup.update({
    where: { id: group.id },
    data: {
      name: spec.groupName ?? group.name,
      isRequired,
      minSelect: isRequired ? 1 : 0,
      maxSelect: Math.max(1, activeCount),
    },
  });

  if (spec.options === undefined) return;

  const byName = new Map(
    group.options.map((row) => [row.name.toLowerCase(), row]),
  );
  const keep = new Set();

  for (const [index, option] of spec.options.entries()) {
    const match = byName.get(option.name.toLowerCase());

    if (match) {
      keep.add(match.id);
      await tx.addonOption.update({
        where: { id: match.id },
        data: {
          name: option.name,
          price: option.price,
          isActive: true,
          sortOrder: index,
        },
      });
    } else {
      await tx.addonOption.create({
        data: {
          addonGroupId: group.id,
          name: option.name,
          price: option.price,
          sortOrder: index,
        },
      });
    }
  }

  const omitted = group.options
    .filter((row) => row.isActive && !keep.has(row.id))
    .map((row) => row.id);

  if (omitted.length) {
    await tx.addonOption.updateMany({
      where: { id: { in: omitted } },
      data: { isActive: false },
    });
  }
}

async function assertUniqueSkuAndSlug(tx, { sku, slug }, excludeId = null) {
  const exclude = excludeId ? { id: { not: excludeId } } : {};

  if (sku) {
    const clash = await tx.foodItem.findFirst({
      where: { sku, ...exclude },
      select: { id: true },
    });
    if (clash) {
      throw new HttpError(
        "A catalog item already uses this SKU.",
        409,
        "DUPLICATE_SKU",
      );
    }
  }

  if (slug) {
    const clash = await tx.foodItem.findFirst({
      where: { slug, ...exclude },
      select: { id: true },
    });
    if (clash) {
      throw new HttpError(
        "A catalog item already uses this slug.",
        409,
        "DUPLICATE_SLUG",
      );
    }
  }
}

async function generateUniqueSlug(tx, name) {
  const base = slugify(name);
  const rows = await tx.foodItem.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(rows.map((row) => row.slug));

  if (!taken.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new HttpError(
    "Could not generate a unique slug. Provide one explicitly.",
    409,
    "DUPLICATE_SLUG",
  );
}

/* =========================================================
   1. LIST CATALOG
   GET /admin/menu/catalog
========================================================= */

export const listCatalog = controller(async (req, res) => {
  const query = req.query || {};
  assertQueryKeys(query, CATALOG_QUERY_KEYS);

  const { page, limit, skip } = validatePagination(query);
  const where = {};
  const and = [];

  if (query.search !== undefined) {
    const search = queryText(query.search, "Search", 100);
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (query.category !== undefined && query.category !== "all") {
    where.category = {
      equals: queryText(query.category, "Category", 80),
      mode: "insensitive",
    };
  }

  if (query.foodType !== undefined && query.foodType !== "all") {
    where.foodType = normalizeFoodType(queryText(query.foodType, "foodType", 20));
  }

  const spice = pick(query, "spiceLevel", "spice");
  if (spice.present && spice.value !== "all") {
    where.spiceLevel = normalizeSpiceLevel(spice.value);
  }

  const active = pick(query, "isActive", "status");
  if (active.present) {
    if (active.name === "status") {
      if (!["all", "active", "inactive"].includes(active.value)) {
        throw new HttpError("status must be all, active or inactive.", 400);
      }
      if (active.value !== "all") where.isActive = active.value === "active";
    } else {
      where.isActive = parseBooleanQuery(active.value, "isActive");
    }
  }

  const availability = query.availability ?? "all";
  if (!["all", "available", "unavailable", "unmapped"].includes(availability)) {
    throw new HttpError(
      "availability must be all, available, unavailable or unmapped.",
      400,
    );
  }

  if (availability !== "all" && query.outletId === undefined) {
    throw new HttpError("availability filtering requires outletId.", 400);
  }

  if (query.outletId !== undefined) {
    const outletId = validateId(query.outletId, "outlet ID");

    if (availability === "unmapped") {
      where.outletMappings = { none: { outletId } };
    } else if (availability === "available") {
      where.outletMappings = {
        some: { outletId, isAvailable: true, stockQuantity: { gt: 0 } },
      };
    } else if (availability === "unavailable") {
      and.push({
        outletMappings: {
          some: {
            outletId,
            OR: [{ isAvailable: false }, { stockQuantity: { lte: 0 } }],
          },
        },
      });
    } else {
      where.outletMappings = { some: { outletId } };
    }
  }

  if (and.length) where.AND = and;

  const sortBy = query.sortBy ?? "name";
  const sortOrder = query.sortOrder ?? "asc";

  if (!hasOwn(CATALOG_SORT_FIELDS, sortBy)) {
    throw new HttpError(
      `sortBy must be one of: ${Object.keys(CATALOG_SORT_FIELDS).join(", ")}.`,
      400,
    );
  }
  if (!["asc", "desc"].includes(sortOrder)) {
    throw new HttpError("sortOrder must be asc or desc.", 400);
  }

  const [rows, total] = await Promise.all([
    prisma.foodItem.findMany({
      where,
      include: ITEM_INCLUDE,
      orderBy: [CATALOG_SORT_FIELDS[sortBy](sortOrder), { id: "asc" }],
      skip,
      take: limit,
    }),
    prisma.foodItem.count({ where }),
  ]);

  return respond(res, "Catalog retrieved successfully.", {
    items: rows.map(mapCatalogItem),
    pagination: paginationResponse(page, limit, total),
  });
});

/* =========================================================
   2. GET CATALOG ITEM
   GET /admin/menu/catalog/:itemId
========================================================= */

export const getCatalogItem = controller(async (req, res) => {
  const itemId = validateId(req.params.itemId, "item ID");
  const item = await loadItem(prisma, itemId);

  return respond(res, "Catalog item retrieved successfully.", {
    item: mapCatalogItem(item),
  });
});

/* =========================================================
   3. CREATE CATALOG ITEM
   POST /admin/menu/catalog
========================================================= */

export const createCatalogItem = controller(async (req, res) => {
  const body = assertObject(req.body);
  assertAllowedKeys(body, FOOD_ITEM_KEYS);

  const data = foodItemDataFromBody(body, { creating: true });
  const addonSpec = addonSpecFromBody(body);

  // Default portion mirrors the base price when none is supplied.
  const portions = hasOwn(body, "portions")
    ? normalizePortions(body.portions)
    : [{ name: "Regular", price: data.basePrice }];

  const groupData = groupCreateData(addonSpec);

  const created = await prisma.$transaction(async (tx) => {
    if (!data.slug) data.slug = await generateUniqueSlug(tx, data.name);
    await assertUniqueSkuAndSlug(tx, data);

    const item = await tx.foodItem.create({
      data: {
        ...data,
        portions: { create: portions },
        ...(groupData ? { addonGroups: { create: [groupData] } } : {}),
      },
      include: ITEM_INCLUDE,
    });

    await writeAudit(tx, req, "CATALOG_ITEM_CREATED", "FOOD_ITEM", item.id, {
      after: itemSnapshot(item),
    });

    return item;
  }, TX_OPTIONS);

  return respond(
    res,
    "Catalog item created successfully.",
    { item: mapCatalogItem(created) },
    201,
  );
});

/* =========================================================
   4. UPDATE CATALOG ITEM
   PATCH /admin/menu/catalog/:itemId
========================================================= */

export const updateCatalogItem = controller(async (req, res) => {
  const itemId = validateId(req.params.itemId, "item ID");
  const body = assertObject(req.body);
  assertAllowedKeys(body, FOOD_ITEM_KEYS);

  const data = foodItemDataFromBody(body, { creating: false });
  const portions = hasOwn(body, "portions")
    ? normalizePortions(body.portions)
    : undefined;
  const addonSpec = addonSpecFromBody(body);

  if (
    Object.keys(data).length === 0 &&
    portions === undefined &&
    !hasAddonSpec(addonSpec) &&
    !hasOwn(body, "defaultTimeMenu")
  ) {
    throw new HttpError("No changes were supplied.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const before = await loadItem(tx, itemId);

    await assertUniqueSkuAndSlug(
      tx,
      {
        sku: data.sku && data.sku !== before.sku ? data.sku : null,
        slug: data.slug && data.slug !== before.slug ? data.slug : null,
      },
      itemId,
    );

    // Always issued so updatedAt moves even for nested-only changes.
    await tx.foodItem.update({ where: { id: itemId }, data });

    if (portions !== undefined) await syncPortions(tx, itemId, portions);
    if (hasAddonSpec(addonSpec)) await syncAddons(tx, itemId, addonSpec);

    const after = await loadItem(tx, itemId);
    const diff = diffObjects(itemSnapshot(before), itemSnapshot(after));

    if (Object.keys(diff.after).length) {
      await writeAudit(tx, req, "CATALOG_ITEM_UPDATED", "FOOD_ITEM", itemId, diff);
    }

    return after;
  }, TX_OPTIONS);

  return respond(res, "Catalog item updated successfully.", {
    item: mapCatalogItem(updated),
  });
});

/* =========================================================
   5. ARCHIVE CATALOG ITEM
   DELETE /admin/menu/catalog/:itemId
   Soft archive only: FoodItem.isActive = false.
========================================================= */

export const archiveCatalogItem = controller(async (req, res) => {
  const itemId = validateId(req.params.itemId, "item ID");

  const result = await prisma.$transaction(async (tx) => {
    const existing = await loadItem(tx, itemId);

    if (!existing.isActive) {
      return { item: existing, alreadyArchived: true };
    }

    await tx.foodItem.update({
      where: { id: itemId },
      data: { isActive: false },
    });

    await writeAudit(tx, req, "CATALOG_ITEM_ARCHIVED", "FOOD_ITEM", itemId, {
      before: { isActive: true },
      after: { isActive: false },
      name: existing.name,
    });

    return { item: await loadItem(tx, itemId), alreadyArchived: false };
  }, TX_OPTIONS);

  return respond(
    res,
    result.alreadyArchived
      ? "Catalog item was already archived."
      : "Catalog item archived successfully.",
    { item: mapCatalogItem(result.item), alreadyArchived: result.alreadyArchived },
  );
});

/* =========================================================
   6. UPDATE CITY PRICE
   PATCH /admin/menu/catalog/:itemId/city-prices/:city
   :city is a City name (as used by the UI) or a City ID.
========================================================= */

export const updateCityPrice = controller(async (req, res) => {
  const itemId = validateId(req.params.itemId, "item ID");
  const cityRef = requiredString(req.params.city, "city", 100);

  const body = assertObject(req.body);
  assertAllowedKeys(body, ["price"]);

  if (!hasOwn(body, "price")) {
    throw new HttpError("Price is required.", 400);
  }
  const price = parseMoney(body.price, "City price");

  const result = await prisma.$transaction(async (tx) => {
    const food = await tx.foodItem.findUnique({
      where: { id: itemId },
      select: { id: true, name: true },
    });
    if (!food) {
      throw new HttpError("Catalog item not found.", 404, "ITEM_NOT_FOUND");
    }

    const city = await tx.city.findFirst({
      where: {
        OR: [{ id: cityRef }, { name: { equals: cityRef, mode: "insensitive" } }],
      },
    });
    if (!city) throw new HttpError("City not found.", 404, "CITY_NOT_FOUND");
    if (!city.isActive) {
      throw new HttpError("This city is inactive.", 409, "CITY_INACTIVE");
    }

    const key = { cityId_foodItemId: { cityId: city.id, foodItemId: itemId } };
    const previous = await tx.cityMenuPrice.findUnique({ where: key });

    const saved = await tx.cityMenuPrice.upsert({
      where: key,
      create: { cityId: city.id, foodItemId: itemId, price },
      update: { price },
    });

    await writeAudit(tx, req, "CITY_PRICE_UPDATED", "CITY_MENU_PRICE", saved.id, {
      foodItemId: itemId,
      foodName: food.name,
      cityId: city.id,
      city: city.name,
      previousPrice: num(previous?.price),
      newPrice: num(saved.price),
    });

    return {
      city,
      saved,
      previousPrice: num(previous?.price),
      item: await loadItem(tx, itemId),
    };
  }, TX_OPTIONS);

  return respond(res, "City price saved successfully.", {
    cityPrice: {
      cityId: result.city.id,
      city: result.city.name,
      foodItemId: itemId,
      price: num(result.saved.price),
      previousPrice: result.previousPrice,
      updatedAt: iso(result.saved.updatedAt),
    },
    item: mapCatalogItem(result.item),
  });
});

/* =========================================================
   OUTLET MAPPING INPUT
========================================================= */

/*
 * Only fields supplied by the client are returned, so omitted
 * values are preserved and explicit null clears nullable fields.
 */
function mappingFieldsFromBody(body) {
  const fields = {};

  const available = pick(body, "isAvailable", "available");
  if (available.present) {
    fields.isAvailable = parseBoolean(available.value, "available");
  }

  const stock = pick(body, "stockQuantity", "stockQty");
  if (stock.present) {
    fields.stockQuantity = parseInteger(
      stock.value,
      "Stock quantity",
      0,
      MAX_STOCK_QUANTITY,
    );
  }

  if (hasOwn(body, "priceOverride")) {
    fields.priceOverride = parseNullableMoney(
      body.priceOverride,
      "Price override",
    );
  }

  const label = pick(body, "timeMenuLabel", "timeMenu");
  if (label.present) {
    fields.timeMenuLabel = requiredString(label.value, "time menu", 80);
  }

  const reason = pick(body, "unavailabilityReason", "availabilityReason", "reason");
  if (reason.present) {
    fields.unavailabilityReason =
      reason.value === null || reason.value === ""
        ? null
        : requiredString(reason.value, "unavailability reason", 120);
  }

  const restock = pick(body, "expectedRestockAt", "restockAt");
  if (restock.present) {
    fields.expectedRestockAt = parseNullableDate(
      restock.value,
      "Expected restock time",
    );
  }

  // Marking an item available clears stale unavailability details
  // unless the caller explicitly supplied them.
  if (fields.isAvailable === true) {
    if (!reason.present) fields.unavailabilityReason = null;
    if (!restock.present) fields.expectedRestockAt = null;
  }

  return fields;
}

/* =========================================================
   7. ASSIGN ITEM TO OUTLETS
   POST /admin/menu/catalog/:itemId/outlets
   Existing mappings are updated with the supplied fields and
   reported separately from newly created mappings.
========================================================= */

export const assignItemToOutlet = controller(async (req, res) => {
  const itemId = validateId(req.params.itemId, "item ID");
  const body = assertObject(req.body);
  assertAllowedKeys(body, ["outletIds", ...MAPPING_KEYS]);

  const outletIds = parseIdArray(body.outletIds, "outletIds");
  const fields = mappingFieldsFromBody(body);

  const result = await prisma.$transaction(async (tx) => {
    const food = await tx.foodItem.findUnique({
      where: { id: itemId },
      select: { id: true, name: true, isActive: true },
    });
    if (!food) {
      throw new HttpError("Catalog item not found.", 404, "ITEM_NOT_FOUND");
    }
    if (!food.isActive) {
      throw new HttpError(
        "Archived catalog items cannot be assigned to outlets.",
        409,
        "ITEM_INACTIVE",
      );
    }

    await assertOutletsUsable(tx, outletIds);

    const existing = await tx.outletMenuItem.findMany({
      where: { foodItemId: itemId, outletId: { in: outletIds } },
    });
    const existingByOutlet = new Map(
      existing.map((mapping) => [mapping.outletId, mapping]),
    );

    const created = [];
    const updated = [];
    const audits = [];

    for (const outletId of outletIds) {
      const before = existingByOutlet.get(outletId);

      const saved = await tx.outletMenuItem.upsert({
        where: { outletId_foodItemId: { outletId, foodItemId: itemId } },
        create: { outletId, foodItemId: itemId, ...fields },
        update: fields,
      });

      if (before) {
        updated.push(outletId);
        audits.push(
          auditRow(req, "OUTLET_MAPPING_UPDATED", "OUTLET_MENU_ITEM", saved.id, {
            foodItemId: itemId,
            outletId,
            ...diffObjects(mappingSnapshot(before), mappingSnapshot(saved)),
          }),
        );
      } else {
        created.push(outletId);
        audits.push(
          auditRow(req, "OUTLET_MAPPING_CREATED", "OUTLET_MENU_ITEM", saved.id, {
            foodItemId: itemId,
            outletId,
            after: mappingSnapshot(saved),
          }),
        );
      }
    }

    await tx.auditLog.createMany({ data: audits });

    return { created, updated, item: await loadItem(tx, itemId) };
  }, TX_OPTIONS);

  const mapped = mapCatalogItem(result.item);
  const touched = new Set(outletIds);

  return respond(
    res,
    result.created.length
      ? "Catalog item assigned to outlets successfully."
      : "Existing outlet mappings updated successfully.",
    {
      created: result.created,
      updated: result.updated,
      mappings: mapped.outletMappings.filter((mapping) =>
        touched.has(mapping.outletId),
      ),
      item: mapped,
    },
    result.created.length ? 201 : 200,
  );
});

async function assertOutletsUsable(db, outletIds) {
  const outlets = await db.outlet.findMany({
    where: { id: { in: outletIds } },
    select: { id: true, name: true, isActive: true },
  });

  const found = new Map(outlets.map((outlet) => [outlet.id, outlet]));
  const missing = outletIds.find((id) => !found.has(id));

  if (missing) {
    throw new HttpError(`Outlet not found: ${missing}.`, 404, "OUTLET_NOT_FOUND");
  }

  const inactive = outlets.find((outlet) => !outlet.isActive);
  if (inactive) {
    throw new HttpError(
      `Outlet is inactive: ${inactive.name}.`,
      409,
      "OUTLET_INACTIVE",
    );
  }
}

/* =========================================================
   8. UPDATE OUTLET MAPPING
   PATCH /admin/menu/catalog/:itemId/outlets/:outletId
========================================================= */

export const updateOutletMapping = controller(async (req, res) => {
  const itemId = validateId(req.params.itemId, "item ID");
  const outletId = validateId(req.params.outletId, "outlet ID");

  const body = assertObject(req.body);
  assertAllowedKeys(body, MAPPING_KEYS);

  const fields = mappingFieldsFromBody(body);
  if (Object.keys(fields).length === 0) {
    throw new HttpError("No changes were supplied.", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const key = { outletId_foodItemId: { outletId, foodItemId: itemId } };
    const before = await tx.outletMenuItem.findUnique({ where: key });

    if (!before) {
      throw new HttpError(
        "This catalog item is not mapped to the selected outlet.",
        404,
        "MAPPING_NOT_FOUND",
      );
    }

    const saved = await tx.outletMenuItem.update({ where: key, data: fields });

    const diff = diffObjects(mappingSnapshot(before), mappingSnapshot(saved));
    if (Object.keys(diff.after).length) {
      await writeAudit(tx, req, "OUTLET_MAPPING_UPDATED", "OUTLET_MENU_ITEM", saved.id, {
        foodItemId: itemId,
        outletId,
        ...diff,
      });
    }

    return loadItem(tx, itemId);
  }, TX_OPTIONS);

  const mapped = mapCatalogItem(result);

  return respond(res, "Outlet mapping updated successfully.", {
    mapping: mapped.outletMappings.find((entry) => entry.outletId === outletId),
    item: mapped,
  });
});

/* =========================================================
   9. REMOVE OUTLET MAPPING
   DELETE /admin/menu/catalog/:itemId/outlets/:outletId
========================================================= */

export const removeOutletMapping = controller(async (req, res) => {
  const itemId = validateId(req.params.itemId, "item ID");
  const outletId = validateId(req.params.outletId, "outlet ID");

  await prisma.$transaction(async (tx) => {
    const mapping = await tx.outletMenuItem.findUnique({
      where: { outletId_foodItemId: { outletId, foodItemId: itemId } },
    });

    if (!mapping) {
      throw new HttpError(
        "This catalog item is not mapped to the selected outlet.",
        404,
        "MAPPING_NOT_FOUND",
      );
    }

    // InventoryMovement.outletMenuItem is onDelete: Restrict. Check first
    // so the admin gets an actionable message instead of a raw FK failure.
    const movements = await tx.inventoryMovement.count({
      where: { outletMenuItemId: mapping.id },
    });
    if (movements > 0) {
      throw new HttpError(
        "This mapping has inventory history and cannot be removed. Mark it unavailable instead.",
        409,
        "MAPPING_HAS_INVENTORY_HISTORY",
      );
    }

    // An active time menu that schedules this item at this outlet would
    // otherwise be left pointing at an unmapped item.
    const scheduled = await tx.timeMenu.findFirst({
      where: {
        isActive: true,
        outlets: { some: { outletId } },
        items: { some: { foodItemId: itemId } },
      },
      select: { name: true },
    });
    if (scheduled) {
      throw new HttpError(
        `Remove this item from the active time menu "${scheduled.name}" first.`,
        409,
        "MAPPING_IN_ACTIVE_TIME_MENU",
      );
    }

    // OrderItem.outletMenuItemId is SetNull; order rows and their name /
    // price snapshots are untouched.
    await tx.outletMenuItem.delete({ where: { id: mapping.id } });

    await writeAudit(tx, req, "OUTLET_MAPPING_REMOVED", "OUTLET_MENU_ITEM", mapping.id, {
      foodItemId: itemId,
      outletId,
      before: mappingSnapshot(mapping),
    });
  }, TX_OPTIONS);

  return respond(res, "Outlet mapping removed successfully.", {
    itemId,
    outletId,
  });
});

/* =========================================================
   TIME MENU INPUT AND VALIDATION
========================================================= */

function parseTimeMenuBody(body, { creating }) {
  const data = {};

  if (creating || hasOwn(body, "name")) {
    data.name = requiredString(body.name, "time menu name", 80, 2);
  }

  const start = pick(body, "startTime", "start");
  if (start.present) data.startTime = parseTime(start.value, "Start time");
  else if (creating) throw new HttpError("Start time is required.", 400);

  const end = pick(body, "endTime", "end");
  if (end.present) data.endTime = parseTime(end.value, "End time");
  else if (creating) throw new HttpError("End time is required.", 400);

  if (creating || hasOwn(body, "days")) data.days = normalizeDays(body.days);

  const active = pick(body, "isActive", "active");
  if (active.present) data.isActive = parseBoolean(active.value, "isActive");
  else if (creating) data.isActive = true;

  const outletIds =
    creating || hasOwn(body, "outletIds")
      ? parseIdArray(body.outletIds, "outletIds")
      : undefined;
  const itemIds =
    creating || hasOwn(body, "itemIds")
      ? parseIdArray(body.itemIds, "itemIds")
      : undefined;

  return { data, outletIds, itemIds };
}

function assertTimeWindow(startTime, endTime) {
  // Matches the UI: overnight windows are not supported.
  if (startTime >= endTime) {
    throw new HttpError(
      "End time must be later than start time. Overnight windows are not supported.",
      400,
    );
  }
}

async function assertFoodItemsUsable(db, itemIds) {
  const items = await db.foodItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, name: true, isActive: true },
  });

  const found = new Map(items.map((item) => [item.id, item]));
  const missing = itemIds.find((id) => !found.has(id));

  if (missing) {
    throw new HttpError(`Catalog item not found: ${missing}.`, 404, "ITEM_NOT_FOUND");
  }

  const inactive = items.find((item) => !item.isActive);
  if (inactive) {
    throw new HttpError(
      `Catalog item is archived: ${inactive.name}.`,
      409,
      "ITEM_INACTIVE",
    );
  }
}

/* An active schedule may only contain items mapped to every selected outlet. */
async function assertItemsMapped(db, outletIds, itemIds) {
  const mappings = await db.outletMenuItem.findMany({
    where: { outletId: { in: outletIds }, foodItemId: { in: itemIds } },
    select: { outletId: true, foodItemId: true },
  });
  const have = new Set(
    mappings.map((mapping) => `${mapping.outletId}:${mapping.foodItemId}`),
  );

  for (const outletId of outletIds) {
    for (const itemId of itemIds) {
      if (!have.has(`${outletId}:${itemId}`)) {
        throw new HttpError(
          "Map every scheduled item to each selected outlet first.",
          409,
          "ITEM_NOT_MAPPED_TO_OUTLET",
        );
      }
    }
  }
}

/*
 * Overlap scope (mirrors the UI): two ACTIVE time menus conflict when
 * they share at least one outlet and one weekday and their same-day
 * windows overlap. Inactive menus never conflict.
 */
async function assertNoOverlap(db, { id, startTime, endTime, days, outletIds }) {
  const conflict = await db.timeMenu.findFirst({
    where: {
      isActive: true,
      ...(id ? { id: { not: id } } : {}),
      days: { hasSome: days },
      outlets: { some: { outletId: { in: outletIds } } },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { name: true },
  });

  if (conflict) {
    throw new HttpError(
      `Schedule overlaps with "${conflict.name}" for a selected outlet and day.`,
      409,
      "TIME_MENU_OVERLAP",
    );
  }
}

async function loadTimeMenu(db, timeMenuId) {
  const menu = await db.timeMenu.findUnique({
    where: { id: timeMenuId },
    include: TIME_MENU_INCLUDE,
  });

  if (!menu) {
    throw new HttpError("Time menu not found.", 404, "TIME_MENU_NOT_FOUND");
  }
  return menu;
}

/* =========================================================
   10. LIST TIME MENUS
   GET /admin/menu/time-menus
========================================================= */

export const listTimeMenus = controller(async (req, res) => {
  const query = req.query || {};
  assertQueryKeys(query, TIME_MENU_QUERY_KEYS);

  // Time menus are few; default to returning up to 100 in one page.
  const { page, limit, skip } = validatePagination({ limit: 100, ...query });
  const where = {};

  if (query.search !== undefined) {
    where.name = {
      contains: queryText(query.search, "Search", 80),
      mode: "insensitive",
    };
  }

  const active = pick(query, "isActive", "status");
  if (active.present) {
    if (active.name === "status") {
      if (!["all", "active", "inactive"].includes(active.value)) {
        throw new HttpError("status must be all, active or inactive.", 400);
      }
      if (active.value !== "all") where.isActive = active.value === "active";
    } else {
      where.isActive = parseBooleanQuery(active.value, "isActive");
    }
  }

  if (query.outletId !== undefined) {
    where.outlets = {
      some: { outletId: validateId(query.outletId, "outlet ID") },
    };
  }

  const [rows, total] = await Promise.all([
    prisma.timeMenu.findMany({
      where,
      include: TIME_MENU_INCLUDE,
      orderBy: [{ startTime: "asc" }, { name: "asc" }, { id: "asc" }],
      skip,
      take: limit,
    }),
    prisma.timeMenu.count({ where }),
  ]);

  return respond(res, "Time menus retrieved successfully.", {
    timeMenus: rows.map(mapTimeMenu),
    pagination: paginationResponse(page, limit, total),
  });
});

/* =========================================================
   11. CREATE TIME MENU
   POST /admin/menu/time-menus
========================================================= */

export const createTimeMenu = controller(async (req, res) => {
  const body = assertObject(req.body);
  assertAllowedKeys(body, TIME_MENU_KEYS);

  const { data, outletIds, itemIds } = parseTimeMenuBody(body, { creating: true });
  assertTimeWindow(data.startTime, data.endTime);

  const created = await prisma.$transaction(async (tx) => {
    await assertOutletsUsable(tx, outletIds);
    await assertFoodItemsUsable(tx, itemIds);

    if (data.isActive) {
      await assertItemsMapped(tx, outletIds, itemIds);
      await assertNoOverlap(tx, { ...data, outletIds });
    }

    const menu = await tx.timeMenu.create({
      data: {
        ...data,
        outlets: { create: outletIds.map((outletId) => ({ outletId })) },
        items: { create: itemIds.map((foodItemId) => ({ foodItemId })) },
      },
      include: TIME_MENU_INCLUDE,
    });

    await writeAudit(tx, req, "TIME_MENU_CREATED", "TIME_MENU", menu.id, {
      after: timeMenuSnapshot(menu),
    });

    return menu;
  }, TX_OPTIONS);

  return respond(
    res,
    "Time menu created successfully.",
    { timeMenu: mapTimeMenu(created) },
    201,
  );
});

/* =========================================================
   12. UPDATE TIME MENU
   PATCH /admin/menu/time-menus/:timeMenuId
   Omitted fields and assignment arrays are preserved. A supplied
   outletIds / itemIds array fully replaces that assignment set.
========================================================= */

export const updateTimeMenu = controller(async (req, res) => {
  const timeMenuId = validateId(req.params.timeMenuId, "time menu ID");
  const body = assertObject(req.body);
  assertAllowedKeys(body, TIME_MENU_KEYS);

  const { data, outletIds, itemIds } = parseTimeMenuBody(body, { creating: false });

  if (
    Object.keys(data).length === 0 &&
    outletIds === undefined &&
    itemIds === undefined
  ) {
    throw new HttpError("No changes were supplied.", 400);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const before = await loadTimeMenu(tx, timeMenuId);

    const finalState = {
      id: timeMenuId,
      startTime: data.startTime ?? before.startTime,
      endTime: data.endTime ?? before.endTime,
      days: data.days ?? before.days,
      isActive: data.isActive ?? before.isActive,
      outletIds: outletIds ?? before.outlets.map((entry) => entry.outletId),
      itemIds: itemIds ?? before.items.map((entry) => entry.foodItemId),
    };

    if (data.startTime !== undefined || data.endTime !== undefined) {
      assertTimeWindow(finalState.startTime, finalState.endTime);
    }

    // Validate everything before any relation is modified.
    if (outletIds !== undefined) await assertOutletsUsable(tx, outletIds);
    if (itemIds !== undefined) await assertFoodItemsUsable(tx, itemIds);

    if (finalState.isActive) {
      if (
        finalState.outletIds.length === 0 ||
        finalState.itemIds.length === 0
      ) {
        throw new HttpError(
          "An active time menu needs at least one outlet and one item.",
          400,
        );
      }
      await assertItemsMapped(tx, finalState.outletIds, finalState.itemIds);
      await assertNoOverlap(tx, finalState);
    }

    await tx.timeMenu.update({ where: { id: timeMenuId }, data });

    if (outletIds !== undefined) {
      await tx.timeMenuOutlet.deleteMany({ where: { timeMenuId } });
      await tx.timeMenuOutlet.createMany({
        data: outletIds.map((outletId) => ({ timeMenuId, outletId })),
      });
    }

    if (itemIds !== undefined) {
      await tx.timeMenuItem.deleteMany({ where: { timeMenuId } });
      await tx.timeMenuItem.createMany({
        data: itemIds.map((foodItemId) => ({ timeMenuId, foodItemId })),
      });
    }

    const after = await loadTimeMenu(tx, timeMenuId);
    const diff = diffObjects(timeMenuSnapshot(before), timeMenuSnapshot(after));

    if (Object.keys(diff.after).length) {
      await writeAudit(tx, req, "TIME_MENU_UPDATED", "TIME_MENU", timeMenuId, diff);
    }

    return after;
  }, TX_OPTIONS);

  return respond(res, "Time menu updated successfully.", {
    timeMenu: mapTimeMenu(updated),
  });
});

/* =========================================================
   13. DELETE TIME MENU
   DELETE /admin/menu/time-menus/:timeMenuId
   TimeMenuOutlet / TimeMenuItem cascade; FoodItem and Outlet rows
   are never touched.
========================================================= */

export const deleteTimeMenu = controller(async (req, res) => {
  const timeMenuId = validateId(req.params.timeMenuId, "time menu ID");

  const affectedMappings = await prisma.$transaction(async (tx) => {
    const menu = await loadTimeMenu(tx, timeMenuId);

    // OutletMenuItem.timeMenuLabel is matched to a time menu by name.
    // Report (but do not rewrite) mappings that referenced this menu.
    const affected = await tx.outletMenuItem.count({
      where: {
        timeMenuLabel: menu.name,
        outletId: { in: menu.outlets.map((entry) => entry.outletId) },
        foodItemId: { in: menu.items.map((entry) => entry.foodItemId) },
      },
    });

    await tx.timeMenu.delete({ where: { id: timeMenuId } });

    await writeAudit(tx, req, "TIME_MENU_DELETED", "TIME_MENU", timeMenuId, {
      before: timeMenuSnapshot(menu),
      mappingsStillLabelled: affected,
    });

    return affected;
  }, TX_OPTIONS);

  return respond(res, "Time menu deleted successfully.", {
    id: timeMenuId,
    mappingsStillLabelled: affectedMappings,
  });
});

/* =========================================================
   14. UPDATE OUTLET ITEM AVAILABILITY
   Not registered in admin.routes.js and not imported anywhere.
   The manager route PATCH /manager/menu-availability/:itemId is
   served by manager.controller.updateMenuAvailability, which owns
   that behaviour. No second implementation is created here.
   Central Admin changes go through updateOutletMapping.
========================================================= */

export const updateOutletItemAvailability = controller(async () => {
  throw new HttpError(
    "This handler is not routed. Managers use /manager/menu-availability/:itemId; Central Admin uses updateOutletMapping.",
    501,
    "HANDLER_NOT_ROUTED",
  );
});