import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  HttpError,
  assertObject,
  assertAllowedKeys,
  requiredString,
  validatePincode,
  validatePhone,
  validateEmail,
  validateId,
  validatePagination,
  findEligibleOutlets,
  publicOutlet,
  mapCustomerAddress,
  getOutletMenuRows,
  mapPublicMenuItem,
  paginationResponse,
} from "../utils/customerDomain.js";

function success(res, data, status = 200, message) {
  return res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    data,
  });
}

function getPincodeQuery(query) {
  return validatePincode(query.pincode);
}

async function resolvePublicMenuOutlet(pincode, requestedOutletId) {
  const outlets = await findEligibleOutlets(prisma, pincode);

  if (!outlets.length) {
    throw new HttpError(
      "No active outlet currently serves this pincode.",
      422,
      "NOT_SERVICEABLE",
    );
  }

  if (requestedOutletId !== undefined) {
    const id = validateId(requestedOutletId, "outlet ID");
    const selected = outlets.find((outlet) => outlet.id === id);

    if (!selected) {
      throw new HttpError(
        "The selected outlet does not serve this pincode.",
        422,
        "OUTLET_NOT_SERVICEABLE",
      );
    }

    return { outlet: selected, outlets };
  }

  return {
    outlet: outlets[0],
    outlets,
  };
}

function mapProfile(user, pincode) {
  return {
    id: user.id,
    name: user.fullName,
    phone: user.phone,
    email: user.email,
    pincode,
    verifiedPhone: Boolean(user.phoneVerifiedAt),
    // User has no marketingOptIn column in the current schema.
    marketingOptIn: null,
    marketingPreferenceSupported: false,
    createdAt: user.createdAt.toISOString(),
  };
}

function validateAddressInput(body, { partial = false } = {}) {
  assertObject(body);

  const allowed = [
    "name",
    "phone",
    "pincode",
    "house",
    "street",
    "landmark",
    "city",
    "type",
    "isDefault",
  ];

  assertAllowedKeys(body, allowed);

  const result = {};

  const stringFields = [
    ["name", "recipient name", 120],
    ["house", "house or flat", 180],
    ["street", "street or locality", 120],
    ["landmark", "landmark", 120],
    ["city", "city", 100],
  ];

  for (const [field, label, max] of stringFields) {
    if (body[field] !== undefined) {
      if (field === "landmark" && body[field] === "") {
        result[field] = "";
      } else {
        result[field] = requiredString(body[field], label, max);
      }
    } else if (
      !partial &&
      ["name", "house", "street", "city"].includes(field)
    ) {
      throw new HttpError(`${label} is required.`, 400);
    }
  }

  if (body.phone !== undefined) {
    result.phone = validatePhone(body.phone);
  } else if (!partial) {
    throw new HttpError("Address phone number is required.", 400);
  }

  if (body.pincode !== undefined) {
    result.pincode = validatePincode(body.pincode);
  } else if (!partial) {
    throw new HttpError("Address pincode is required.", 400);
  }

  if (body.type !== undefined) {
    if (
      typeof body.type !== "string" ||
      !["Home", "Work", "Other"].includes(body.type)
    ) {
      throw new HttpError("Address type must be Home, Work, or Other.", 400);
    }

    result.type = body.type;
  }

  if (body.isDefault !== undefined) {
    if (typeof body.isDefault !== "boolean") {
      throw new HttpError("isDefault must be a boolean.", 400);
    }

    result.isDefault = body.isDefault;
  }

  return result;
}

async function resolveAddressState(db, cityName, pincode) {
  const city = await db.city.findFirst({
    where: {
      name: {
        equals: cityName,
        mode: "insensitive",
      },
    },
    select: {
      name: true,
      state: true,
    },
  });

  if (city?.state) return city.state;

  // The frontend address form does not currently submit state.
  // Derive it from a configured serviceable outlet where possible.
  const outlets = await findEligibleOutlets(db, pincode);
  const matching = outlets.find(
    (outlet) => outlet.city?.name?.toLowerCase() === cityName.toLowerCase(),
  );

  if (matching?.state) return matching.state;

  throw new HttpError(
    "The selected city is not configured with a state in the service area.",
    422,
    "CITY_STATE_NOT_CONFIGURED",
  );
}

