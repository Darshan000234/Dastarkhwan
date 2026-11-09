import { randomInt } from "node:crypto";

export class HttpError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_REQUEST") {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function assertObject(value, message = "Invalid request body.") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(message, 400);
  }

  return value;
}

export function assertAllowedKeys(value, allowed) {
  if (!Object.keys(value).every((key) => allowed.includes(key))) {
    throw new HttpError("Unexpected request fields.", 400);
  }
}

export function requiredString(value, field, maxLength, minLength = 1) {
  if (typeof value !== "string") {
    throw new HttpError(`${field} must be a string.`, 400);
  }

  const clean = value.trim();

  if (
    clean.length < minLength ||
    clean.length > maxLength ||
    /[\u0000-\u001F\u007F]/.test(clean)
  ) {
    throw new HttpError(`Enter a valid ${field}.`, 400);
  }

  return clean;
}

export function validatePincode(value) {
  if (typeof value !== "string" || !/^[1-9]\d{5}$/.test(value.trim())) {
    throw new HttpError("Enter a valid six-digit Indian pincode.", 400);
  }

  return value.trim();
}

export function validatePhone(value, field = "Phone number") {
  if (typeof value !== "string" || !/^[6-9]\d{9}$/.test(value.trim())) {
    throw new HttpError(
      `Enter a valid 10-digit Indian ${field.toLowerCase()}.`,
      400,
    );
  }

  return value.trim();
}

export function validateEmail(value, optional = true) {
  if (value === undefined || value === null || value === "") {
    if (optional) return null;
    throw new HttpError("Email address is required.", 400);
  }

  if (typeof value !== "string") {
    throw new HttpError("Email must be a string.", 400);
  }

  const email = value.trim().toLowerCase();

  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new HttpError("Enter a valid email address.", 400);
  }

  return email;
}

export function validateId(value, field = "ID") {
  if (
    typeof value !== "string" ||
    value.trim().length < 1 ||
    value.trim().length > 100
  ) {
    throw new HttpError(`Invalid ${field}.`, 400);
  }

  return value.trim();
}

export function validatePagination(query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new HttpError("Invalid pagination parameters.", 400);
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function toNumber(value) {
  return Number(value ?? 0);
}

export function publicOutlet(outlet) {
  if (!outlet) return null;

  return {
    id: outlet.id,
    name: outlet.name,
    type: outlet.type === "CLOUD_KITCHEN" ? "Cloud Kitchen" : "Restaurant",
    city: outlet.city?.name || null,
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
    pincode: outlet.pincode,
    primaryPincode: outlet.primaryPincode,
    phone: outlet.phone,
    prepTime: outlet.minimumPrepMinutes,
    active: outlet.isActive,
  };
}

/* =========================================================
   PINCODE SERVICEABILITY
========================================================= */

export async function findEligibleOutlets(db, pincode) {
  const clean = validatePincode(pincode);

  const outlets = await db.outlet.findMany({
    where: {
      isActive: true,
      OR: [{ primaryPincode: clean }, { deliveryPincodes: { has: clean } }],
    },
    include: {
      city: {
        select: {
          id: true,
          name: true,
          state: true,
        },
      },
    },
  });

  // Prefer the configured primary pincode.
  // No distance calculation is invented.
  outlets.sort((a, b) => {
    const aPrimary = a.primaryPincode === clean ? 1 : 0;
    const bPrimary = b.primaryPincode === clean ? 1 : 0;

    return (
      bPrimary - aPrimary ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id)
    );
  });

  return outlets;
}

export async function resolveAddress(
  db,
  userId,
  addressId,
  { required = false } = {},
) {
  if (addressId !== undefined && addressId !== null) {
    const id = validateId(addressId, "address ID");

    const address = await db.address.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!address) {
      throw new HttpError(
        "Delivery address not found.",
        404,
        "ADDRESS_NOT_FOUND",
      );
    }

    return address;
  }

  const address = await db.address.findFirst({
    where: {
      userId,
      isDefault: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!address && required) {
    throw new HttpError(
      "Save or select a delivery address before continuing.",
      422,
      "ADDRESS_REQUIRED",
    );
  }

  return address;
}

export async function resolveDeliveryContext(
  db,
  userId,
  body,
  { requireAddress = false } = {},
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { pincode: true },
  });

  if (!user) {
    throw new HttpError("Customer account not found.", 404);
  }

  const address = await resolveAddress(db, userId, body.addressId, {
    required: requireAddress,
  });

  const pincode = address?.pincode || user.pincode;

  if (!pincode) {
    throw new HttpError(
      "Add a delivery pincode before ordering.",
      422,
      "DELIVERY_LOCATION_REQUIRED",
    );
  }

  const eligibleOutlets = await findEligibleOutlets(db, pincode);

  if (!eligibleOutlets.length) {
    throw new HttpError(
      "No active Dastarkhwan outlet currently serves this pincode.",
      422,
      "NOT_SERVICEABLE",
    );
  }

  const requestedOutletId = body.outletId;

  let outlet;

  if (requestedOutletId !== undefined) {
    const id = validateId(requestedOutletId, "outlet ID");

    outlet = eligibleOutlets.find((entry) => entry.id === id);

    if (!outlet) {
      throw new HttpError(
        "The selected outlet does not serve this delivery pincode.",
        422,
        "OUTLET_NOT_SERVICEABLE",
      );
    }
  } else {
    outlet = eligibleOutlets[0];
  }

  return {
    user,
    address,
    pincode,
    outlet,
    eligibleOutlets,
  };
}

