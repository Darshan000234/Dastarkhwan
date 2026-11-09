import { adminApi } from "./adminApi";
import {
  CUSTOMER_STORAGE_KEY,
  seedAddresses,
  seedCateringConfig,
  seedCoupons,
  seedCustomerProfile,
  seedLoyalty,
} from "../data/customerDemo";
import { calculateCartTotals, getPortionPrice } from "../utils/customerPricing";
import { checkServiceability, getEligibleOutlets } from "./mockLocationService";

const clone = (value) => JSON.parse(JSON.stringify(value));
const wait = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms));

function freshCustomerState() {
  return {
    profile: clone(seedCustomerProfile),
    addresses: clone(seedAddresses),
    selectedAddressId: "addr-home",
    selectedPincode: "500084",
    selectedOutletId: "out-kondapur",
    cart: [],
    couponCode: null,
    checkoutDraft: null,
    loyaltyRedeemPoints: 0,
    loyalty: clone(seedLoyalty),
    cateringEnquiries: [],
    lastPayment: null,
  };
}

function loadCustomerState() {
  try {
    const stored = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    return stored
      ? { ...freshCustomerState(), ...JSON.parse(stored) }
      : freshCustomerState();
  } catch {
    return freshCustomerState();
  }
}

let customerState = loadCustomerState();
const paymentReferencesInProgress = new Set();
function saveCustomerState() {
  try {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customerState));
  } catch {
    /* demo continues in memory */
  }
}
const timestampId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

async function getOutletMenu(outletId, filters = {}) {
  if (!outletId) return [];
  const [outlet, rows, timeMenus] = await Promise.all([
    adminApi.getOutletById(outletId),
    adminApi.getOutletMenu(outletId),
    adminApi.getTimeMenus(),
  ]);
  if (!outlet || !outlet.active) return [];
  const now = new Date();
  const day = now.toLocaleDateString("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  });
  const clock = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  let menu = rows
    .filter((item) => item.active)
    .map((item) => {
      const stockQty = Number(item.mapping?.stockQty ?? 30);
      const inStock = Number.isFinite(stockQty) && stockQty > 0;
      if (item.mapping?.timeMenu && item.mapping.timeMenu !== "All Day") {
        const schedules = (timeMenus || []).filter(
          (entry) =>
            entry.name === item.mapping.timeMenu &&
            entry.outletIds?.includes(outletId) &&
            entry.itemIds?.includes(item.id),
        );
        const activeSchedule = schedules.find(
          (entry) =>
            entry.active &&
            entry.days?.includes(day) &&
            clock >= entry.start &&
            clock < entry.end,
        );
        const displaySchedule =
          schedules.find((entry) => entry.active) || schedules[0];
        const windowLabel = displaySchedule
          ? `${displaySchedule.start}–${displaySchedule.end} IST`
          : "a currently configured service window";
        const timeAvailable = Boolean(activeSchedule);
        const available = Boolean(
          item.mapping.available && timeAvailable && inStock,
        );
        const availabilityReason = !inStock
          ? "Currently sold out"
          : !timeAvailable
            ? `Available during ${windowLabel}`
            : "";
        return {
          ...item,
          mapping: { ...item.mapping, available },
          availabilityReason,
        };
      }
      if (!inStock)
        return {
          ...item,
          mapping: { ...item.mapping, available: false },
          availabilityReason: "Currently sold out",
        };
      return item;
    });
  if (filters.category && filters.category !== "All")
    menu = menu.filter((item) => item.category === filters.category);
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    menu = menu.filter((item) =>
      `${item.name} ${item.description} ${item.category}`
        .toLowerCase()
        .includes(q),
    );
  }
  if (filters.foodType === "veg") menu = menu.filter((item) => item.veg);
  if (filters.foodType === "nonveg") menu = menu.filter((item) => !item.veg);
  return menu;
}

