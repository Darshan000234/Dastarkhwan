
import apiClient from "./apiClient.js";

/* =========================================================
   COMMON HELPERS
========================================================= */

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

function queryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const value = query.toString();
  return value ? `?${value}` : "";
}

function pathId(value, label = "ID") {
  if (typeof value !== "string" || !value.trim() || value.length > 150) {
    throw new Error(`${label} is required or invalid.`);
  }

  return encodeURIComponent(value.trim());
}

function getPageNumber(value) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getPageLimit(value, fallback = 100) {
  const limit = Number(value || fallback);

  if (!Number.isFinite(limit) || limit < 1) {
    return fallback;
  }

  return Math.min(Math.floor(limit), 100);
}

/* =========================================================
   STATUS AND FILTER HELPERS
========================================================= */

function normalizeOrderStatusFilter(value) {
  if (!value || value === "all") return undefined;

  return String(value).trim().toUpperCase().replace(/\s+/g, "_");
}

function normalizePaymentStatusFilter(value) {
  if (!value || value === "all") return undefined;

  return String(value).trim().toUpperCase();
}

function normalizeFoodTypeFilter(value) {
  if (!value || value === "all") return undefined;

  const normalized = String(value).trim().toLowerCase();

  if (normalized === "veg" || normalized === "vegetarian") {
    return "VEG";
  }

  if (
    normalized === "nonveg" ||
    normalized === "non-veg" ||
    normalized === "non_veg"
  ) {
    return "NON_VEG";
  }

  return String(value).trim().toUpperCase();
}