/* =========================================================
   INDIA STANDARD TIME / TIME MENUS
========================================================= */

function getIstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const result = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    day: result.weekday,
    minutes: Number(result.hour) * 60 + Number(result.minute),
  };
}

function parseClock(value) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hour, minute] = value.split(":").map(Number);

  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

function isWithinSchedule(schedule, nowParts) {
  if (!schedule.days?.includes(nowParts.day)) return false;

  const start = parseClock(schedule.startTime);
  const end = parseClock(schedule.endTime);

  if (start === null || end === null) return false;

  if (start <= end) {
    return nowParts.minutes >= start && nowParts.minutes < end;
  }

  // Supports schedules crossing midnight.
  return nowParts.minutes >= start || nowParts.minutes < end;
}

async function getOutletSchedules(db, outletId) {
  return db.timeMenu.findMany({
    where: {
      isActive: true,
      outlets: {
        some: { outletId },
      },
    },
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      days: true,
      items: {
        select: {
          foodItemId: true,
        },
      },
    },
  });
}

function checkMappingSchedule(mapping, schedules, nowParts) {
  const label = mapping.timeMenuLabel?.trim();

  if (!label || label.toLowerCase() === "all day") {
    return {
      available: true,
      reason: null,
    };
  }

  const relevant = schedules.filter(
    (schedule) =>
      schedule.name === label &&
      schedule.items.some((item) => item.foodItemId === mapping.foodItemId),
  );

  const activeNow = relevant.some((schedule) =>
    isWithinSchedule(schedule, nowParts),
  );

  if (activeNow) {
    return {
      available: true,
      reason: null,
    };
  }

  const nextWindow = relevant[0];

  return {
    available: false,
    reason: nextWindow
      ? `Available during ${nextWindow.startTime}–${nextWindow.endTime} IST`
      : "This item has no active service window.",
  };
}

/* =========================================================
   OUTLET MENU
========================================================= */

export async function getOutletMenuRows(db, outlet) {
  const rows = await db.outletMenuItem.findMany({
    where: {
      outletId: outlet.id,
      foodItem: {
        isActive: true,
      },
    },
    include: {
      foodItem: {
        include: {
          portions: {
            where: { isActive: true },
            orderBy: { price: "asc" },
          },
          addonGroups: {
            orderBy: { sortOrder: "asc" },
            include: {
              options: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          cityPrices: {
            where: {
              cityId: outlet.cityId,
            },
            take: 1,
            select: {
              price: true,
            },
          },
        },
      },
    },
    orderBy: {
      foodItem: {
        name: "asc",
      },
    },
  });

  const schedules = await getOutletSchedules(db, outlet.id);
  const nowParts = getIstParts();

  return rows.map((mapping) => {
    const item = mapping.foodItem;

    const cityPrice = item.cityPrices[0]?.price;

    const effectiveBase =
      mapping.priceOverride !== null
        ? toNumber(mapping.priceOverride)
        : cityPrice !== undefined
          ? toNumber(cityPrice)
          : toNumber(item.basePrice);

    const baseOffset = effectiveBase - toNumber(item.basePrice);

    const timeCheck = checkMappingSchedule(mapping, schedules, nowParts);

    const inStock = mapping.stockQuantity > 0;

    const available = Boolean(
      mapping.isAvailable && inStock && timeCheck.available,
    );

    const portions = item.portions.map((portion) => ({
      id: portion.id,
      name: portion.name,
      price: roundMoney(toNumber(portion.price) + baseOffset),
    }));

    const addons = item.addonGroups.flatMap((group) =>
      group.options.map((option) => ({
        id: option.id,
        name: option.name,
        price: toNumber(option.price),
        groupId: group.id,
        groupName: group.name,
        isRequired: group.isRequired,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
      })),
    );

    const availabilityReason = !mapping.isAvailable
      ? mapping.unavailabilityReason || "Currently unavailable."
      : !inStock
        ? "Currently sold out."
        : !timeCheck.available
          ? timeCheck.reason
          : null;

    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      category: item.category,
      image: item.imageUrl,
      foodType: item.foodType,
      veg: item.foodType === "VEG",
      spiceLevel: item.spiceLevel,
      spice: item.spiceLevel,
      allergens: item.allergens,
      prepTime: item.prepTimeMinutes,
      basePrice: toNumber(item.basePrice),
      effectivePrice: effectiveBase,
      portions,
      addons,
      addonsRequired: item.addonGroups.some(
        (group) => group.isRequired || group.minSelect > 0,
      ),
      addonGroups: item.addonGroups.map((group) => ({
        id: group.id,
        name: group.name,
        isRequired: group.isRequired,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        options: group.options.map((option) => ({
          id: option.id,
          name: option.name,
          price: toNumber(option.price),
        })),
      })),
      mapping: {
        id: mapping.id,
        available,
        stockQty: mapping.stockQuantity,
        timeMenu: mapping.timeMenuLabel,
      },
      availabilityReason,
    };
  });
}

export function mapPublicMenuItem(item) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    image: item.image,
    veg: item.veg,
    foodType: item.foodType,
    spice: item.spice,
    allergens: item.allergens,
    prepTime: item.prepTime,
    basePrice: item.basePrice,
    effectivePrice: item.effectivePrice,
    portions: item.portions,
    addons: item.addons,
    addonGroups: item.addonGroups,
    addonsRequired: item.addonsRequired,
    available: item.mapping.available,
    availabilityReason: item.availabilityReason,
  };
}