async function validateCart(cart, outletId) {
  const errors = [];
  if (!Array.isArray(cart) || cart.length === 0)
    return { valid: false, errors: ["Your cart is empty."], validLines: [] };
  const outlet = await adminApi.getOutletById(outletId);
  if (!outlet || !outlet.active)
    return {
      valid: false,
      errors: ["The selected outlet is not currently accepting orders."],
      validLines: [],
    };
  const mapped = new Map(
    (await getOutletMenu(outletId)).map((item) => [item.id, item]),
  );
  const validLines = [];
  const requestedByItem = new Map();
  const stockByItem = new Map();
  for (const line of Array.isArray(cart) ? cart : []) {
    if (line.outletId !== outletId) {
      errors.push(`${line.name} belongs to a different outlet.`);
      continue;
    }
    const item = mapped.get(line.itemId);
    if (!item) {
      errors.push(`${line.name} is no longer assigned to this outlet.`);
      continue;
    }
    if (!item.mapping?.available) {
      errors.push(`${line.name} is currently unavailable.`);
      continue;
    }
    const quantity = Number(line.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      errors.push(`${line.name}: quantity must be a positive whole number.`);
      continue;
    }
    const portion = (item.portions || []).find(
      (entry) => entry.name === line.portion,
    );
    if (!portion) {
      errors.push(`${line.name}: the selected portion is no longer available.`);
      continue;
    }
    if (item.addonsRequired && !(line.addons || []).length) {
      errors.push(`${line.name}: choose at least one required extra.`);
      continue;
    }
    const currentAddonNames = new Set(
      (item.addons || []).map((addon) => addon.name),
    );
    if (
      (line.addons || []).some((addon) => !currentAddonNames.has(addon.name))
    ) {
      errors.push(
        `${line.name}: one or more selected extras are no longer available.`,
      );
      continue;
    }
    const stockQty = Number(item.mapping.stockQty ?? 30);
    requestedByItem.set(
      item.id,
      (requestedByItem.get(item.id) || 0) + quantity,
    );
    stockByItem.set(item.id, stockQty);
    const currentPrice =
      getPortionPrice(item, portion, item.effectivePrice) +
      (line.addons || []).reduce(
        (sum, addon) =>
          sum +
          Number(
            (item.addons || []).find((entry) => entry.name === addon.name)
              ?.price || 0,
          ),
        0,
      );
    validLines.push({
      ...line,
      quantity,
      unitPrice: currentPrice,
      image: item.image,
      name: item.name,
    });
  }
  for (const [itemId, quantity] of requestedByItem) {
    const stockQty = stockByItem.get(itemId);
    if (quantity > stockQty) {
      const itemName = mapped.get(itemId)?.name || itemId;
      errors.push(
        `Only ${stockQty} ${stockQty === 1 ? "unit is" : "units are"} left for ${itemName}. Reduce the cart quantity.`,
      );
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    validLines: errors.length ? [] : validLines,
  };
}

function getOrderDiscount(code, cart, subtotal, existingOrderCount, outletId) {
  const coupon = seedCoupons.find(
    (entry) =>
      entry.code ===
      String(code || "")
        .trim()
        .toUpperCase(),
  );
  if (!coupon || !coupon.active)
    throw new Error("That coupon code is not valid.");
  if (subtotal < coupon.minOrder)
    throw new Error(
      `Add ${formatRupees(coupon.minOrder - subtotal)} more to use ${coupon.code}.`,
    );
  if (coupon.firstOrderOnly && existingOrderCount > 0)
    throw new Error("This coupon is only valid on your first order.");
  if (coupon.outletIds?.length && !coupon.outletIds.includes(outletId))
    throw new Error("This coupon is not available at the selected outlet.");
  if (
    coupon.category &&
    !cart.some((line) => line.category === coupon.category)
  )
    throw new Error("Add an eligible biryani item to use this coupon.");
  const raw =
    coupon.type === "percent" ? (subtotal * coupon.value) / 100 : coupon.value;
  return { coupon, discount: Math.min(raw, coupon.maxDiscount ?? raw) };
}
const formatRupees = (value) => `₹${Math.ceil(value)}`;

export const mockCustomerApi = {
  async getBootstrap() {
    await wait();
    try {
      const rawSession = sessionStorage.getItem("demo_auth_session");
      const session = rawSession ? JSON.parse(rawSession) : null;
      if (session?.role === "customer" && session.phone) {
        const changedAccount = session.phone !== customerState.profile.phone;
        customerState.profile = {
          id: `customer-${session.phone}`,
          name: session.name || "Dastarkhwan Customer",
          phone: session.phone,
          email: session.email || "",
          marketingOptIn: false,
          verifiedPhone: true,
        };
        if (changedAccount) {
          customerState.addresses = [];
          customerState.selectedAddressId = null;
          customerState.selectedPincode = "";
          customerState.selectedOutletId = "";
          customerState.cart = [];
          customerState.couponCode = null;
          customerState.loyalty = {
            balance: 0,
            transactions: [],
            awardedOrderIds: [],
          };
          customerState.loyaltyRedeemPoints = 0;
        }
        if (session.pincode && /^\d{6}$/.test(session.pincode))
          customerState.profile.pincode = session.pincode;
        saveCustomerState();
      }
    } catch {
      /* demo can run without session storage */
    }
    const [outlets, catalog, orders, settings] = await Promise.all([
      adminApi.getOutlets(),
      adminApi.getMenuCatalog(),
      adminApi.getOrders(),
      adminApi.getSettings(),
    ]);
    return clone({
      ...customerState,
      outlets,
      catalog,
      orders: orders.filter(
        (order) =>
          order.phone === customerState.profile.phone ||
          order.customerId === customerState.profile.id,
      ),
      settings,
      coupons: seedCoupons,
      cateringConfig: seedCateringConfig,
    });
  },
  checkServiceability,
  getEligibleOutlets,
  getOutletMenu,
  async getFoodCategories(outletId) {
    const rows = await getOutletMenu(outletId);
    return [
      "All",
      ...Array.from(new Set(rows.map((item) => item.category))).sort(),
    ];
  },
  async getPopularItems(outletId) {
    const rows = await getOutletMenu(outletId);
    const ids = [
      "chicken-biryani",
      "mutton-biryani",
      "veg-biryani",
      "haleem",
      "chicken-65",
      "double-meetha",
    ];
    return ids
      .map((id) => rows.find((row) => row.id === id))
      .filter(Boolean)
      .slice(0, 4);
  },
  async getMenuItemById(itemId, outletId) {
    return (
      (await getOutletMenu(outletId)).find((item) => item.id === itemId) || null
    );
  },
  async saveCustomerState(patch) {
    await wait(50);
    customerState = { ...customerState, ...clone(patch) };
    saveCustomerState();
    return clone(customerState);
  },
  async updateProfile(patch) {
    await wait(90);
    if (patch.phone && patch.phone !== customerState.profile.phone)
      throw new Error(
        "Your verified mobile number cannot be changed in this demo. A verification flow is required.",
      );
    customerState.profile = { ...customerState.profile, ...clone(patch) };
    saveCustomerState();
    return clone(customerState.profile);
  },
  async addAddress(payload) {
    await wait(80);
    if (!/^\d{6}$/.test(String(payload.pincode || "")))
      throw new Error("Enter a valid six-digit pincode.");
    const shouldDefault =
      Boolean(payload.isDefault) || customerState.addresses.length === 0;
    const address = {
      ...clone(payload),
      id: timestampId("addr"),
      isDefault: shouldDefault,
    };
    if (shouldDefault)
      customerState.addresses = customerState.addresses.map((entry) => ({
        ...entry,
        isDefault: false,
      }));
    customerState.addresses = [...customerState.addresses, address];
    customerState.selectedAddressId = address.id;
    saveCustomerState();
    return clone(address);
  },
  async updateAddress(id, payload) {
    await wait(70);
    if (!customerState.addresses.some((address) => address.id === id))
      throw new Error("Address not found.");
    if (payload.isDefault) {
      customerState.addresses = customerState.addresses.map((address) => ({
        ...address,
        isDefault: address.id === id,
      }));
      customerState.selectedAddressId = id;
    }
    customerState.addresses = customerState.addresses.map((address) =>
      address.id === id ? { ...address, ...clone(payload) } : address,
    );
    if (
      !customerState.addresses.some((address) => address.isDefault) &&
      customerState.addresses.length
    )
      customerState.addresses[0].isDefault = true;
    saveCustomerState();
    return clone(customerState.addresses.find((address) => address.id === id));
  },
  async deleteAddress(id) {
    await wait(70);
    if (customerState.addresses.length <= 1)
      throw new Error("Keep at least one saved address.");
    customerState.addresses = customerState.addresses.filter(
      (address) => address.id !== id,
    );
    if (customerState.selectedAddressId === id)
      customerState.selectedAddressId = customerState.addresses[0]?.id || null;
    if (!customerState.addresses.some((address) => address.isDefault))
      customerState.addresses[0].isDefault = true;
    saveCustomerState();
  },
  async setDefaultAddress(id) {
    customerState.addresses = customerState.addresses.map((address) => ({
      ...address,
      isDefault: address.id === id,
    }));
    customerState.selectedAddressId = id;
    saveCustomerState();
  },
  async applyCoupon(code, cart, outletId) {
    const validated = await validateCart(cart, outletId);
    if (!validated.valid) throw new Error(validated.errors.join(" "));
    const subtotal = validated.validLines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );
    const [orders] = await Promise.all([adminApi.getOrders()]);
    const customerOrders = orders.filter(
      (order) =>
        (order.phone === customerState.profile.phone ||
          order.customerId === customerState.profile.id) &&
        order.paymentStatus === "Succeeded",
    );
    return getOrderDiscount(
      code,
      validated.validLines,
      subtotal,
      customerOrders.length,
      outletId,
    );
  },
  async validateCart(cart, outletId) {
    return validateCart(cart, outletId);
  },
  async calculateCartTotal(cart, couponCode, loyaltyPoints, outletId) {
    const validated = await validateCart(cart, outletId);
    if (!validated.valid)
      return {
        ...calculateCartTotals(validated.validLines),
        valid: false,
        errors: validated.errors,
      };
    const subtotal = validated.validLines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );
    let couponDiscount = 0;
    if (couponCode)
      couponDiscount = (
        await this.applyCoupon(couponCode, validated.validLines, outletId)
      ).discount;
    const remainingAfterCoupon = Math.max(0, subtotal - couponDiscount);
    const maxPointsBySubtotal = Math.floor((subtotal * 0.25) / 10) * 100;
    const maxPointsByRemainingBalance =
      Math.floor(remainingAfterCoupon / 10) * 100;
    const requestedPoints = Number(loyaltyPoints || 0);
    const safeRequestedPoints = Number.isFinite(requestedPoints)
      ? Math.max(0, requestedPoints)
      : 0;
    const redemption =
      Math.floor(
        Math.min(
          safeRequestedPoints,
          customerState.loyalty.balance,
          maxPointsBySubtotal,
          maxPointsByRemainingBalance,
        ) / 100,
      ) * 100;
    const loyaltyDiscount = (redemption / 100) * 10;
    return {
      ...calculateCartTotals(
        validated.validLines,
        couponDiscount,
        loyaltyDiscount,
      ),
      valid: true,
      errors: [],
      couponCode: couponCode || null,
      loyaltyPoints: redemption,
    };
  },
  async createMockPayment({ method, outcome, amount }) {
    if (!["upi", "card"].includes(method))
      throw new Error("Choose UPI or card for the demo payment.");
    if (!Number.isFinite(Number(amount)) || Number(amount) < 0)
      throw new Error("The payment amount is invalid.");
    if (!["success", "failed", "cancelled"].includes(outcome))
      throw new Error("Choose a valid demo payment outcome.");
    const reference = timestampId("PAY").toUpperCase();
    customerState.lastPayment = {
      reference,
      method,
      status: "PENDING",
      amount: Number(amount || 0),
      createdAt: new Date().toISOString(),
    };
    saveCustomerState();
    await wait(700);
    const status =
      outcome === "failed"
        ? "FAILED"
        : outcome === "cancelled"
          ? "CANCELLED"
          : "SUCCEEDED";
    customerState.lastPayment = {
      ...customerState.lastPayment,
      status,
      completedAt: new Date().toISOString(),
    };
    saveCustomerState();
    return clone(customerState.lastPayment);
  },
  async createOrder(payload) {
    if (payload.paymentStatus !== "SUCCEEDED")
      throw new Error("Only a successful mock payment can create an order.");
    const payment = customerState.lastPayment;
    if (
      !payment ||
      payment.status !== "SUCCEEDED" ||
      payment.reference !== payload.paymentReference
    )
      throw new Error(
        "A matching successful mock payment reference is required.",
      );
    if (
      payment.consumedAt ||
      paymentReferencesInProgress.has(payment.reference)
    )
      throw new Error(
        "This successful payment has already been used for an order.",
      );
    if (payment.method !== payload.paymentMethod)
      throw new Error(
        "The payment method does not match the successful demo transaction.",
      );
    paymentReferencesInProgress.add(payment.reference);
    try {
      const validation = await validateCart(payload.cart, payload.outletId);
      if (!validation.valid) throw new Error(validation.errors.join(" "));
      const totals = await this.calculateCartTotal(
        validation.validLines,
        payload.couponCode,
        payload.loyaltyPoints,
        payload.outletId,
      );
      if (!totals.valid)
        throw new Error(
          totals.errors?.join(" ") || "Your cart is no longer valid.",
        );
      if (Math.abs(Number(payment.amount) - Number(totals.total)) > 0.001)
        throw new Error(
          "The payment amount no longer matches the current order total. Return to checkout and retry.",
        );
      const order = await adminApi.createCustomerOrder({
        outletId: payload.outletId,
        customer: customerState.profile,
        address: payload.address,
        items: validation.validLines.map((line) => ({
          ...line,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
        })),
        amount: totals.total,
        subtotal: totals.subtotal,
        deliveryFee: totals.deliveryFee,
        paymentMethod: payload.paymentMethod,
        paymentReference: payload.paymentReference,
        couponCode: payload.couponCode,
        couponDiscount: totals.couponDiscount,
        loyaltyDiscount: totals.loyaltyDiscount,
        prepMinutes: payload.prepMinutes,
        instructions: payload.instructions,
      });
      customerState.lastPayment = {
        ...payment,
        consumedAt: new Date().toISOString(),
        orderId: order.id,
      };
      customerState.cart = [];
      customerState.couponCode = null;
      customerState.loyaltyRedeemPoints = 0;
      customerState.checkoutDraft = null;
      if (totals.loyaltyPoints) {
        customerState.loyalty.balance = Math.max(
          0,
          customerState.loyalty.balance - totals.loyaltyPoints,
        );
        customerState.loyalty.transactions.unshift({
          id: timestampId("lp"),
          type: "redeemed",
          points: -totals.loyaltyPoints,
          note: `Redeemed on order ${order.id}`,
          at: new Date().toISOString(),
        });
      }
      saveCustomerState();
      return clone({
        ...order,
        paymentStatus: "Succeeded",
        customerId: customerState.profile.id,
      });
    } finally {
      paymentReferencesInProgress.delete(payment.reference);
    }
  },
  async getCustomerOrders() {
    const orders = await adminApi.getOrders();
    return orders
      .filter(
        (order) =>
          order.phone === customerState.profile.phone ||
          order.customerId === customerState.profile.id,
      )
      .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  },
  async getOrderById(orderId) {
    return adminApi.getCustomerOrder(orderId);
  },
  async simulateNextStatus(orderId) {
    const order = await adminApi.getCustomerOrder(orderId);
    if (!order) throw new Error("Order not found.");
    const next = {
      Placed: "ACCEPTED",
      Accepted: "PREPARING",
      Preparing: "READY",
      Ready: "HANDED_OFF",
    }[order.status];
    if (!next) return order;
    const updated = await adminApi.updateCustomerOrderStatus(orderId, next);
    if (
      next === "HANDED_OFF" &&
      !customerState.loyalty.awardedOrderIds.includes(orderId)
    ) {
      const points = Math.floor(Number(order.amount || 0) / 100);
      customerState.loyalty.balance += points;
      customerState.loyalty.awardedOrderIds.push(orderId);
      customerState.loyalty.transactions.unshift({
        id: timestampId("lp"),
        type: "earned",
        points,
        note: `Completed order ${orderId}`,
        at: new Date().toISOString(),
      });
      saveCustomerState();
    }
    return updated;
  },
  async reorder(orderId, currentOutletId) {
    const order = await adminApi.getCustomerOrder(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.outletId !== currentOutletId)
      throw new Error(
        "This order belongs to another outlet. Change your delivery location first.",
      );
    const menu = await getOutletMenu(currentOutletId);
    const validLines = [];
    const unavailable = [];
    const requestedByItem = new Map();
    for (const oldLine of order.items || []) {
      const item =
        menu.find((row) => row.id === oldLine.itemId) ||
        menu.find((row) => row.name === oldLine.name);
      if (!item || !item.mapping.available) {
        unavailable.push(oldLine.name);
        continue;
      }
      const quantity = Number(oldLine.qty ?? oldLine.quantity ?? 1);
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        unavailable.push(`${oldLine.name} (invalid saved quantity)`);
        continue;
      }
      const portion = (item.portions || []).find(
        (entry) => entry.name === (oldLine.portion || "Regular"),
      );
      if (!portion) {
        unavailable.push(
          `${oldLine.name} (portion ${oldLine.portion || "Regular"} is no longer offered)`,
        );
        continue;
      }
      const oldAddonNames = oldLine.addons || [];
      const addonName = (value) =>
        typeof value === "string" ? value : value?.name;
      const addons = oldAddonNames
        .map((name) =>
          (item.addons || []).find((addon) => addon.name === addonName(name)),
        )
        .filter(Boolean);
      const missingAddons = oldAddonNames.filter(
        (name) => !addons.some((addon) => addon.name === addonName(name)),
      );
      if (missingAddons.length)
        unavailable.push(
          `${oldLine.name} extras changed: ${missingAddons.map(addonName).join(", ")}`,
        );
      if (item.addonsRequired && !addons.length) {
        unavailable.push(
          `${oldLine.name} (required extras are no longer available)`,
        );
        continue;
      }
      const requested = (requestedByItem.get(item.id) || 0) + quantity;
      const stockQty = Number(item.mapping.stockQty ?? 30);
      if (requested > stockQty) {
        unavailable.push(
          `${oldLine.name} (only ${Math.max(0, stockQty - (requestedByItem.get(item.id) || 0))} left)`,
        );
        continue;
      }
      requestedByItem.set(item.id, requested);
      const addonTotal = addons.reduce(
        (sum, addon) => sum + Number(addon.price || 0),
        0,
      );
      validLines.push({
        itemId: item.id,
        outletId: currentOutletId,
        name: item.name,
        image: item.image,
        category: item.category,
        portion: portion.name,
        addons: addons.map((addon) => ({
          name: addon.name,
          price: Number(addon.price || 0),
        })),
        quantity,
        unitPrice:
          getPortionPrice(item, portion, item.effectivePrice) + addonTotal,
      });
    }
    return { lines: validLines, unavailable };
  },
  async createCateringEnquiry(payload) {
    await wait(100);
    const enquiry = {
      ...clone(payload),
      id: `CAT-${Date.now().toString().slice(-7)}`,
      status: "Pending Manager Confirmation",
      createdAt: new Date().toISOString(),
    };
    customerState.cateringEnquiries.unshift(enquiry);
    saveCustomerState();
    return clone(enquiry);
  },
  async getCateringEnquiries() {
    return clone(customerState.cateringEnquiries);
  },
  async getLoyalty() {
    return clone(customerState.loyalty);
  },
  async resetCustomerDemo() {
    customerState = freshCustomerState();
    saveCustomerState();
    return true;
  },
};
