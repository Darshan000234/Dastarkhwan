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

function normalizeMenuItem(item) {
  if (!item) return item;

  const available = Boolean(
    item.available ?? item.mapping?.available,
  );

  return {
    ...item,

    veg:
      typeof item.veg === "boolean"
        ? item.veg
        : item.foodType === "VEG",

    spice: item.spice ?? item.spiceLevel ?? null,

    portions: (item.portions || []).map((portion) => ({
      ...portion,
      price: Number(portion.price || 0),
    })),

    addons: (item.addons || []).map((addon) => ({
      ...addon,
      price: Number(addon.price || 0),
    })),

    addonGroups: (item.addonGroups || []).map((group) => ({
      ...group,
      options: (group.options || []).map((option) => ({
        ...option,
        price: Number(option.price || 0),
      })),
    })),

    effectivePrice: Number(item.effectivePrice || 0),

    mapping: {
      ...(item.mapping || {}),
      available,
    },

    available,
  };
}

/*
 * The backend cart validator accepts itemId, outletId,
 * quantity, portionId, portion, addons and specialNote.
 *
 * Never send a frontend-calculated price as an authoritative
 * value. The backend recalculates all prices.
 */
export function toCustomerCartItems(lines = []) {
  return lines.map((line) => ({
    itemId: line.itemId,
    outletId: line.outletId,
    quantity: Number(line.quantity),
    ...(line.portionId
      ? { portionId: line.portionId }
      : {}),
    ...(line.portion
      ? { portion: line.portion }
      : {}),
    addons: (line.addons || []).map((addon) => ({
      id: addon.id,
      name: addon.name,
    })),
    ...(line.specialNote || line.instructions
      ? {
          specialNote:
            line.specialNote || line.instructions,
        }
      : {}),
  }));
}