/* =========================================================
   SERVER-AUTHORITATIVE CART QUOTE
========================================================= */

function normalizeSelectedAddon(value) {
  if (typeof value === "string") {
    return { id: value, name: value };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError("Invalid selected add-on.", 400);
  }

  return {
    id: typeof value.id === "string" ? value.id : null,
    name: typeof value.name === "string" ? value.name.trim() : null,
  };
}

function resolveSelectedPortion(item, line) {
  const portions = item.portions;

  if (!portions.length) {
    return null;
  }

  const requestedId =
    typeof line.portionId === "string" ? line.portionId : null;

  const requestedName =
    typeof line.portion === "string" ? line.portion.trim() : null;

  const portion =
    portions.find((entry) => entry.id === requestedId) ||
    portions.find((entry) => entry.name === requestedName) ||
    (portions.length === 1 && !requestedId && !requestedName
      ? portions[0]
      : null);

  if (!portion) {
    throw new HttpError(
      `${item.name}: the selected portion is unavailable.`,
      422,
      "INVALID_PORTION",
    );
  }

  return portion;
}

function resolveSelectedAddons(item, requestedAddons) {
  if (!Array.isArray(requestedAddons) || requestedAddons.length > 20) {
    throw new HttpError("Invalid add-on selection.", 400);
  }

  const selected = [];
  const usedIds = new Set();

  for (const requested of requestedAddons) {
    const value = normalizeSelectedAddon(requested);

    let matches = [];

    if (value.id) {
      matches = item.addonGroups.flatMap((group) =>
        group.options
          .filter((option) => option.id === value.id)
          .map((option) => ({ group, option })),
      );
    } else if (value.name) {
      matches = item.addonGroups.flatMap((group) =>
        group.options
          .filter((option) => option.name === value.name)
          .map((option) => ({ group, option })),
      );
    }

    if (matches.length !== 1) {
      throw new HttpError(
        `${item.name}: one or more selected extras are invalid.`,
        422,
        "INVALID_ADDON",
      );
    }

    const { group, option } = matches[0];

    if (usedIds.has(option.id)) {
      throw new HttpError(`${item.name}: duplicate add-on selected.`, 422);
    }

    usedIds.add(option.id);

    selected.push({
      id: option.id,
      name: option.name,
      price: toNumber(option.price),
      groupId: group.id,
      groupName: group.name,
    });
  }

  for (const group of item.addonGroups) {
    const selectedCount = selected.filter(
      (entry) => entry.groupId === group.id,
    ).length;

    const minimum = Math.max(group.minSelect, group.isRequired ? 1 : 0);

    if (selectedCount < minimum || selectedCount > group.maxSelect) {
      throw new HttpError(
        `${item.name}: select between ${minimum} and ${group.maxSelect} options for ${group.name}.`,
        422,
        "ADDON_SELECTION_INVALID",
      );
    }
  }

  return selected;
}