function addressWriteData(input, state, existing = {}) {
  return {
    label: input.type ?? existing.label ?? "Home",
    recipientName: input.name ?? existing.recipientName,
    phone: input.phone ?? existing.phone,
    line1: input.house ?? existing.line1,
    line2: existing.line2 ?? null,
    locality: input.street ?? existing.locality,
    city: input.city ?? existing.city,
    state: state ?? existing.state,
    pincode: input.pincode ?? existing.pincode,
    landmark:
      input.landmark === undefined
        ? (existing.landmark ?? null)
        : input.landmark || null,
    ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
  };
}

/* =========================================================
   GET BOOTSTRAP
   GET /api/v1/customer/bootstrap
========================================================= */

export const getBootstrap = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      pincode: true,
      phoneVerifiedAt: true,
      createdAt: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
      loyaltyAccount: {
        select: {
          pointsBalance: true,
          lifetimeEarned: true,
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              type: true,
              pointsDelta: true,
              description: true,
              createdAt: true,
              order: {
                select: { orderNumber: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new HttpError("Customer account not found.", 404);
  }

  const defaultAddress =
    user.addresses.find((address) => address.isDefault) ||
    user.addresses[0] ||
    null;

  const pincode = defaultAddress?.pincode || user.pincode || null;

  const eligibleOutlets = pincode
    ? await findEligibleOutlets(prisma, pincode)
    : [];

  const transactions = user.loyaltyAccount?.transactions || [];

  const loyalty = {
    balance: user.loyaltyAccount?.pointsBalance || 0,
    lifetimeEarned: user.loyaltyAccount?.lifetimeEarned || 0,
    lifetimeRedeemed: Math.abs(
      transactions
        .filter((entry) => entry.pointsDelta < 0)
        .reduce((sum, entry) => sum + entry.pointsDelta, 0),
    ),
    transactions: transactions.map((entry) => ({
      id: entry.id,
      type: entry.type.toLowerCase(),
      points: entry.pointsDelta,
      note:
        entry.description ||
        (entry.order?.orderNumber
          ? `Order ${entry.order.orderNumber}`
          : entry.type),
      at: entry.createdAt.toISOString(),
    })),
  };

  return success(res, {
    profile: mapProfile(user, pincode),
    addresses: user.addresses.map(mapCustomerAddress),
    selectedAddressId: defaultAddress?.id || null,
    selectedPincode: pincode || "",
    selectedOutletId: eligibleOutlets[0]?.id || "",
    serviceableOutlets: eligibleOutlets.map(publicOutlet),
    loyalty,
  });
});

/* =========================================================
   GET SERVICEABILITY
   GET /api/v1/customer/serviceability/:pincode
========================================================= */

export const getServiceability = asyncHandler(async (req, res) => {
  const pincode = validatePincode(req.params.pincode);
  const outlets = await findEligibleOutlets(prisma, pincode);

  return success(res, {
    serviceable: outlets.length > 0,
    pincode,
    outlets: outlets.map(publicOutlet),
    selectedOutlet: outlets[0] ? publicOutlet(outlets[0]) : null,
    reason: outlets.length
      ? null
      : "We do not have an active outlet serving this pincode yet.",
  });
});

/* =========================================================
   GET MENU
   GET /api/v1/customer/menu
========================================================= */

export const getMenu = asyncHandler(async (req, res) => {
  const pincode = getPincodeQuery(req.query);

  if (
    req.query.search !== undefined &&
    (typeof req.query.search !== "string" || req.query.search.length > 100)
  ) {
    throw new HttpError("Invalid menu search query.", 400);
  }

  const search = (req.query.search || "").trim().toLowerCase();
  const category =
    typeof req.query.category === "string" ? req.query.category.trim() : "";

  const foodType = req.query.foodType || "all";

  if (!["all", "veg", "nonveg"].includes(foodType)) {
    throw new HttpError("foodType must be all, veg, or nonveg.", 400);
  }

  const availability = req.query.availability || "all";

  if (!["all", "available", "unavailable"].includes(availability)) {
    throw new HttpError("Invalid availability filter.", 400);
  }

  const { page, limit, skip } = validatePagination(req.query);

  const { outlet } = await resolvePublicMenuOutlet(pincode, req.query.outletId);

  let rows = await getOutletMenuRows(prisma, outlet);

  if (category) {
    rows = rows.filter((item) => item.category === category);
  }

  if (search) {
    rows = rows.filter((item) =>
      `${item.name} ${item.description} ${item.category}`
        .toLowerCase()
        .includes(search),
    );
  }

  if (foodType === "veg") {
    rows = rows.filter((item) => item.veg);
  } else if (foodType === "nonveg") {
    rows = rows.filter((item) => !item.veg);
  }

  if (availability === "available") {
    rows = rows.filter((item) => item.mapping.available);
  } else if (availability === "unavailable") {
    rows = rows.filter((item) => !item.mapping.available);
  }

  const total = rows.length;

  return success(res, {
    outlet: publicOutlet(outlet),
    pincode,
    items: rows.slice(skip, skip + limit).map(mapPublicMenuItem),
    pagination: paginationResponse(page, limit, total),
  });
});

/* =========================================================
   GET MENU ITEM
   GET /api/v1/customer/menu/:itemId
========================================================= */

export const getMenuItem = asyncHandler(async (req, res) => {
  const itemId = validateId(req.params.itemId, "food item ID");
  const pincode = getPincodeQuery(req.query);

  const { outlet } = await resolvePublicMenuOutlet(pincode, req.query.outletId);

  const rows = await getOutletMenuRows(prisma, outlet);
  const item = rows.find((entry) => entry.id === itemId);

  if (!item) {
    throw new HttpError(
      "This dish is not available on the selected outlet menu.",
      404,
      "MENU_ITEM_NOT_FOUND",
    );
  }

  return success(res, {
    outlet: publicOutlet(outlet),
    pincode,
    item: mapPublicMenuItem(item),
  });
});

/* =========================================================
   GET CATEGORIES
   GET /api/v1/customer/menu/categories
========================================================= */

export const getCategories = asyncHandler(async (req, res) => {
  const pincode = getPincodeQuery(req.query);

  const { outlet } = await resolvePublicMenuOutlet(pincode, req.query.outletId);

  const rows = await getOutletMenuRows(prisma, outlet);

  const categories = [
    "All",
    ...new Set(rows.map((item) => item.category).filter(Boolean)),
  ];

  return success(res, {
    outlet: publicOutlet(outlet),
    categories,
  });
});

/* =========================================================
   GET POPULAR ITEMS
   GET /api/v1/customer/menu/popular
========================================================= */

export const getPopularItems = asyncHandler(async (req, res) => {
  const pincode = getPincodeQuery(req.query);

  const { outlet } = await resolvePublicMenuOutlet(pincode, req.query.outletId);

  const { limit } = validatePagination(req.query);

  const rows = await getOutletMenuRows(prisma, outlet);

  const mappedItems = new Map(rows.map((item) => [item.id, item]));

  const popular = await prisma.orderItem.groupBy({
    by: ["foodItemId"],
    where: {
      foodItemId: { not: null },
      order: {
        is: {
          outletId: outlet.id,
          paymentStatus: "SUCCEEDED",
          status: { not: "CANCELLED" },
        },
      },
    },
    _sum: {
      quantity: true,
      lineTotal: true,
    },
    orderBy: {
      _sum: {
        quantity: "desc",
      },
    },
    take: Math.min(limit, 20),
  });

  const items = popular
    .map((entry) => {
      const item = mappedItems.get(entry.foodItemId);

      if (!item) return null;

      return {
        ...mapPublicMenuItem(item),
        quantityOrdered: entry._sum.quantity || 0,
        revenueGenerated: Number(entry._sum.lineTotal || 0),
      };
    })
    .filter(Boolean);

  return success(res, {
    outlet: publicOutlet(outlet),
    items,
  });
});

/* =========================================================
   GET PROFILE
   GET /api/v1/customer/profile
========================================================= */

export const getProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      pincode: true,
      phoneVerifiedAt: true,
      createdAt: true,
      addresses: {
        where: { isDefault: true },
        take: 1,
        select: { pincode: true },
      },
    },
  });

  if (!user) {
    throw new HttpError("Customer account not found.", 404);
  }

  const pincode = user.addresses[0]?.pincode || user.pincode || null;

  return success(res, {
    ...mapProfile(user, pincode),
  });
});