export const customerApi = {
  /* ======================================================
     PUBLIC SERVICEABILITY
  ====================================================== */

  async getServiceability(pincode) {
    const response = await apiClient.get(
      `/customer/serviceability/${encodeURIComponent(pincode)}`,
    );

    return readData(response, "customer serviceability");
  },

  /* ======================================================
     PUBLIC MENU
  ====================================================== */

  async getMenu(params = {}) {
    const response = await apiClient.get(
      `/customer/menu${buildQuery(params)}`,
    );

    const data = readData(response, "customer menu");

    return {
      ...data,
      items: (data.items || []).map(normalizeMenuItem),
    };
  },

  async getCategories(params = {}) {
    const response = await apiClient.get(
      `/customer/menu/categories${buildQuery(params)}`,
    );

    return readData(response, "customer menu categories");
  },

  async getPopularItems(params = {}) {
    const response = await apiClient.get(
      `/customer/menu/popular${buildQuery(params)}`,
    );

    const data = readData(response, "customer popular items");

    return {
      ...data,
      items: (data.items || []).map(normalizeMenuItem),
    };
  },

  async getMenuItem(itemId, params = {}) {
    const response = await apiClient.get(
      `/customer/menu/${encodeURIComponent(itemId)}${buildQuery(params)}`,
    );

    const data = readData(response, "customer menu item");

    return {
      ...data,
      item: normalizeMenuItem(data.item),
    };
  },

  /* ======================================================
     CUSTOMER BOOTSTRAP AND PROFILE
  ====================================================== */

  async getBootstrap() {
    const response = await apiClient.get("/customer/bootstrap");

    return readData(response, "customer bootstrap");
  },

  async getProfile() {
    const response = await apiClient.get("/customer/profile");

    return readData(response, "customer profile");
  },

  async updateProfile(payload) {
    const response = await apiClient.patch(
      "/customer/profile",
      payload,
    );

    return readData(response, "customer profile update");
  },

  /* ======================================================
     CUSTOMER ADDRESSES
  ====================================================== */

  async getAddresses() {
    const response = await apiClient.get("/customer/addresses");

    return readData(response, "customer addresses");
  },

  async createAddress(payload) {
    const response = await apiClient.post(
      "/customer/addresses",
      payload,
    );

    const data = readData(response, "create customer address");

    return data.address;
  },

  async updateAddress(addressId, payload) {
    const response = await apiClient.patch(
      `/customer/addresses/${encodeURIComponent(addressId)}`,
      payload,
    );

    const data = readData(response, "update customer address");

    return data.address;
  },

  async deleteAddress(addressId) {
    const response = await apiClient.delete(
      `/customer/addresses/${encodeURIComponent(addressId)}`,
    );

    return readData(response, "delete customer address");
  },

  async setDefaultAddress(addressId) {
    const response = await apiClient.patch(
      `/customer/addresses/${encodeURIComponent(addressId)}/default`,
      {},
    );

    const data = readData(response, "set default address");

    return data.address;
  },

  /* ======================================================
     CART VALIDATION AND AUTHORITATIVE QUOTE
  ====================================================== */

  async validateCart(payload) {
    const response = await apiClient.post(
      "/customer/cart/validate",
      {
        ...payload,
        items: toCustomerCartItems(payload.items || payload.cart),
      },
    );

    return readData(response, "cart validation");
  },

  async quoteCart(payload) {
    const response = await apiClient.post(
      "/customer/cart/quote",
      {
        ...payload,
        items: toCustomerCartItems(payload.items || payload.cart),
      },
    );

    return readData(response, "cart quote");
  },

  /* ======================================================
     MOCK PAYMENT
  ====================================================== */

  async createMockPaymentIntent(payload, idempotencyKey) {
    const response = await apiClient.post(
      "/customer/payments/mock-intent",
      payload,
      {
        headers: idempotencyKey
          ? {
              "Idempotency-Key": idempotencyKey,
            }
          : {},
      },
    );

    return readData(response, "mock payment intent");
  },

  async confirmMockPayment(payload) {
    const response = await apiClient.post(
      "/customer/payments/mock-confirm",
      payload,
    );

    return readData(response, "mock payment confirmation");
  },

  async createOrder(payload) {
    const response = await apiClient.post(
      "/customer/orders",
      payload,
    );

    const data = readData(response, "customer order finalisation");

    return data.order;
  },

  /* ======================================================
     CUSTOMER ORDERS
  ====================================================== */

  async getOrders(params = {}) {
    const response = await apiClient.get(
      `/customer/orders${buildQuery(params)}`,
    );

    return readData(response, "customer orders");
  },

  async getOrder(orderId) {
    const response = await apiClient.get(
      `/customer/orders/${encodeURIComponent(orderId)}`,
    );

    const data = readData(response, "customer order details");

    return data.order;
  },

  async getOrderTracking(orderId) {
    const response = await apiClient.get(
      `/customer/orders/${encodeURIComponent(orderId)}/tracking`,
    );

    return readData(response, "customer order tracking");
  },

  async getOrderTimeline(orderId) {
    const response = await apiClient.get(
      `/customer/orders/${encodeURIComponent(orderId)}/timeline`,
    );

    return readData(response, "customer order timeline");
  },

  async reorder(orderId, payload = {}) {
    const response = await apiClient.post(
      `/customer/orders/${encodeURIComponent(orderId)}/reorder`,
      payload,
    );

    return readData(response, "customer reorder");
  },

  /* ======================================================
     REWARDS
  ====================================================== */

  async getRewards() {
    const response = await apiClient.get("/customer/rewards");

    return readData(response, "customer rewards");
  },

  async getRewardTransactions(params = {}) {
    const response = await apiClient.get(
      `/customer/rewards/transactions${buildQuery(params)}`,
    );

    return readData(response, "customer reward transactions");
  },

  async redeemPoints(payload) {
    const response = await apiClient.post(
      "/customer/rewards/redeem",
      payload,
    );

    return readData(response, "customer reward redemption preview");
  },

  /* ======================================================
     CATERING
  ====================================================== */

  async createCateringEnquiry(payload) {
    const response = await apiClient.post(
      "/customer/catering/enquiries",
      payload,
    );

    return readData(response, "create catering enquiry");
  },

  async getCateringEnquiries(params = {}) {
    const response = await apiClient.get(
      `/customer/catering/enquiries${buildQuery(params)}`,
    );

    return readData(response, "customer catering enquiries");
  },
};

export default customerApi;