export async function buildCartQuote(
  db,
  userId,
  body,
  { requireAddress = false } = {},
) {
  let instructions = null;

  if (body.instructions !== undefined && body.instructions !== null) {
    if (
      typeof body.instructions !== "string" ||
      body.instructions.length > 500
    ) {
      throw new HttpError(
        "Kitchen instructions must be text and cannot exceed 500 characters.",
        400,
      );
    }

    instructions = body.instructions.trim() || null;
  }
  assertObject(body);

  const allowedBodyKeys = [
    "outletId",
    "addressId",
    "items",
    "cart",
    "couponCode",
    "loyaltyPoints",
    "loyaltyRedeemPoints",
    "instructions",
    "fulfillmentType",
    "idempotencyKey",
  ];

  assertAllowedKeys(body, allowedBodyKeys);

  const requestedItems = body.items ?? body.cart;

  if (
    !Array.isArray(requestedItems) ||
    requestedItems.length < 1 ||
    requestedItems.length > 30
  ) {
    throw new HttpError("Your cart must contain between 1 and 30 items.", 400);
  }

  const deliveryContext = await resolveDeliveryContext(db, userId, body, {
    required: requireAddress,
  });

  const { address, pincode, outlet } = deliveryContext;

  if (
    body.fulfillmentType !== undefined &&
    body.fulfillmentType !== "DELIVERY"
  ) {
    throw new HttpError("Only delivery checkout is currently supported.", 422);
  }

  if (typeof body.outletId !== "string" || !body.outletId) {
    throw new HttpError("Select a delivery outlet.", 400);
  }

  if (typeof body.instructions === "string" && body.instructions.length > 500) {
    throw new HttpError(
      "Kitchen instructions cannot exceed 500 characters.",
      400,
    );
  }

  const cleanLines = requestedItems.map((line) => {
    assertObject(line);

    assertAllowedKeys(line, [
      "itemId",
      "outletId",
      "quantity",
      "qty",
      "portionId",
      "portion",
      "addons",
      "addonIds",
      "specialNote",
      "instructions",
      "name",
      "image",
      "category",
      "unitPrice",
      "price",
      "lineTotal",
    ]);

    const itemId = validateId(line.itemId, "food item ID");

    if (line.outletId !== undefined && line.outletId !== outlet.id) {
      throw new HttpError(
        "Your cart contains an item from another outlet.",
        422,
        "MULTIPLE_OUTLETS",
      );
    }

    const quantity = line.quantity ?? line.qty;

    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new HttpError(
        "Each item quantity must be a whole number between 1 and 20.",
        400,
      );
    }

    const specialNote = line.specialNote ?? line.instructions ?? null;

    if (
      specialNote !== null &&
      (typeof specialNote !== "string" || specialNote.length > 300)
    ) {
      throw new HttpError(
        "Item instructions cannot exceed 300 characters.",
        400,
      );
    }

    const addons = line.addons ?? line.addonIds ?? [];

    if (!Array.isArray(addons)) {
      throw new HttpError("Invalid add-on list.", 400);
    }

    return {
      itemId,
      quantity,
      portionId: line.portionId,
      portion: line.portion,
      addons,
      specialNote,
    };
  });

  const itemIds = [...new Set(cleanLines.map((line) => line.itemId))];

  const mappings = await db.outletMenuItem.findMany({
    where: {
      outletId: outlet.id,
      foodItemId: { in: itemIds },
      foodItem: { isActive: true },
    },
    include: {
      foodItem: {
        include: {
          portions: {
            where: { isActive: true },
          },
          addonGroups: {
            include: {
              options: {
                where: { isActive: true },
              },
            },
          },
          cityPrices: {
            where: { cityId: outlet.cityId },
            take: 1,
          },
        },
      },
    },
  });

  const mappingByItemId = new Map(
    mappings.map((mapping) => [mapping.foodItemId, mapping]),
  );

  const schedules = await getOutletSchedules(db, outlet.id);
  const nowParts = getIstParts();

  const normalizedLines = [];
  const requestedStock = new Map();

  for (const line of cleanLines) {
    const mapping = mappingByItemId.get(line.itemId);

    if (!mapping) {
      throw new HttpError(
        "One or more dishes are no longer assigned to this outlet.",
        422,
        "ITEM_NOT_MAPPED",
      );
    }

    if (!mapping.isAvailable) {
      throw new HttpError(
        `${mapping.foodItem.name} is currently unavailable.`,
        422,
        "ITEM_UNAVAILABLE",
      );
    }

    if (mapping.stockQuantity <= 0) {
      throw new HttpError(
        `${mapping.foodItem.name} is sold out.`,
        422,
        "OUT_OF_STOCK",
      );
    }

    const timeCheck = checkMappingSchedule(mapping, schedules, nowParts);

    if (!timeCheck.available) {
      throw new HttpError(
        `${mapping.foodItem.name}: ${timeCheck.reason}`,
        422,
        "TIME_MENU_CLOSED",
      );
    }

    const item = mapping.foodItem;
    const portion = resolveSelectedPortion(item, line);
    const addons = resolveSelectedAddons(item, line.addons);

    const cityPrice = item.cityPrices[0]?.price;

    const effectiveBase =
      mapping.priceOverride !== null
        ? toNumber(mapping.priceOverride)
        : cityPrice !== undefined
          ? toNumber(cityPrice)
          : toNumber(item.basePrice);

    const baseOffset = effectiveBase - toNumber(item.basePrice);

    const portionPrice = portion
      ? roundMoney(toNumber(portion.price) + baseOffset)
      : roundMoney(effectiveBase);

    const addonTotal = roundMoney(
      addons.reduce((sum, addon) => sum + addon.price, 0),
    );

    const unitPrice = roundMoney(portionPrice + addonTotal);
    const lineTotal = roundMoney(unitPrice * line.quantity);

    requestedStock.set(
      mapping.id,
      (requestedStock.get(mapping.id) || 0) + line.quantity,
    );

    normalizedLines.push({
      itemId: item.id,
      outletMenuItemId: mapping.id,
      name: item.name,
      category: item.category,
      image: item.imageUrl,
      quantity: line.quantity,
      portionId: portion?.id || null,
      portion: portion?.name || null,
      baseUnitPrice: portionPrice,
      addons,
      addonTotal,
      unitPrice,
      lineTotal,
      specialNote: line.specialNote,
      stockAvailable: mapping.stockQuantity,
      prepTimeMinutes: item.prepTimeMinutes,
    });
  }

  for (const [mappingId, quantity] of requestedStock) {
    const mapping = mappings.find((entry) => entry.id === mappingId);

    if (quantity > mapping.stockQuantity) {
      throw new HttpError(
        `Only ${mapping.stockQuantity} units remain for ${mapping.foodItem.name}.`,
        422,
        "INSUFFICIENT_STOCK",
      );
    }
  }

  const subtotal = roundMoney(
    normalizedLines.reduce((sum, line) => sum + line.lineTotal, 0),
  );

  /* Coupon validation */

  let coupon = null;
  let couponDiscount = 0;

  const couponCode =
    body.couponCode === undefined || body.couponCode === null
      ? null
      : requiredString(body.couponCode, "coupon code", 40).toUpperCase();

  if (couponCode) {
    coupon = await db.coupon.findUnique({
      where: { code: couponCode },
    });

    const now = new Date();

    if (
      !coupon ||
      !coupon.isActive ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt < now)
    ) {
      throw new HttpError(
        "This coupon is not currently valid.",
        422,
        "COUPON_INVALID",
      );
    }

    if (subtotal < toNumber(coupon.minimumOrder)) {
      throw new HttpError(
        `Your order must be at least ₹${toNumber(coupon.minimumOrder).toFixed(2)} to use this coupon.`,
        422,
        "COUPON_MINIMUM_NOT_MET",
      );
    }

    const totalRedemptions = await db.couponRedemption.count({
      where: { couponId: coupon.id },
    });

    const customerRedemptions = await db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        userId,
      },
    });

    if (
      coupon.totalUsageLimit !== null &&
      totalRedemptions >= coupon.totalUsageLimit
    ) {
      throw new HttpError(
        "This coupon has reached its usage limit.",
        422,
        "COUPON_USAGE_LIMIT",
      );
    }

    if (customerRedemptions >= coupon.perUserLimit) {
      throw new HttpError(
        "You have already used this coupon the maximum number of times.",
        422,
        "COUPON_CUSTOMER_LIMIT",
      );
    }

    if (coupon.firstOrderOnly) {
      const previousPaidOrders = await db.order.count({
        where: {
          customerId: userId,
          paymentStatus: "SUCCEEDED",
          status: { not: "CANCELLED" },
        },
      });

      if (previousPaidOrders > 0) {
        throw new HttpError(
          "This coupon is available only on your first paid order.",
          422,
          "COUPON_FIRST_ORDER_ONLY",
        );
      }
    }

    const rawDiscount =
      coupon.discountType === "PERCENTAGE"
        ? (subtotal * toNumber(coupon.discountValue)) / 100
        : toNumber(coupon.discountValue);

    couponDiscount = roundMoney(
      Math.min(
        subtotal,
        coupon.maximumDiscount === null
          ? rawDiscount
          : Math.min(rawDiscount, toNumber(coupon.maximumDiscount)),
      ),
    );
  }

  /* Loyalty redemption */

  const requestedPoints = body.loyaltyPoints ?? body.loyaltyRedeemPoints ?? 0;

  if (
    !Number.isSafeInteger(requestedPoints) ||
    requestedPoints < 0 ||
    requestedPoints > 1000000 ||
    requestedPoints % 100 !== 0
  ) {
    throw new HttpError(
      "Loyalty points must be a non-negative multiple of 100.",
      400,
    );
  }

  let loyaltyAccount = null;
  let loyaltyPoints = 0;
  let loyaltyDiscount = 0;

  if (requestedPoints > 0) {
    loyaltyAccount = await db.loyaltyAccount.findUnique({
      where: { userId },
    });

    if (!loyaltyAccount) {
      throw new HttpError(
        "You do not have a loyalty balance to redeem.",
        422,
        "LOYALTY_ACCOUNT_NOT_FOUND",
      );
    }

    const afterCoupon = Math.max(0, subtotal - couponDiscount);

    const maximumBySubtotal = Math.floor((subtotal * 2.5) / 100) * 100;

    const maximumByRemaining = Math.floor((afterCoupon * 10) / 100) * 100;

    const maximumRedeemable = Math.min(
      loyaltyAccount.pointsBalance,
      maximumBySubtotal,
      maximumByRemaining,
    );

    if (requestedPoints > maximumRedeemable) {
      throw new HttpError(
        `You can redeem up to ${maximumRedeemable} points on this order.`,
        422,
        "LOYALTY_LIMIT_EXCEEDED",
      );
    }

    loyaltyPoints = requestedPoints;
    loyaltyDiscount = roundMoney(loyaltyPoints / 10);
  }

  // Existing frontend rule: ₹35 below ₹799, otherwise free.
  // Food prices are already GST-inclusive.
  const deliveryFee = subtotal === 0 || subtotal >= 799 ? 0 : 35;

  const total = roundMoney(
    Math.max(0, subtotal - couponDiscount - loyaltyDiscount + deliveryFee),
  );

  // Extract the GST component; do not add it to the payable total.
  const taxableFoodValue = Math.max(
    0,
    subtotal - couponDiscount - loyaltyDiscount,
  );

  const taxAmount = roundMoney((taxableFoodValue * 5) / 105);

  return {
    userId,
    address,
    pincode,
    outlet,
    instructions,
    items: normalizedLines,
    subtotal,
    coupon,
    couponCode,
    couponDiscount,
    loyaltyAccount,
    loyaltyPoints,
    loyaltyDiscount,
    deliveryFee,
    taxAmount,
    gstRate: 5,
    gstInclusive: true,
    total,
    fulfillmentType: "DELIVERY",
  };
}