/* =========================================================
   UPDATE PROFILE
   PATCH /api/v1/customer/profile
========================================================= */

export const updateProfile = asyncHandler(async (req, res) => {
  assertObject(req.body);

  assertAllowedKeys(req.body, ["name", "email", "marketingOptIn"]);

  const data = {};

  if (req.body.name !== undefined) {
    data.fullName = requiredString(req.body.name, "name", 120, 2);
  }

  if (req.body.email !== undefined) {
    const email = validateEmail(req.body.email);

    if (email) {
      const existing = await prisma.user.findFirst({
        where: {
          email,
          id: { not: req.user.id },
        },
        select: { id: true },
      });

      if (existing) {
        throw new HttpError(
          "An account already uses this email address.",
          409,
          "EMAIL_EXISTS",
        );
      }
    }

    data.email = email;
  }

  if (req.body.marketingOptIn !== undefined) {
    if (typeof req.body.marketingOptIn !== "boolean") {
      throw new HttpError("marketingOptIn must be a boolean.", 400);
    }

    // The current User model has no marketingOptIn column.
    // It is deliberately not written to the database.
  }

  if (!Object.keys(data).length && req.body.marketingOptIn === undefined) {
    throw new HttpError("No supported profile fields were supplied.", 400);
  }

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data,
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      pincode: true,
      phoneVerifiedAt: true,
      createdAt: true,
      addresses: {
        where: { isDefault: true },
        take: 1,
        select: { pincode: true },
      },
    },
  });

  const pincode = updated.addresses[0]?.pincode || updated.pincode || null;

  return success(
    res,
    {
      ...mapProfile(updated, pincode),
      marketingPreferenceSaved: false,
    },
    200,
    "Profile updated. Marketing preference is not stored by the current database schema.",
  );
});