function displayAdminStatus(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* =========================================================
   OUTLET NORMALIZER
========================================================= */

function normalizeOutlet(outlet) {
  if (!outlet) return null;

  const active =
    typeof outlet.active === "boolean"
      ? outlet.active
      : Boolean(outlet.isActive);

  return {
    ...outlet,

    active,
    isActive: active,

    type:
      outlet.type ||
      (outlet.typeValue === "CLOUD_KITCHEN"
        ? "Cloud Kitchen"
        : "Restaurant"),

    city: outlet.city || outlet.cityName || "",

    primaryPincode:
      outlet.primaryPincode || outlet.pincode || "",

    address:
      outlet.address ||
      [
        outlet.addressLine1,
        outlet.addressLine2,
        outlet.locality,
      ]
        .filter(Boolean)
        .join(", "),

    radius: outlet.radius ?? outlet.deliveryRadiusKm ?? null,

    pincodes:
      outlet.pincodes ||
      outlet.deliveryPincodes ||
      (outlet.primaryPincode ? [outlet.primaryPincode] : []),

    openTime: outlet.openTime || outlet.openingTime || "",
    closeTime: outlet.closeTime || outlet.closingTime || "",

    days: outlet.days || outlet.operatingDays || [],

    prepTime: outlet.prepTime ?? outlet.minimumPrepMinutes ?? null,

    fssai: outlet.fssai || outlet.fssaiLicense || "",

    veg:
      typeof outlet.veg === "boolean"
        ? outlet.veg
        : Boolean(outlet.supportsVeg),

    nonVeg:
      typeof outlet.nonVeg === "boolean"
        ? outlet.nonVeg
        : Boolean(outlet.supportsNonVeg),

    manager: outlet.manager || null,
    menu: outlet.menu || [],
  };
}

/* =========================================================
   MENU NORMALIZERS
========================================================= */

function normalizeCatalogItem(item) {
  if (!item) return item;

  return {
    ...item,

    active: item.isActive ?? item.active ?? false,

    image: item.imageUrl || item.image || null,

    veg: item.foodType === "VEG" || item.veg === true,

    spice: item.spice || item.spiceLevel || "",

    prepTime: item.prepTime ?? item.prepTimeMinutes ?? null,

    cityPriceList: item.cityPriceList || [],
    cityPrices: item.cityPrices || {},

    outletMappings: item.outletMappings || [],

    outletIds:
      item.outletIds ||
      (item.outletMappings || []).map((mapping) => mapping.outletId),

    portions: item.portions || [],
    addons: item.addons || [],
    addonGroups: item.addonGroups || [],
    allergens: item.allergens || [],
  };
}

function normalizeMapping(mapping = {}) {
  return {
    ...mapping,

    itemId: mapping.itemId || mapping.foodItemId,

    available: mapping.available ?? mapping.isAvailable ?? false,

    timeMenu: mapping.timeMenu || mapping.timeMenuLabel || null,

    priceOverride: mapping.priceOverride ?? null,
  };
}

function normalizeMenuItem(item) {
  if (!item) return item;

  return {
    ...item,

    id: item.foodItemId || item.id,

    foodItemId: item.foodItemId || item.id,

    image: item.image || item.imageUrl || null,

    veg: item.veg ?? item.foodType === "VEG",

    spice: item.spice || item.spiceLevel || "",

    prepTime: item.prepTime ?? item.prepTimeMinutes ?? null,

    mapping: normalizeMapping(item.mapping || {}),

    portions: item.portions || [],
    addons: item.addons || [],
    allergens: item.allergens || [],
  };
}

function normalizeOutletMenuItem(item) {
  if (!item) return item;

  const mapping = item.mapping || {};

  return {
    ...item,

    id: item.itemId || item.id,
    itemId: item.itemId || item.id,

    image: item.image || item.imageUrl || null,

    mapping: {
      ...mapping,

      available: Boolean(
        mapping.available ?? mapping.isAvailable,
      ),

      isAvailable: Boolean(
        mapping.isAvailable ?? mapping.available,
      ),

      stockQty:
        mapping.stockQty ?? mapping.stockQuantity ?? 0,

      stockQuantity:
        mapping.stockQuantity ?? mapping.stockQty ?? 0,

      timeMenu:
        mapping.timeMenu ?? mapping.timeMenuLabel ?? null,

      timeMenuLabel:
        mapping.timeMenuLabel ?? mapping.timeMenu ?? null,
    },
  };
}

/* =========================================================
   ORDER NORMALIZER
========================================================= */

function normalizeAdminOrder(order) {
  if (!order) return order;

  return {
    ...order,

    id: order.orderNumber || order.id,

    orderId: order.orderId || order.id,

    customer: order.customer || order.customerName || "",

    amount: Number(
      order.amount ?? order.totalAmount ?? 0,
    ),

    status: order.statusLabel || order.status || "",

    paymentStatus:
      order.paymentStatusLabel || order.paymentStatus || "",

    placedLabel: order.placedLabel || null,

    promisedLabel: order.promisedLabel || null,

    outletName: order.outlet?.name || order.outletName || "",

    items: order.items || [],
    timeline: order.timeline || [],
  };
}

/* =========================================================
   OUTLET PAYLOAD NORMALIZER
========================================================= */

function normalizeOutletPayload(payload, { creating }) {
  const allowed = [
    "name",
    "code",
    "type",
    "city",
    "cityId",
    "address",
    "addressLine1",
    "addressLine2",
    "locality",
    "state",
    "pincode",
    "primaryPincode",
    "phone",
    "fssai",
    "fssaiLicense",
    "veg",
    "nonVeg",
    "supportsVeg",
    "supportsNonVeg",
    "latitude",
    "longitude",
    "radius",
    "deliveryRadiusKm",
    "pincodes",
    "deliveryPincodes",
    "openTime",
    "openingTime",
    "closeTime",
    "closingTime",
    "days",
    "operatingDays",
    "prepTime",
    "minimumPrepMinutes",
    "active",
    "isActive",
  ];

  const result = {};

  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload || {}, key)) {
      result[key] = payload[key];
    }
  });

  if (!creating) {
    delete result.active;
    delete result.isActive;
  }

  return result;
}

/* =========================================================
   FOOD ITEM PAYLOAD NORMALIZER
========================================================= */