/* =========================================================
   PREPARATION ESTIMATE
========================================================= */


/* =========================================================
   PREPARATION TIME PREDICTION
   KNN historical model + workload fallback
========================================================= */

const PREP_MODEL_VERSION = "knn-v1";
const MIN_HISTORY_SAMPLES = 10;
const K_NEIGHBOURS = 5;
const HISTORY_DAYS = 90;

// Features are normalized so large numeric values do not
// dominate the KNN distance calculation.
const FEATURE_SCALES = {
  baseItemMinutes: 60,
  activeOrders: 20,
  uniqueItems: 10,
  totalQuantity: 20,
};

function getHourInIndia(date) {
  return Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );
}

function getCurrentOrderFeatures(items, activeOrders, now = new Date()) {
  const uniqueItems = new Set(
    items.map((item) => item.itemId),
  );

  const baseItemMinutes = Math.max(
    0,
    ...items.map((item) =>
      Number(item.prepTimeMinutes || 0),
    ),
  );

  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  return {
    baseItemMinutes,
    activeOrders,
    uniqueItems: uniqueItems.size,
    totalQuantity,
    hourOfDay: getHourInIndia(now),
  };
}

function calculateWorkloadFallback(
  features,
  minimumPrepMinutes,
) {
  const workloadMinutes = Math.min(
    24,
    features.activeOrders * 3,
  );

  const complexityMinutes = Math.max(
    0,
    features.uniqueItems - 1,
  ) * 2;

  const predictedMinutes =
    features.baseItemMinutes +
    workloadMinutes +
    complexityMinutes;

  const minutes = Math.max(
    Math.ceil(predictedMinutes),
    minimumPrepMinutes,
  );

  return {
    minutes,
    details: {
      method: "WORKLOAD_FALLBACK",
      modelVersion: PREP_MODEL_VERSION,
      fallbackReason: "INSUFFICIENT_HISTORICAL_DATA",
      historySamples: 0,
      baseItemMinutes: features.baseItemMinutes,
      activeOrders: features.activeOrders,
      workloadMinutes,
      complexityMinutes,
      uniqueItems: features.uniqueItems,
      totalQuantity: features.totalQuantity,
      outletMinimumMinutes: minimumPrepMinutes,
      predictedMinutes,
    },
  };
}