/* =========================================================
   LIST ADDRESSES
   GET /api/v1/customer/addresses
========================================================= */

export const listAddresses = asyncHandler(async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: {
      userId: req.user.id,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return success(res, {
    addresses: addresses.map(mapCustomerAddress),
  });
});

/* =========================================================
   CREATE ADDRESS
   POST /api/v1/customer/addresses
========================================================= */

export const createAddress = asyncHandler(async (req, res) => {
  const input = validateAddressInput(req.body);

  const state = await resolveAddressState(prisma, input.city, input.pincode);

  const existingCount = await prisma.address.count({
    where: { userId: req.user.id },
  });

  const shouldDefault = input.isDefault === true || existingCount === 0;

  const address = await prisma.$transaction(async (tx) => {
    if (shouldDefault) {
      await tx.address.updateMany({
        where: {
          userId: req.user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.address.create({
      data: {
        userId: req.user.id,
        ...addressWriteData(
          {
            ...input,
            isDefault: shouldDefault,
          },
          state,
        ),
      },
    });
  });

  return success(
    res,
    { address: mapCustomerAddress(address) },
    201,
    "Address saved successfully.",
  );
});

/* =========================================================
   UPDATE ADDRESS
   PATCH /api/v1/customer/addresses/:addressId
========================================================= */

export const updateAddress = asyncHandler(async (req, res) => {
  const addressId = validateId(req.params.addressId, "address ID");

  const input = validateAddressInput(req.body, {
    partial: true,
  });

  if (!Object.keys(input).length) {
    throw new HttpError("No address fields were supplied.", 400);
  }

  const existing = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId: req.user.id,
    },
  });

  if (!existing) {
    throw new HttpError("Address not found.", 404);
  }

  const nextCity = input.city ?? existing.city;
  const nextPincode = input.pincode ?? existing.pincode;

  const state =
    input.city || input.pincode
      ? await resolveAddressState(prisma, nextCity, nextPincode)
      : existing.state;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.address.updateMany({
        where: {
          userId: req.user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.address.update({
      where: { id: addressId },
      data: addressWriteData(input, state, existing),
    });
  });

  return success(res, {
    address: mapCustomerAddress(updated),
  });
});

/* =========================================================
   DELETE ADDRESS
   DELETE /api/v1/customer/addresses/:addressId
========================================================= */

export const deleteAddress = asyncHandler(async (req, res) => {
  const addressId = validateId(req.params.addressId, "address ID");

  const existing = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId: req.user.id,
    },
    select: {
      id: true,
      isDefault: true,
    },
  });

  if (!existing) {
    throw new HttpError("Address not found.", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.address.delete({
      where: { id: addressId },
    });

    if (existing.isDefault) {
      const replacement = await tx.address.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (replacement) {
        await tx.address.update({
          where: { id: replacement.id },
          data: { isDefault: true },
        });
      }
    }
  });

  return success(res, {
    deleted: true,
    addressId,
  });
});

/* =========================================================
   SET DEFAULT ADDRESS
   PATCH /api/v1/customer/addresses/:addressId/default
========================================================= */

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const addressId = validateId(req.params.addressId, "address ID");

  const address = await prisma.address.findFirst({
    where: {
      id: addressId,
      userId: req.user.id,
    },
  });

  if (!address) {
    throw new HttpError("Address not found.", 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: {
        userId: req.user.id,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });

    return tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  });

  return success(res, {
    address: mapCustomerAddress(updated),
  });
});