function normalizeFoodItemPayload(payload = {}) {
  const {
    name,
    sku,
    slug,
    description,
    category,
    foodType,
    veg,
    spiceLevel,
    spice,
    allergens,
    basePrice,
    prepTimeMinutes,
    prepTime,
    imageUrl,
    image,
    isActive,
    active,
    portions,
    addons,
    addonGroupName,
    addonsRequired,
    defaultTimeMenu,
  } = payload;

  return {
    ...(name !== undefined ? { name } : {}),
    ...(sku !== undefined ? { sku } : {}),
    ...(slug !== undefined ? { slug } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(category !== undefined ? { category } : {}),

    ...(foodType !== undefined
      ? { foodType }
      : veg !== undefined
        ? { veg }
        : {}),

    ...(spiceLevel !== undefined
      ? { spiceLevel }
      : spice !== undefined
        ? { spice }
        : {}),

    ...(allergens !== undefined ? { allergens } : {}),
    ...(basePrice !== undefined ? { basePrice } : {}),

    ...(prepTimeMinutes !== undefined
      ? { prepTimeMinutes }
      : prepTime !== undefined
        ? { prepTime }
        : {}),

    ...(imageUrl !== undefined
      ? { imageUrl }
      : image !== undefined
        ? { image }
        : {}),

    ...(isActive !== undefined
      ? { isActive }
      : active !== undefined
        ? { active }
        : {}),

    ...(portions !== undefined ? { portions } : {}),
    ...(addons !== undefined ? { addons } : {}),
    ...(addonGroupName !== undefined ? { addonGroupName } : {}),
    ...(addonsRequired !== undefined ? { addonsRequired } : {}),
    ...(defaultTimeMenu !== undefined ? { defaultTimeMenu } : {}),
  };
}

/* =========================================================
   TIME MENU NORMALIZERS
========================================================= */

function normalizeTimeMenu(menu) {
  if (!menu) return menu;

  return {
    ...menu,

    start: menu.start || menu.startTime,
    end: menu.end || menu.endTime,

    active:
      typeof menu.active === "boolean"
        ? menu.active
        : Boolean(menu.isActive),

    isActive:
      typeof menu.isActive === "boolean"
        ? menu.isActive
        : Boolean(menu.active),

    outletIds: menu.outletIds || [],
    itemIds: menu.itemIds || [],
    days: menu.days || [],
  };
}

function normalizeTimeMenuPayload(form) {
  return {
    name: String(form.name || "").trim(),

    startTime: form.startTime || form.start,
    endTime: form.endTime || form.end,

    days: form.days || [],
    outletIds: form.outletIds || [],
    itemIds: form.itemIds || [],

    isActive:
      typeof form.isActive === "boolean"
        ? form.isActive
        : form.active !== false,
  };
}

/* =========================================================
   CENTRAL ADMIN API
   Each method is defined exactly once.
========================================================= */

const adminApi = {
  /* ======================================================
     OVERVIEW
  ====================================================== */

  async getOverview() {
    const response = await apiClient.get("/admin/overview");
    const data = readData(response, "admin overview");

    return {
      ...data,

      summary: data.summary || {},
      orders: data.orders || {},
      revenue: data.revenue || {},

      recentOrders: (data.recentOrders || []).map(
        normalizeAdminOrder,
      ),

      recentActivity: data.recentActivity || [],
    };
  },

  async getAdminOverview() {
    const [overviewResponse, outlets, orders] = await Promise.all([
      apiClient.get("/admin/overview"),
      this.getOutlets({ includeMenu: true }),
      this.getOrders(),
    ]);

    const source = readData(
      overviewResponse,
      "admin overview",
    );

    const outletAnalytics = await Promise.all(
      outlets.map(async (outlet) => {
        const analytics = await this.getOutletAnalytics(
          outlet.id,
        );

        return {
          outletId: outlet.id,
          analytics,
        };
      }),
    );

    const analyticsByOutlet = new Map(
      outletAnalytics.map((entry) => [
        entry.outletId,
        entry.analytics,
      ]),
    );

    const mappedOutlets = outlets.map((outlet) => {
      const analytics = analyticsByOutlet.get(outlet.id);

      return {
        ...outlet,

        orderCount:
          analytics?.summary?.totalOrders ??
          outlet.orderCount ??
          0,

        revenueToday: outlet.revenueToday ?? 0,

        avgPrep:
          analytics?.summary?.averagePreparationMinutes ??
          outlet.avgPrep ??
          null,

        analytics,
      };
    });

    const daily = new Map();

    outletAnalytics.forEach(({ analytics }) => {
      (analytics.dailyTrend || []).forEach((point) => {
        const key = point.date || point.label;

        const previous = daily.get(key) || {
          label: point.label || key,
          orders: 0,
          revenue: 0,
        };

        previous.orders += Number(point.orders || 0);
        previous.revenue += Number(point.revenue || 0);

        daily.set(key, previous);
      });
    });

    const orderTrend = [...daily.values()].sort((a, b) =>
      String(a.label).localeCompare(String(b.label)),
    );

    const revenueByOutlet = outletAnalytics.map(
      ({ outletId, analytics }) => {
        const outlet = mappedOutlets.find(
          (entry) => entry.id === outletId,
        );

        return {
          name: outlet?.name || "Outlet",
          value: Number(
            analytics.summary?.totalRevenue || 0,
          ),
        };
      },
    );

    const statusCounts = Object.entries(
      source.orders?.byStatus || {},
    ).map(([status, value]) => ({
      name: displayAdminStatus(status),
      value: Number(value || 0),
    }));

    const now = Date.now();

    const lateOrders = orders.filter((order) => {
      const active = [
        "PLACED",
        "ACCEPTED",
        "PREPARING",
        "READY",
      ].includes(
        String(order.status)
          .toUpperCase()
          .replaceAll(" ", "_"),
      );

      return (
        active &&
        String(order.paymentStatus).toUpperCase() ===
          "SUCCEEDED" &&
        order.promisedAt &&
        new Date(order.promisedAt).getTime() < now
      );
    });

    const paymentIssues = orders.filter((order) =>
      [
        "PENDING",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
      ].includes(
        String(order.paymentStatus).toUpperCase(),
      ),
    );

    const unavailableItems = mappedOutlets.flatMap(
      (outlet) =>
        (outlet.menu || [])
          .filter(
            (entry) =>
              !entry.mapping?.available ||
              Number(
                entry.mapping?.stockQuantity ?? 0,
              ) <= 0,
          )
          .map((item) => ({
            outlet,
            item,
          })),
    );

    const summary = source.summary || {};
    const byStatus = source.orders?.byStatus || {};

    const kpis = [
      {
        label: "Total outlets",
        value: summary.outlets?.total ?? 0,
        note: `${summary.outlets?.active ?? 0} active · ${
          summary.outlets?.inactive ?? 0
        } inactive`,
        icon: "time",
      },
      {
        label: "Orders placed",
        value: summary.orders?.total ?? 0,
        note: `${summary.orders?.today ?? 0} placed today`,
        icon: "orders",
      },
      {
        label: "Total paid revenue",
        value: source.revenue?.total ?? 0,
        note: "Successful payments · GST inclusive",
        icon: "revenue",
        format: "currency",
      },
      {
        label: "Customers",
        value: summary.customers?.total ?? 0,
        note: `${summary.managers?.total ?? 0} outlet managers`,
        icon: "customers",
      },
      {
        label: "Cancelled orders",
        value: byStatus.CANCELLED ?? 0,
        note: "Backend order status count",
        icon: "cancel",
      },
    ];

    return {
      generatedAt: source.generatedAt,
      timezone: source.timezone,

      summary,
      revenue: source.revenue,

      kpis,
      outlets: mappedOutlets,
      orders,
      orderTrend,
      statusCounts,
      revenueByOutlet,
      lateOrders,
      paymentIssues,
      unavailableItems,

      recentActivity: source.recentActivity || [],
    };
  },

  /* ======================================================
     AUDIT LOG
  ====================================================== */

  async getAuditEvents(params = {}) {
    const response = await apiClient.get(
      `/admin/audit-log${queryString({
        page: getPageNumber(params.page),
        limit: getPageLimit(params.limit, 20),

        action: params.action,
        actorId: params.actorId,
        entityType: params.entityType,
        entityId: params.entityId,
        from: params.from,
        to: params.to,
      })}`,
    );

    const data = readData(response, "admin audit log");

    return {
      logs: data.logs || [],
      pagination: data.pagination || null,
    };
  },

  async getAuditLog(params = {}) {
    const result = await this.getAuditEvents(params);
    return result.logs;
  },

  /* ======================================================
     SETTINGS
  ====================================================== */

  async getSettings() {
    const response = await apiClient.get("/admin/settings");
    const data = readData(response, "admin settings");

    return data.settings;
  },

  async updateSettings(settings) {
    const allowed = [
      "brandName",
      "defaultCity",
      "gstInclusive",
      "gstRate",
      "defaultPrepTime",
    ];

    const body = {};

    allowed.forEach((key) => {
      if (settings?.[key] !== undefined) {
        body[key] = settings[key];
      }
    });

    if (!Object.keys(body).length) {
      throw new Error(
        "Provide at least one supported setting.",
      );
    }

    const response = await apiClient.patch(
      "/admin/settings",
      body,
    );

    const data = readData(response, "update settings");

    return data.settings;
  },

  /* ======================================================
     DEMO RESET
  ====================================================== */

  async resetDemo() {
    const response = await apiClient.post(
      "/admin/demo/reset",
      {},
    );

    return readData(response, "admin demo reset");
  },

  async resetDemoData() {
    return this.resetDemo();
  },

  /* ======================================================
     ORDERS
  ====================================================== */

  async getOrders(params = {}) {
    const rows = [];

    let page = getPageNumber(params.page);
    const limit = getPageLimit(params.limit, 100);

    while (true) {
      const query = {
        page,
        limit,

        sortBy: params.sortBy || "placedAt",
        sortOrder: params.sortOrder || "desc",

        search: params.search,

        outletId:
          params.outletId && params.outletId !== "all"
            ? params.outletId
            : undefined,

        status: normalizeOrderStatusFilter(params.status),

        paymentStatus: normalizePaymentStatusFilter(
          params.paymentStatus,
        ),

        paymentMethod:
          params.paymentMethod &&
          params.paymentMethod !== "all"
            ? params.paymentMethod
            : undefined,

        fulfillmentType:
          params.fulfillmentType &&
          params.fulfillmentType !== "all"
            ? params.fulfillmentType
            : undefined,

        from: params.from,
        to: params.to,
      };

      const response = await apiClient.get(
        `/admin/orders${queryString(query)}`,
      );

      const data = readData(response, "admin orders");

      rows.push(
        ...(data.orders || []).map(normalizeAdminOrder),
      );

      if (
        params.page ||
        !data.pagination?.hasNextPage
      ) {
        break;
      }

      page += 1;
    }

    return rows;
  },

  async getOrder(orderId) {
    const response = await apiClient.get(
      `/admin/orders/${pathId(orderId, "Order ID")}`,
    );

    const data = readData(
      response,
      "admin order details",
    );

    return normalizeAdminOrder(data.order);
  },

  async getOrderDetails(orderId) {
    const response = await apiClient.get(
      `/admin/orders/${pathId(orderId, "Order ID")}`,
    );

    return readData(response, "order details");
  },

  async getOrderById(orderId) {
    const data = await this.getOrderDetails(orderId);

    return {
      ...(data.order || {}),

      customer:
        data.customer?.name || data.order?.customer,

      phone:
        data.customer?.phone || data.order?.phone,

      outletId: data.outlet?.id,
      outletName: data.outlet?.name,

      address: data.address,

      items: data.items || [],
      payments: data.payments || [],
      timeline: data.timeline || [],
      etaOverrides: data.etaOverrides || [],
      pricing: data.pricing || {},
    };
  },

  /* ======================================================
     OUTLETS
  ====================================================== */

  async getOutlets(params = {}) {
    const {
      includeMenu = false,
      ...filters
    } = params;

    const rows = [];

    let page = getPageNumber(filters.page);
    const limit = getPageLimit(filters.limit, 100);

    while (true) {
      const response = await apiClient.get(
        `/admin/outlets${queryString({
          page,
          limit,

          search: filters.search,
          cityId: filters.cityId,
          type: filters.type,
          isActive: filters.isActive,

          sortBy: filters.sortBy || "name",
          sortOrder: filters.sortOrder || "asc",
        })}`,
      );

      const data = readData(response, "admin outlets");

      rows.push(
        ...(data.outlets || []).map(normalizeOutlet),
      );

      if (
        filters.page ||
        !data.pagination?.hasNextPage
      ) {
        break;
      }

      page += 1;
    }

    if (!includeMenu) {
      return rows;
    }

    return Promise.all(
      rows.map(async (outlet) => ({
        ...outlet,
        menu: await this.getOutletMenu(outlet.id),
      })),
    );
  },

  async getAllOutlets(params = {}) {
    return this.getOutlets(params);
  },

  async getOutlet(outletId) {
    const response = await apiClient.get(
      `/admin/outlets/${pathId(outletId, "Outlet ID")}`,
    );

    const data = readData(
      response,
      "outlet details",
    );

    return normalizeOutlet(data.outlet);
  },

  async getOutletById(outletId) {
    return this.getOutlet(outletId);
  },

  async createOutlet(payload) {
    const body = normalizeOutletPayload(
      payload,
      { creating: true },
    );

    const response = await apiClient.post(
      "/admin/outlets",
      body,
    );

    const data = readData(
      response,
      "outlet creation",
    );

    return normalizeOutlet(data.outlet);
  },

  async updateOutlet(outletId, payload) {
    const id = pathId(outletId, "Outlet ID");

    const current = await this.getOutlet(outletId);

    const nextStatus =
      typeof payload?.active === "boolean"
        ? payload.active
        : typeof payload?.isActive === "boolean"
          ? payload.isActive
          : current.active;

    const body = normalizeOutletPayload(
      payload,
      { creating: false },
    );

    /*
     * Outlet activation must use the dedicated status
     * endpoint, not PATCH /admin/outlets/:outletId.
     */

    delete body.active;
    delete body.isActive;

    if (Object.keys(body).length > 0) {
      await apiClient.patch(
        `/admin/outlets/${id}`,
        body,
      );
    }

    if (nextStatus !== current.active) {
      await this.updateOutletStatus(
        outletId,
        nextStatus,
      );
    }

    return this.getOutlet(outletId);
  },

  async updateOutletStatus(outletId, isActive) {
    const id = pathId(outletId, "Outlet ID");

    if (typeof isActive !== "boolean") {
      throw new Error(
        "Outlet status must be true or false.",
      );
    }

    const response = await apiClient.patch(
      `/admin/outlets/${id}/status`,
      { isActive },
    );

    return readData(
      response,
      "outlet status update",
    );
  },

  /* ======================================================
     OUTLET ANALYTICS
  ====================================================== */

  async getOutletAnalytics(outletId, params = {}) {
    const id = pathId(outletId, "Outlet ID");

    const response = await apiClient.get(
      `/admin/outlets/${id}/analytics${queryString({
        from: params.from,
        to: params.to,
      })}`,
    );

    return readData(
      response,
      "outlet analytics",
    );
  },

  /* ======================================================
     OUTLET ORDERS
  ====================================================== */

  async getOutletOrders(outletId, params = {}) {
    const id = pathId(outletId, "Outlet ID");

    const rows = [];

    let page = getPageNumber(params.page);
    const limit = getPageLimit(params.limit, 100);

    while (true) {
      const response = await apiClient.get(
        `/admin/outlets/${id}/orders${queryString({
          page,
          limit,

          status: normalizeOrderStatusFilter(
            params.status,
          ),

          paymentStatus:
            normalizePaymentStatusFilter(
              params.paymentStatus,
            ),

          paymentMethod: params.paymentMethod,
          fulfillmentType: params.fulfillmentType,

          search: params.search,
          from: params.from,
          to: params.to,

          sortBy: params.sortBy || "placedAt",
          sortOrder: params.sortOrder || "desc",
        })}`,
      );

      const data = readData(
        response,
        "outlet orders",
      );

      rows.push(
        ...(data.orders || []).map(normalizeAdminOrder),
      );

      if (
        params.page ||
        !data.pagination?.hasNextPage
      ) {
        break;
      }

      page += 1;
    }

    return rows;
  },

  /* ======================================================
     OUTLET MENU
  ====================================================== */

  async getOutletMenu(outletId, params = {}) {
    const id = pathId(outletId, "Outlet ID");

    const rows = [];

    let page = getPageNumber(params.page);
    const limit = getPageLimit(params.limit, 100);

    while (true) {
      const response = await apiClient.get(
        `/admin/outlets/${id}/menu${queryString({
          page,
          limit,

          search: params.search,
          category: params.category,
          foodType: normalizeFoodTypeFilter(
            params.foodType,
          ),

          isAvailable: params.isAvailable,

          sortBy: params.sortBy || "name",
          sortOrder: params.sortOrder || "asc",
        })}`,
      );

      const data = readData(
        response,
        "outlet menu",
      );

      rows.push(
        ...(data.menuItems || []).map(
          normalizeOutletMenuItem,
        ),
      );

      if (
        params.page ||
        !data.pagination?.hasNextPage
      ) {
        break;
      }

      page += 1;
    }

    return rows;
  },

  /* ======================================================
     OUTLET MANAGER ASSIGNMENT
  ====================================================== */

  async sendManagerOtp({
    outletId,
    name,
    phone,
  }) {
    const id = pathId(outletId, "Outlet ID");

    const response = await apiClient.post(
      `/admin/outlets/${id}/manager/otp`,
      {
        name,
        phone,
      },
    );

    return readData(
      response,
      "manager OTP request",
    );
  },

  async verifyManagerOtpAndAssign({
    outletId,
    name,
    phone,
    otp,
  }) {
    const id = pathId(outletId, "Outlet ID");

    const response = await apiClient.post(
      `/admin/outlets/${id}/manager/verify-and-assign`,
      {
        outletId,
        name,
        phone,
        otp,
      },
    );

    return readData(
      response,
      "manager OTP verification and assignment",
    );
  },

  /* ======================================================
     CENTRAL FOOD CATALOG
  ====================================================== */

  async getMenuCatalog(params = {}) {
    const rows = [];

    let page = getPageNumber(params.page);
    const limit = getPageLimit(params.limit, 100);

    while (true) {
      const response = await apiClient.get(
        `/admin/menu/catalog${queryString({
          page,
          limit,

          search: params.search,
          category: params.category,

          foodType: normalizeFoodTypeFilter(
            params.foodType,
          ),

          spice: params.spice,
          status: params.status,
          outletId: params.outletId,
          availability: params.availability,

          sortBy: params.sortBy || "name",
          sortOrder: params.sortOrder || "asc",
        })}`,
      );

      const data = readData(
        response,
        "menu catalog",
      );

      rows.push(
        ...(data.items || []).map(
          normalizeCatalogItem,
        ),
      );

      if (
        params.page ||
        !data.pagination?.hasNextPage
      ) {
        break;
      }

      page += 1;
    }

    return rows;
  },

  async getCatalogItem(itemId) {
    const id = pathId(itemId, "Food item ID");

    const response = await apiClient.get(
      `/admin/menu/catalog/${id}`,
    );

    const data = readData(
      response,
      "catalog item",
    );

    return normalizeCatalogItem(data.item);
  },

  async createMenuItem(payload) {
    const response = await apiClient.post(
      "/admin/menu/catalog",
      normalizeFoodItemPayload(payload),
    );

    const data = readData(
      response,
      "create catalog item",
    );

    return normalizeCatalogItem(data.item);
  },

  async updateMenuItem(itemId, payload) {
    const id = pathId(itemId, "Food item ID");

    const onlyStatusField = Object.keys(
      payload || {},
    ).every((key) =>
      ["active", "isActive"].includes(key),
    );

    const asksToArchive =
      payload?.active === false ||
      payload?.isActive === false;

    if (onlyStatusField && asksToArchive) {
      return this.archiveMenuItem(itemId);
    }

    const {
      cityPrices,
      ...foodFields
    } = payload || {};

    if (
      cityPrices &&
      typeof cityPrices === "object" &&
      !Array.isArray(cityPrices)
    ) {
      const entries = Object.entries(cityPrices);

      if (!entries.length) {
        throw new Error(
          "No city prices were supplied.",
        );
      }

      await Promise.all(
        entries.map(([city, price]) =>
          this.updateCityPrice(
            itemId,
            city,
            price,
          ),
        ),
      );

      if (Object.keys(foodFields).length === 0) {
        return this.getCatalogItem(itemId);
      }
    }

    const response = await apiClient.patch(
      `/admin/menu/catalog/${id}`,
      normalizeFoodItemPayload(foodFields),
    );

    const data = readData(
      response,
      "update catalog item",
    );

    return normalizeCatalogItem(data.item);
  },

  async archiveMenuItem(itemId) {
    const id = pathId(itemId, "Food item ID");

    const response = await apiClient.delete(
      `/admin/menu/catalog/${id}`,
    );

    return readData(
      response,
      "archive catalog item",
    );
  },

  async updateCityPrice(itemId, city, price) {
    const id = pathId(itemId, "Food item ID");

    if (!String(city || "").trim()) {
      throw new Error(
        "A city name or city ID is required.",
      );
    }

    const response = await apiClient.patch(
      `/admin/menu/catalog/${id}/city-prices/${encodeURIComponent(
        String(city).trim(),
      )}`,
      { price },
    );

    return readData(
      response,
      "update city price",
    );
  },

  /* ======================================================
     OUTLET MENU MAPPINGS
  ====================================================== */

  async assignMenuItemToOutlet({
    itemId,
    outletIds,
    available,
    isAvailable,
    stockQty,
    stockQuantity,
    priceOverride,
    timeMenu,
    timeMenuLabel,
    unavailabilityReason,
    expectedRestockAt,
  }) {
    const id = pathId(itemId, "Food item ID");

    const body = { outletIds };

    const availability =
      isAvailable !== undefined
        ? isAvailable
        : available;

    const stock =
      stockQuantity !== undefined
        ? stockQuantity
        : stockQty;

    const label =
      timeMenuLabel !== undefined
        ? timeMenuLabel
        : timeMenu;

    if (availability !== undefined) {
      body.isAvailable = availability;
    }

    if (stock !== undefined) {
      body.stockQuantity = stock;
    }

    if (priceOverride !== undefined) {
      body.priceOverride = priceOverride;
    }

    if (label !== undefined) {
      body.timeMenuLabel = label;
    }

    if (unavailabilityReason !== undefined) {
      body.unavailabilityReason = unavailabilityReason;
    }

    if (expectedRestockAt !== undefined) {
      body.expectedRestockAt = expectedRestockAt;
    }

    const response = await apiClient.post(
      `/admin/menu/catalog/${id}/outlets`,
      body,
    );

    return readData(
      response,
      "assign catalog item to outlets",
    );
  },

  async updateOutletMenuItem({
    outletId,
    itemId,
    available,
    isAvailable,
    stockQty,
    stockQuantity,
    priceOverride,
    timeMenu,
    timeMenuLabel,
    unavailabilityReason,
    expectedRestockAt,
  }) {
    const foodItemId = pathId(
      itemId,
      "Food item ID",
    );

    const outlet = pathId(
      outletId,
      "Outlet ID",
    );

    const body = {};

    const availability =
      isAvailable !== undefined
        ? isAvailable
        : available;

    const stock =
      stockQuantity !== undefined
        ? stockQuantity
        : stockQty;

    const label =
      timeMenuLabel !== undefined
        ? timeMenuLabel
        : timeMenu;

    if (availability !== undefined) {
      body.isAvailable = availability;
    }

    if (stock !== undefined) {
      body.stockQuantity = stock;
    }

    if (priceOverride !== undefined) {
      body.priceOverride = priceOverride;
    }

    if (label !== undefined) {
      body.timeMenuLabel = label;
    }

    if (unavailabilityReason !== undefined) {
      body.unavailabilityReason = unavailabilityReason;
    }

    if (expectedRestockAt !== undefined) {
      body.expectedRestockAt = expectedRestockAt;
    }

    const response = await apiClient.patch(
      `/admin/menu/catalog/${foodItemId}/outlets/${outlet}`,
      body,
    );

    return readData(
      response,
      "update outlet menu mapping",
    );
  },

  async removeMenuItemFromOutlet({
    outletId,
    itemId,
  }) {
    const foodItemId = pathId(
      itemId,
      "Food item ID",
    );

    const outlet = pathId(
      outletId,
      "Outlet ID",
    );

    const response = await apiClient.delete(
      `/admin/menu/catalog/${foodItemId}/outlets/${outlet}`,
    );

    return readData(
      response,
      "remove outlet menu mapping",
    );
  },

  /* ======================================================
     TIME MENUS
  ====================================================== */

  async getTimeMenus(params = {}) {
    const rows = [];

    let page = getPageNumber(params.page);
    const limit = getPageLimit(params.limit, 100);

    while (true) {
      const response = await apiClient.get(
        `/admin/menu/time-menus${queryString({
          page,
          limit,

          search: params.search,
          status: params.status,
          outletId: params.outletId,
        })}`,
      );

      const data = readData(
        response,
        "time menus",
      );

      rows.push(
        ...(data.timeMenus || []).map(
          normalizeTimeMenu,
        ),
      );

      if (
        params.page ||
        !data.pagination?.hasNextPage
      ) {
        break;
      }

      page += 1;
    }

    return rows;
  },

  async saveTimeMenu(form) {
    const body = normalizeTimeMenuPayload(form);

    const response = form.id
      ? await apiClient.patch(
          `/admin/menu/time-menus/${pathId(
            form.id,
            "Time menu ID",
          )}`,
          body,
        )
      : await apiClient.post(
          "/admin/menu/time-menus",
          body,
        );

    const data = readData(
      response,
      "save time menu",
    );

    return normalizeTimeMenu(data.timeMenu);
  },

  async deleteTimeMenu(timeMenuId) {
    const id = pathId(
      timeMenuId,
      "Time menu ID",
    );

    const response = await apiClient.delete(
      `/admin/menu/time-menus/${id}`,
    );

    return readData(
      response,
      "delete time menu",
    );
  },
};

export { adminApi };
export default adminApi;