/**
 * Convert a completed order into a historical training example.
 *
 * Historical actual time is measured from order placement
 * until the kitchen marks the order READY.
 */
function buildHistoricalFeature(order) {
  if (
    !(order.placedAt instanceof Date) ||
    !(order.readyAt instanceof Date) ||
    !Array.isArray(order.items) ||
    !order.events?.length
  ) {
    return null;
  }

  const actualPrepMinutes =
    (order.readyAt.getTime() - order.placedAt.getTime()) /
    60_000;

  // Reject invalid and extreme records.
  if (
    !Number.isFinite(actualPrepMinutes) ||
    actualPrepMinutes < 1 ||
    actualPrepMinutes > 180
  ) {
    return null;
  }

  const event = order.events[0];
  const metadata = event?.metadata;

  const estimateDetails = metadata?.estimateDetails;

  // Only train on records that contain the original
  // workload information needed by this model.
  if (
    !estimateDetails ||
    !Number.isFinite(Number(estimateDetails.baseItemMinutes)) ||
    !Number.isFinite(Number(estimateDetails.activeOrders))
  ) {
    return null;
  }

  const totalQuantity = order.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const uniqueItems = new Set(
    order.items.map((item) => item.foodItemId).filter(Boolean),
  );

  if (!totalQuantity || !uniqueItems.size) {
    return null;
  }

  return {
    features: {
      baseItemMinutes: Number(estimateDetails.baseItemMinutes),
      activeOrders: Number(estimateDetails.activeOrders),
      uniqueItems: uniqueItems.size,
      totalQuantity,
      hourOfDay: getHourInIndia(order.placedAt),
    },
    actualPrepMinutes,
  };
}

