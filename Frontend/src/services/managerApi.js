import apiClient from "./apiClient.js";

function readData(response, endpoint) {
  if (
    !response ||
    response.success !== true ||
    !Object.prototype.hasOwnProperty.call(response, "data")
  ) {
    throw new Error(
      `The ${endpoint} endpoint returned an unexpected response.`,
    );
  }

  return response.data;
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();

  return query ? `?${query}` : "";
}

function toOrderStatus(value) {
  const aliases = {
    placed: "PLACED",
    accepted: "ACCEPTED",
    preparing: "PREPARING",
    ready: "READY",
    "handed off": "HANDED_OFF",
    handed_off: "HANDED_OFF",
    cancelled: "CANCELLED",
  };

  const key = String(value || "").trim().toLowerCase();

  if (aliases[key]) return aliases[key];

  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function toPaymentStatus(value) {
  const aliases = {
    pending: "PENDING",
    succeeded: "SUCCEEDED",
    success: "SUCCEEDED",
    failed: "FAILED",
    cancelled: "CANCELLED",
    refunded: "REFUNDED",
  };

  const key = String(value || "").trim().toLowerCase();

  return aliases[key] || String(value || "").trim().toUpperCase();
}

function normalizeMenuAvailabilityItem(item) {
  if (!item) return item;

  const foodItemId = item.foodItemId || item.id;
  const mapping = item.mapping || {};

  return {
    ...item,

    // This is the central FoodItem.id, not OutletMenuItem.id.
    id: foodItemId,
    foodItemId,

    image: item.image || item.imageUrl || null,

    veg:
      typeof item.veg === "boolean"
        ? item.veg
        : item.foodType === "VEG",

    prepTime: item.prepTime ?? item.prepTimeMinutes ?? null,

    mapping: {
      ...mapping,

      // Preserve the mapping identifier separately.
      id: mapping.outletMenuItemId || mapping.id,
      outletMenuItemId:
        mapping.outletMenuItemId || mapping.id,

      foodItemId,

      isAvailable: Boolean(mapping.isAvailable),

      // Top-level available includes stock and central item activity.
      available: Boolean(item.available),

      stockQuantity: Number(mapping.stockQuantity || 0),
      stockQty: Number(mapping.stockQuantity || 0),

      timeMenuLabel: mapping.timeMenuLabel || null,

      availabilityReason:
        mapping.unavailabilityReason ??
        mapping.availabilityReason ??
        null,

      restockAt:
        mapping.expectedRestockAt ??
        mapping.restockAt ??
        null,

      expectedRestockAt:
        mapping.expectedRestockAt ??
        mapping.restockAt ??
        null,
    },
  };
}

async function collectPages(fetchPage, collectionKey) {
  const collection = [];
  let firstResponse = null;
  let page = 1;

  while (true) {
    const data = await fetchPage(page);

    if (!firstResponse) {
      firstResponse = data;
    }

    collection.push(...(data[collectionKey] || []));

    if (!data.pagination?.hasNextPage) {
      break;
    }

    page += 1;
  }

  return {
    ...(firstResponse || {}),
    [collectionKey]: collection,
    pagination: firstResponse?.pagination || null,
  };
}

export const managerApi = {
  /* ======================================================
     WORKSPACE AND OVERVIEW
  ====================================================== */

  async getWorkspace() {
    const response = await apiClient.get("/manager/workspace");

    return readData(response, "manager workspace");
  },

  async getOverview(params = {}) {
    const response = await apiClient.get(
      `/manager/overview${buildQuery(params)}`,
    );

    return readData(response, "manager overview");
  },

  /* ======================================================
     KITCHEN DISPLAY
  ====================================================== */

  async getKitchenOrders(params = {}) {
    const response = await apiClient.get(
      `/manager/kitchen/orders${buildQuery({
        page: 1,
        limit: 100,
        ...params,
      })}`,
    );

    return readData(response, "manager kitchen orders");
  },

  async getAllKitchenOrders(params = {}) {
    return collectPages(
      (page) =>
        this.getKitchenOrders({
          ...params,
          page,
          limit: 100,
        }),
      "orders",
    );
  },

  async getLateOrders(params = {}) {
    const response = await apiClient.get(
      `/manager/kitchen/late-orders${buildQuery({
        page: 1,
        limit: 100,
        ...params,
      })}`,
    );

    return readData(response, "manager late orders");
  },

  async getAllLateOrders() {
    return collectPages(
      (page) =>
        this.getLateOrders({
          page,
          limit: 100,
        }),
      "orders",
    );
  },

  /* ======================================================
     ORDER REGISTER
  ====================================================== */

  async getOrders(params = {}) {
    const query = {
      page: params.page || 1,
      limit: params.limit || 20,
      sortBy: params.sortBy || "placedAt",
      sortOrder: params.sortOrder || "desc",
    };

    if (params.status && params.status !== "all") {
      query.status = toOrderStatus(params.status);
    }

    if (params.paymentStatus && params.paymentStatus !== "all") {
      query.paymentStatus = toPaymentStatus(params.paymentStatus);
    }

    if (params.paymentMethod && params.paymentMethod !== "all") {
      query.paymentMethod = String(params.paymentMethod).toUpperCase();
    }

    if (params.fulfillmentType && params.fulfillmentType !== "all") {
      query.fulfillmentType = String(
        params.fulfillmentType,
      ).toUpperCase();
    }

    if (params.scope && params.scope !== "all") {
      query.scope = params.scope;
    }

    if (params.search) {
      query.search = params.search;
    }

    /*
     * The backend requires both dates when either is supplied.
     * Do not send an incomplete range.
     */
    if (params.from && params.to) {
      query.from = params.from;
      query.to = params.to;
    }

    const response = await apiClient.get(
      `/manager/orders${buildQuery(query)}`,
    );

    return readData(response, "manager orders");
  },

  async getAllOrders(params = {}) {
    return collectPages(
      (page) =>
        this.getOrders({
          ...params,
          page,
          limit: 100,
        }),
      "orders",
    );
  },

  async getOrderDetails(orderId) {
    if (!orderId) {
      throw new Error("A database order ID is required.");
    }

    const response = await apiClient.get(
      `/manager/orders/${encodeURIComponent(orderId)}`,
    );

    const data = readData(response, "manager order details");

    return data.order;
  },

  async getOrderTimeline(orderId) {
    if (!orderId) {
      throw new Error("A database order ID is required.");
    }

    const response = await apiClient.get(
      `/manager/orders/${encodeURIComponent(orderId)}/timeline`,
    );

    return readData(response, "manager order timeline");
  },

  async updateOrderStatus(orderId, status, note) {
    if (!orderId) {
      throw new Error("A database order ID is required.");
    }

    const nextStatus = toOrderStatus(status);

    const allowedStatuses = [
      "ACCEPTED",
      "PREPARING",
      "READY",
      "HANDED_OFF",
    ];

    if (!allowedStatuses.includes(nextStatus)) {
      throw new Error("Unsupported kitchen status transition.");
    }

    const response = await apiClient.patch(
      `/manager/orders/${encodeURIComponent(orderId)}/status`,
      {
        status: nextStatus,
        ...(note ? { note } : {}),
      },
    );

    return readData(response, "manager order status update");
  },

  async overrideEta(orderId, payload = {}) {
    if (!orderId) {
      throw new Error("A database order ID is required.");
    }

    const minutes = Number(
      payload.minutes ?? payload.estimatedPrepMinutes,
    );

    const reason = String(payload.reason || "").trim();

    if (!Number.isSafeInteger(minutes)) {
      throw new Error("Preparation time must be a whole number.");
    }

    if (!reason) {
      throw new Error("A reason is required for an ETA override.");
    }

    const response = await apiClient.patch(
      `/manager/orders/${encodeURIComponent(orderId)}/eta`,
      {
        minutes,
        reason,
      },
    );

    return readData(response, "manager ETA override");
  },

  /* ======================================================
     MENU AVAILABILITY
  ====================================================== */

  async getMenuAvailability(params = {}) {
    const query = {
      page: params.page || 1,
      limit: params.limit || 20,
    };

    if (params.search) query.search = params.search;
    if (params.category) query.category = params.category;

    if (params.foodType && params.foodType !== "all") {
      query.foodType =
        params.foodType === "veg"
          ? "VEG"
          : params.foodType === "nonveg"
            ? "NON_VEG"
            : String(params.foodType).toUpperCase();
    }

    if (params.isAvailable !== undefined) {
      query.isAvailable = params.isAvailable;
    }

    const response = await apiClient.get(
      `/manager/menu-availability${buildQuery(query)}`,
    );

    const data = readData(response, "manager menu availability");

    return {
      ...data,
      menuItems: (data.menuItems || []).map(
        normalizeMenuAvailabilityItem,
      ),
    };
  },

  async getAllMenuAvailability() {
    const data = await collectPages(
      (page) =>
        this.getMenuAvailability({
          page,
          limit: 100,
        }),
      "menuItems",
    );

    return {
      ...data,
      menuItems: (data.menuItems || []).map(
        normalizeMenuAvailabilityItem,
      ),
    };
  },

  async updateAvailability(foodItemId, payload = {}) {
    if (!foodItemId) {
      throw new Error("A central FoodItem ID is required.");
    }

    const allowedKeys = [
      "isAvailable",
      "unavailabilityReason",
      "expectedRestockAt",
    ];

    const body = {};

    allowedKeys.forEach((key) => {
      if (payload[key] !== undefined) {
        body[key] = payload[key];
      }
    });

    if (typeof body.isAvailable !== "boolean") {
      throw new Error("isAvailable must be true or false.");
    }

    const response = await apiClient.patch(
      `/manager/menu-availability/${encodeURIComponent(foodItemId)}`,
      body,
    );

    const data = readData(response, "manager menu availability update");

    return {
      ...data,
      menuItem: normalizeMenuAvailabilityItem(data.menuItem),
    };
  },

  /* ======================================================
     PERFORMANCE
  ====================================================== */

  async getPerformance(range = "7d") {
    const allowedRanges = ["today", "7d", "30d"];

    if (!allowedRanges.includes(range)) {
      throw new Error("Performance range must be today, 7d, or 30d.");
    }

    const response = await apiClient.get(
      `/manager/performance${buildQuery({ range })}`,
    );

    return readData(response, "manager performance");
  },

  /* ======================================================
     MANAGER ACCOUNT
  ====================================================== */

  async getAccount() {
    const response = await apiClient.get("/manager/account");

    return readData(response, "manager account");
  },

  async updateAccount(payload) {
    const allowedKeys = ["fullName", "email", "avatarUrl"];
    const body = {};

    allowedKeys.forEach((key) => {
      if (payload[key] !== undefined) {
        body[key] = payload[key];
      }
    });

    if (!Object.keys(body).length) {
      throw new Error("Provide at least one supported profile field.");
    }

    const response = await apiClient.patch(
      "/manager/account",
      body,
    );

    return readData(response, "manager account update");
  },
};

export default managerApi;