/**
 * Circular hour difference:
 * 23:00 and 00:00 are only one hour apart.
 */
function hourDifference(a, b) {
  const difference = Math.abs(a - b);
  return Math.min(difference, 24 - difference);
}

function calculateFeatureDistance(current, historical) {
  const differences = [
    (current.baseItemMinutes - historical.baseItemMinutes) /
      FEATURE_SCALES.baseItemMinutes,

    (current.activeOrders - historical.activeOrders) /
      FEATURE_SCALES.activeOrders,

    (current.uniqueItems - historical.uniqueItems) /
      FEATURE_SCALES.uniqueItems,

    (current.totalQuantity - historical.totalQuantity) /
      FEATURE_SCALES.totalQuantity,

    hourDifference(current.hourOfDay, historical.hourOfDay) / 12,
  ];

  return Math.sqrt(
    differences.reduce(
      (sum, difference) => sum + difference ** 2,
      0,
    ),
  );
}

/**
 * K-Nearest Neighbours regression.
 *
 * Nearby historical orders receive more weight.
 */
export function predictPreparationTimeKnn(
  currentFeatures,
  historicalSamples,
  outletMinimumMinutes,
) {
  const nearest = historicalSamples
    .map((sample) => ({
      ...sample,
      distance: calculateFeatureDistance(
        currentFeatures,
        sample.features,
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, K_NEIGHBOURS);

  if (!nearest.length) {
    return null;
  }

  const weightedTotal = nearest.reduce(
    (sum, sample) => {
      const weight = 1 / (sample.distance + 0.05);

      return sum + sample.actualPrepMinutes * weight;
    },
    0,
  );

  const totalWeight = nearest.reduce(
    (sum, sample) =>
      sum + 1 / (sample.distance + 0.05),
    0,
  );

  const predictedMinutes = weightedTotal / totalWeight;

  if (!Number.isFinite(predictedMinutes)) {
    return null;
  }

  // Safety boundary: never promise less than the outlet minimum.
  const minutes = Math.max(
    Math.ceil(predictedMinutes),
    outletMinimumMinutes,
  );

  return {
    minutes,
    details: {
      method: "HISTORICAL_KNN",
      modelVersion: PREP_MODEL_VERSION,
      historySamples: historicalSamples.length,
      nearestSamples: nearest.length,
      baseItemMinutes: currentFeatures.baseItemMinutes,
      activeOrders: currentFeatures.activeOrders,
      uniqueItems: currentFeatures.uniqueItems,
      totalQuantity: currentFeatures.totalQuantity,
      hourOfDay: currentFeatures.hourOfDay,
      outletMinimumMinutes,
      predictedMinutes: Number(predictedMinutes.toFixed(2)),
    },
  };
}

/**
 * Main estimator called by checkout.controller.js.
 *
 * Uses the same function signature as the previous estimator,
 * so the existing checkout integration can remain unchanged.
 */
export async function estimatePreparationMinutes(
  db,
  outlet,
  items,
) {
  const minimumPrepMinutes = Math.max(
    1,
    Number(outlet.minimumPrepMinutes || 25),
  );

  // Only orders still being prepared contribute to workload.
  // READY orders have finished kitchen preparation.
  const activeOrders = await db.order.count({
    where: {
      outletId: outlet.id,
      paymentStatus: "SUCCEEDED",
      status: {
        in: ["PLACED", "ACCEPTED", "PREPARING"],
      },
    },
  });

  const now = new Date();

  const currentFeatures = getCurrentOrderFeatures(
    items,
    activeOrders,
    now,
  );

  // Fetch recent completed orders from this outlet only.
  const historyStart = new Date(
    now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );

  const historicalOrders = await db.order.findMany({
    where: {
      outletId: outlet.id,
      paymentStatus: "SUCCEEDED",
      status: {
        in: ["READY", "HANDED_OFF"],
      },
      readyAt: {
        not: null,
      },
      placedAt: {
        gte: historyStart,
      },
      events: {
        some: {
          eventType: "CHECKOUT_DRAFT_CREATED",
        },
      },
    },
    select: {
      placedAt: true,
      readyAt: true,
      items: {
        select: {
          foodItemId: true,
          quantity: true,
        },
      },
      events: {
        where: {
          eventType: "CHECKOUT_DRAFT_CREATED",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          metadata: true,
        },
      },
    },
    orderBy: {
      readyAt: "desc",
    },
    take: 100,
  });

  const historicalSamples = historicalOrders
    .map(buildHistoricalFeature)
    .filter(Boolean);

  // Cold-start fallback: the model must not pretend
  // to have learned from insufficient historical records.
  if (historicalSamples.length < MIN_HISTORY_SAMPLES) {
    const fallback = calculateWorkloadFallback(
      currentFeatures,
      minimumPrepMinutes,
    );

    fallback.details.historySamples = historicalSamples.length;

    return fallback;
  }

  const prediction = predictPreparationTimeKnn(
    currentFeatures,
    historicalSamples,
    minimumPrepMinutes,
  );

  if (!prediction) {
    const fallback = calculateWorkloadFallback(
      currentFeatures,
      minimumPrepMinutes,
    );

    fallback.details.fallbackReason = "INVALID_MODEL_PREDICTION";
    fallback.details.historySamples = historicalSamples.length;

    return fallback;
  }

  return prediction;
}


/* =========================================================
   CUSTOMER-FACING ORDER MAPPING
========================================================= */

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

export function mapCustomerAddress(address) {
  if (!address) return null;

  return {
    id: address.id,
    name: address.recipientName,
    phone: address.phone,
    pincode: address.pincode,
    house: address.line1,
    street: address.locality || address.line2,
    landmark: address.landmark,
    city: address.city,
    type: address.label,
    isDefault: address.isDefault,
  };
}

export function mapCustomerOrder(order) {
  if (!order) return null;

  const items = (order.items || []).map((item) => {
    const addons = (item.addons || []).map((addon) => ({
      id: addon.addonOptionId,
      name: addon.addonName,
      price: toNumber(addon.unitPrice),
    }));

    const addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0);

    const quantity = item.quantity;

    const unitPrice = toNumber(item.unitPrice) + addonTotal;

    return {
      itemId: item.foodItemId,
      name: item.itemName,
      category: item.foodItem?.category || null,
      qty: quantity,
      quantity,
      price: unitPrice,
      lineTotal: toNumber(item.lineTotal),
      portion: item.portionName || "Regular",
      portionId: item.portionId,
      addons,
      instructions: item.preparationNote,
    };
  });

  const latestPayment = [...(order.payments || [])].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )[0];

  const address = mapCustomerAddress(order.address);

  const outletSnapshot = order.outlet
    ? {
        id: order.outlet.id,
        name: order.outlet.name,
        address: [
          order.outlet.addressLine1,
          order.outlet.locality,
          order.outlet.city?.name,
        ]
          .filter(Boolean)
          .join(", "),
      }
    : null;

  const timeline = (order.events || [])
    .filter((event) => event.toStatus)
    .map((event) => ({
      label: ORDER_STATUS_LABELS[event.toStatus] || event.toStatus,
      time: event.createdAt.toISOString(),
      at: event.createdAt.toISOString(),
      note:
        event.eventType === "ETA_OVERRIDDEN"
          ? "Preparation estimate updated."
          : undefined,
    }));

  return {
    id: order.orderNumber,
    orderId: order.id,
    customer: order.customerName,
    phone: order.customerPhone,
    customerId: order.customerId,
    outletId: order.outletId,
    outletSnapshot,
    address,
    itemSummary: items.map((item) => `${item.name} ×${item.qty}`).join(", "),
    items,
    subtotal: toNumber(order.subtotal),
    couponDiscount: toNumber(order.couponDiscount),
    loyaltyDiscount: toNumber(order.loyaltyDiscount),
    deliveryFee: toNumber(order.deliveryFee),
    taxAmount: toNumber(order.taxAmount),
    amount: toNumber(order.totalAmount),
    paymentMethod: order.paymentMethod || latestPayment?.method || null,
    paymentStatus:
      PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
    paymentReference: latestPayment?.providerReference || null,
    status: ORDER_STATUS_LABELS[order.status] || order.status,
    placedAt: order.placedAt.toISOString(),
    promisedAt: order.promisedAt.toISOString(),
    prepMinutes: order.estimatedPrepMinutes,
    startedAt: order.startedAt?.toISOString() || null,
    readyAt: order.readyAt?.toISOString() || null,
    handedOffAt: order.handedOffAt?.toISOString() || null,
    cancelledAt: order.cancelledAt?.toISOString() || null,
    instructions: order.specialInstructions,
    gstInclusive: order.gstInclusive,
    timeline,
  };
}

export function customerOrderInclude() {
  return {
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
        foodItem: {
          select: { category: true },
        },
        addons: true,
      },
    },
    payments: true,
    events: {
      orderBy: { createdAt: "asc" },
    },
  };
}

export async function findCustomerOrder(db, userId, orderId) {
  const id = validateId(orderId, "order ID");

  return db.order.findFirst({
    where: {
      customerId: userId,
      OR: [{ id }, { orderNumber: id }],
    },
    include: customerOrderInclude(),
  });
}

export function paginationResponse(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export function orderStatusFilter(value) {
  if (!value || value === "All") return undefined;

  const map = {
    Placed: "PLACED",
    Accepted: "ACCEPTED",
    Preparing: "PREPARING",
    Ready: "READY",
    "Handed Off": "HANDED_OFF",
    Completed: "HANDED_OFF",
    Cancelled: "CANCELLED",
  };

  return map[value] || null;
}
