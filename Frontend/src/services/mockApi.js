import { seedOutlets } from "../data/outlets";
import { seedMenuItems } from "../data/menuItems";
import { seedOrders } from "../data/orders";
import { seedSettings } from "../data/settings";
import { seedTimeMenus } from "../data/timeMenus";

const STORAGE_KEY = "dastarkhwan_central_admin_demo_v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_OUTLET_STOCK = 30;

function normalizeOutletStock(outlets) {
  return (outlets || []).map((outlet) => ({
    ...outlet,
    menu: (outlet.menu || []).map((mapping) => ({
      ...mapping,
      // Preserve an administrator-edited stock count (including zero). Add a
      // demo starting quantity only for older mappings that predate inventory.
      stockQty:
        Number.isSafeInteger(Number(mapping.stockQty)) &&
        mapping.stockQty !== null &&
        mapping.stockQty !== ""
          ? Math.max(0, Number(mapping.stockQty))
          : DEFAULT_OUTLET_STOCK,
    })),
  }));
}

function freshState() {
  return {
    outlets: normalizeOutletStock(clone(seedOutlets)),
    menuItems: clone(seedMenuItems),
    orders: clone(seedOrders),
    settings: clone(seedSettings),
    timeMenus: clone(seedTimeMenus),
    managerChallenge: null,
    audit: [],
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return freshState();
    const parsed = JSON.parse(saved);
    const merged = { ...freshState(), ...parsed };
    merged.outlets = normalizeOutletStock(
      Array.isArray(merged.outlets) ? merged.outlets : clone(seedOutlets),
    );
    merged.menuItems = Array.isArray(merged.menuItems)
      ? merged.menuItems
      : clone(seedMenuItems);
    merged.orders = Array.isArray(merged.orders)
      ? merged.orders
      : clone(seedOrders);
    // Add newly introduced deterministic manager/KDS demo orders to an existing
    // browser store without replacing or duplicating real demo activity.
    const newlyAddedOrders = seedOrders.filter(
      (order) =>
        !merged.orders.some((savedOrder) => savedOrder.id === order.id),
    );
    if (newlyAddedOrders.length)
      merged.orders.unshift(...clone(newlyAddedOrders));

    // One-time additive migration: preserve administrator edits while adding newly seeded catalog records.
    const newlyAdded = seedMenuItems.filter(
      (item) => !merged.menuItems.some((savedItem) => savedItem.id === item.id),
    );
    if (newlyAdded.length) {
      merged.menuItems.push(...clone(newlyAdded));
      newlyAdded.forEach((item) => {
        seedOutlets.forEach((seedOutlet) => {
          const mapping = seedOutlet.menu.find(
            (entry) => entry.itemId === item.id,
          );
          const targetOutlet = merged.outlets.find(
            (outlet) => outlet.id === seedOutlet.id,
          );
          if (
            mapping &&
            targetOutlet &&
            !targetOutlet.menu.some((entry) => entry.itemId === item.id)
          )
            targetOutlet.menu.push({
              ...clone(mapping),
              stockQty: DEFAULT_OUTLET_STOCK,
            });
        });
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        /* memory-only fallback */
      }
    }
    // Persist the additive inventory defaults for projects with an older demo store.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* memory-only fallback */
    }
    return merged;
  } catch {
    return freshState();
  }
}

let state = loadState();
const subscribers = new Set();

export function subscribeMockApi(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function notifySubscribers() {
  subscribers.forEach((listener) => {
    try {
      listener();
    } catch {
      /* subscriber isolation */
    }
  });
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* memory-only fallback */
  }
  notifySubscribers();
}

// Keep separate tabs on the same origin in sync when the shared demo store is
// changed elsewhere. The storage event is browser-local; it is not a backend.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      state = loadState();
      notifySubscribers();
    }
  });
}

save(); // Make the seeded demo manager directory available to the existing staff-login flow.

function record(action, detail) {
  state.audit.unshift({
    id: `audit-${Date.now()}`,
    action,
    detail,
    at: new Date().toISOString(),
  });
  state.audit = state.audit.slice(0, 100);
}

function getEffectivePrice(item, outlet, mapping) {
  return Number(
    mapping?.priceOverride ??
      item?.cityPrices?.[outlet?.city] ??
      item?.basePrice ??
      0,
  );
}

function getOutletOrThrow(id) {
  const outlet = state.outlets.find((entry) => entry.id === id);
  if (!outlet) throw new Error("Outlet not found.");
  return outlet;
}

function getItemOrThrow(id) {
  const item = state.menuItems.find((entry) => entry.id === id);
  if (!item) throw new Error("Catalog item not found.");
  return item;
}

function matchesDate(order, from, to) {
  const timestamp = new Date(order.createdAt || order.placedAt).getTime();
  if (from && timestamp < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && timestamp > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

export const mockApi = {
  async getAdminOverview() {
    await delay();
    const orders = clone(state.orders);
    const outlets = clone(state.outlets);
    const paid = orders.filter((order) => order.paymentStatus === "Succeeded");
    const revenue = paid.reduce((sum, order) => sum + order.amount, 0);
    const prepValues = orders
      .filter((order) => order.prepMinutes > 0)
      .map((order) => order.prepMinutes);
    const avgPrep = prepValues.length
      ? Math.round(prepValues.reduce((a, b) => a + b, 0) / prepValues.length)
      : 0;
    const byCustomer = orders.reduce(
      (acc, order) => ({
        ...acc,
        [order.customer]: (acc[order.customer] || 0) + 1,
      }),
      {},
    );
    const repeatCustomers = Object.values(byCustomer).filter(
      (count) => count > 1,
    ).length;
    const uniqueCustomers = Object.keys(byCustomer).length;
    const lateOrders = orders.filter(
      (order) =>
        order.status === "Preparing" &&
        order.paymentStatus === "Succeeded" &&
        new Date(order.promisedAt).getTime() < Date.now(),
    );
    const today = new Date();
    const orderTrend = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      const count = orders.filter((order) => {
        const created = new Date(order.createdAt || order.placedAt).getTime();
        return created >= start.getTime() && created <= end.getTime();
      }).length;
      return {
        label: day.toLocaleDateString("en-IN", { weekday: "short" }),
        value: count,
      };
    });
    return {
      outlets,
      orders,
      lateOrders,
      orderTrend,
      kpis: [
        {
          label: "Total orders",
          value: orders.length,
          note: "Across all outlets",
          icon: "orders",
        },
        {
          label: "Total revenue",
          value: revenue,
          format: "currency",
          note: "Successful payments only",
          icon: "revenue",
        },
        {
          label: "Avg. preparation",
          value: `${avgPrep} min`,
          note: "From order preparation estimates",
          icon: "time",
        },
        {
          label: "Cancelled orders",
          value: orders.filter((order) => order.status === "Cancelled").length,
          note: "Payment failures included",
          icon: "cancel",
        },
        {
          label: "Repeat customers",
          value: `${uniqueCustomers ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0}%`,
          note: "Based on sample order history",
          icon: "customers",
        },
      ],
      revenueByOutlet: outlets.map((outlet) => ({
        name: outlet.name.replace(" Cloud Kitchen", ""),
        value: paid
          .filter((order) => order.outletId === outlet.id)
          .reduce((sum, order) => sum + order.amount, 0),
      })),
      statusCounts: [
        "Placed",
        "Accepted",
        "Preparing",
        "Ready",
        "Handed Off",
        "Cancelled",
      ].map((name) => ({
        name,
        value: orders.filter((order) => order.status === name).length,
      })),
      paymentIssues: orders.filter(
        (order) =>
          order.paymentStatus === "Failed" || order.paymentStatus === "Pending",
      ),
      unavailableItems: outlets
        .flatMap((outlet) =>
          outlet.menu
            .filter((mapping) => !mapping.available)
            .map((mapping) => ({
              outlet,
              mapping,
              item: state.menuItems.find((item) => item.id === mapping.itemId),
            })),
        )
        .filter((entry) => entry.item),
    };
  },

  async getOrders(filters = {}) {
    await delay();
    let rows = clone(state.orders);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(
        (order) =>
          order.id.toLowerCase().includes(q) ||
          order.customer.toLowerCase().includes(q) ||
          order.phone.includes(q),
      );
    }
    if (filters.outletId && filters.outletId !== "all")
      rows = rows.filter((order) => order.outletId === filters.outletId);
    if (filters.status && filters.status !== "all")
      rows = rows.filter((order) => order.status === filters.status);
    if (filters.paymentStatus && filters.paymentStatus !== "all")
      rows = rows.filter(
        (order) => order.paymentStatus === filters.paymentStatus,
      );
    if (!filters.from && !filters.to) rows = rows;
    else
      rows = rows.filter((order) =>
        matchesDate(order, filters.from, filters.to),
      );
    return rows.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  },

  async getOrderById(id) {
    await delay(80);
    return clone(state.orders.find((order) => order.id === id) || null);
  },
  async getOutlets() {
    await delay();
    return clone(state.outlets);
  },
  async getOutletById(id) {
    await delay(80);
    return clone(state.outlets.find((outlet) => outlet.id === id) || null);
  },

  async createOutlet(payload) {
    await delay();
    if (
      state.outlets.some(
        (outlet) => outlet.code.toLowerCase() === payload.code.toLowerCase(),
      )
    )
      throw new Error("Outlet code must be unique.");
    const outlet = {
      ...clone(payload),
      id: `out-${Date.now()}`,
      manager: null,
      menu: [],
    };
    state.outlets.unshift(outlet);
    record("Outlet created", `${outlet.name} (${outlet.code})`);
    save();
    return clone(outlet);
  },

  async updateOutlet(id, payload) {
    await delay();
    const outlet = getOutletOrThrow(id);
    if (
      state.outlets.some(
        (entry) =>
          entry.id !== id &&
          entry.code.toLowerCase() === String(payload.code || "").toLowerCase(),
      )
    )
      throw new Error("Outlet code must be unique.");
    Object.assign(outlet, clone(payload));
    record("Outlet updated", outlet.name);
    save();
    return clone(outlet);
  },

  async updateOutletStatus(id, active) {
    await delay(100);
    const outlet = getOutletOrThrow(id);
    outlet.active = Boolean(active);
    record(active ? "Outlet activated" : "Outlet deactivated", outlet.name);
    save();
    return clone(outlet);
  },

  async getOutletAnalytics(id) {
    await delay(90);
    const outlet = getOutletOrThrow(id);
    const orders = state.orders.filter((order) => order.outletId === id);
    const paid = orders.filter((order) => order.paymentStatus === "Succeeded");
    const revenue = paid.reduce((sum, order) => sum + order.amount, 0);
    const avgOrder = paid.length ? Math.round(revenue / paid.length) : 0;
    const cancelled = orders.filter(
      (order) => order.status === "Cancelled",
    ).length;
    const late = orders.filter(
      (order) =>
        order.status === "Preparing" &&
        order.paymentStatus === "Succeeded" &&
        new Date(order.promisedAt).getTime() < Date.now(),
    ).length;
    const prepRows = orders.filter((order) => Number(order.prepMinutes) > 0);
    const avgPrep = prepRows.length
      ? Math.round(
          prepRows.reduce((sum, order) => sum + order.prepMinutes, 0) /
            prepRows.length,
        )
      : outlet.prepTime;
    const customerCounts = orders.reduce(
      (acc, order) => ({
        ...acc,
        [order.customer]: (acc[order.customer] || 0) + 1,
      }),
      {},
    );
    const repeatCount = Object.values(customerCounts).filter(
      (count) => count > 1,
    ).length;
    const unique = Object.keys(customerCounts).length;
    return {
      outlet: clone(outlet),
      orders: clone(orders),
      orderCount: orders.length,
      revenue,
      avgOrder,
      cancelled,
      late,
      avgPrep,
      repeatRate: unique ? Math.round((repeatCount / unique) * 100) : 0,
    };
  },

  async sendManagerOtp({ name, phone, outletId }) {
    await delay(250);
    if (!name.trim() || name.trim().length < 2)
      throw new Error("Enter the manager's full name.");
    if (!/^[6-9]\d{9}$/.test(phone))
      throw new Error("Enter a valid 10-digit Indian mobile number.");
    const alreadyAssigned = state.outlets.find(
      (outlet) => outlet.id !== outletId && outlet.manager?.phone === phone,
    );
    if (alreadyAssigned)
      throw new Error(
        `This manager is already assigned to ${alreadyAssigned.name}.`,
      );
    state.managerChallenge = {
      name: name.trim(),
      phone,
      outletId,
      otp: "246810",
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return { message: "Development OTP generated. No SMS was sent." };
  },

  async verifyManagerOtp({ outletId, otp }) {
    await delay(220);
    const challenge = state.managerChallenge;
    if (
      !challenge ||
      challenge.outletId !== outletId ||
      challenge.expiresAt < Date.now()
    )
      throw new Error("OTP expired. Send a new code.");
    if (otp !== challenge.otp)
      throw new Error("Incorrect demo OTP. Use 246810.");
    challenge.verified = true;
    return { name: challenge.name, phone: challenge.phone, verified: true };
  },

  async verifyManagerOtpAndAssign({ outletId, otp }) {
    await delay(200);
    const challenge = state.managerChallenge;
    if (
      !challenge ||
      challenge.outletId !== outletId ||
      challenge.expiresAt < Date.now()
    )
      throw new Error("OTP expired. Send a new code.");
    if (!challenge.verified || otp !== challenge.otp)
      throw new Error("Verify the manager phone before confirming assignment.");
    const duplicate = state.outlets.find(
      (outlet) =>
        outlet.id !== outletId && outlet.manager?.phone === challenge.phone,
    );
    if (duplicate)
      throw new Error(`This manager is already assigned to ${duplicate.name}.`);
    const outlet = getOutletOrThrow(outletId);
    outlet.manager = {
      name: challenge.name,
      phone: challenge.phone,
      verified: true,
      active: true,
      assignedAt: new Date().toISOString(),
    };
    state.managerChallenge = null;
    record("Manager assigned", `${challenge.name} → ${outlet.name}`);
    save();
    return clone(outlet.manager);
  },

  async removeManager(outletId) {
    await delay(100);
    const outlet = getOutletOrThrow(outletId);
    const name = outlet.manager?.name || "Manager";
    outlet.manager = null;
    record("Manager unassigned", `${name} from ${outlet.name}`);
    save();
  },

  async getMenuCatalog(filters = {}) {
    await delay();
    let rows = clone(state.menuItems);
    if (filters.search)
      rows = rows.filter((item) =>
        item.name.toLowerCase().includes(filters.search.toLowerCase()),
      );
    if (filters.category && filters.category !== "all")
      rows = rows.filter((item) => item.category === filters.category);
    if (filters.foodType && filters.foodType !== "all")
      rows = rows.filter((item) => item.veg === (filters.foodType === "veg"));
    if (filters.spice && filters.spice !== "all")
      rows = rows.filter((item) => item.spice === filters.spice);
    if (filters.status && filters.status !== "all")
      rows = rows.filter(
        (item) => item.active === (filters.status === "active"),
      );
    return rows;
  },

  async createMenuItem(payload) {
    await delay();
    const now = new Date().toISOString();
    const item = {
      ...clone(payload),
      id: `food-${Date.now()}`,
      cityPrices: payload.cityPrices || {},
      active: payload.active !== false,
      createdAt: now,
      updatedAt: now,
    };
    state.menuItems.unshift(item);
    record("Catalog item created", item.name);
    save();
    return clone(item);
  },

  async updateMenuItem(id, payload) {
    await delay();
    const item = getItemOrThrow(id);
    Object.assign(item, clone(payload), {
      updatedAt: new Date().toISOString(),
    });
    record("Catalog item updated", item.name);
    save();
    return clone(item);
  },

  async assignMenuItemToOutlet({
    itemId,
    outletIds,
    available = true,
    priceOverride = null,
    timeMenu = "All Day",
  }) {
    await delay();
    getItemOrThrow(itemId);
    const assigned = [];
    outletIds.forEach((id) => {
      const outlet = state.outlets.find((entry) => entry.id === id);
      if (!outlet) return;
      const existing = outlet.menu.find((mapping) => mapping.itemId === itemId);
      if (existing)
        Object.assign(existing, { available, priceOverride, timeMenu });
      else
        outlet.menu.push({
          itemId,
          available,
          priceOverride,
          timeMenu,
          stockQty: DEFAULT_OUTLET_STOCK,
        });
      assigned.push(outlet.name);
    });
    record("Menu item mapped", `${itemId} → ${assigned.join(", ")}`);
    save();
    return assigned;
  },

  async updateOutletMenuItem({ outletId, itemId, ...patch }) {
    await delay(100);
    const outlet = getOutletOrThrow(outletId);
    const mapping = outlet.menu.find((entry) => entry.itemId === itemId);
    if (!mapping)
      throw new Error(
        "This catalog item is not mapped to the selected outlet.",
      );
    if (
      patch.stockQty !== undefined &&
      (!Number.isSafeInteger(Number(patch.stockQty)) ||
        Number(patch.stockQty) < 0)
    ) {
      throw new Error("Stock quantity must be a non-negative whole number.");
    }
    Object.assign(
      mapping,
      clone(patch),
      patch.stockQty !== undefined ? { stockQty: Number(patch.stockQty) } : {},
    );
    record("Outlet menu mapping updated", `${itemId} at ${outlet.name}`);
    save();
    return clone(mapping);
  },

  async removeMenuItemFromOutlet({ outletId, itemId }) {
    await delay(100);
    const outlet = getOutletOrThrow(outletId);
    outlet.menu = outlet.menu.filter((mapping) => mapping.itemId !== itemId);
    record("Menu mapping removed", `${itemId} from ${outlet.name}`);
    save();
  },

  async getOutletMenu(outletId) {
    await delay();
    const outlet = getOutletOrThrow(outletId);
    return outlet.menu
      .map((mapping) => {
        const item = state.menuItems.find(
          (entry) => entry.id === mapping.itemId,
        );
        if (!item) return null;
        return {
          ...clone(item),
          mapping: clone(mapping),
          effectivePrice: getEffectivePrice(item, outlet, mapping),
        };
      })
      .filter(Boolean);
  },

  async getSettings() {
    await delay(80);
    return clone(state.settings);
  },
  async updateSettings(payload) {
    await delay(120);
    Object.assign(state.settings, clone(payload));
    record("Platform settings updated", "Central Admin settings");
    save();
    return clone(state.settings);
  },
  async getTimeMenus() {
    await delay(80);
    return clone(state.timeMenus);
  },

  async saveTimeMenu(payload) {
    await delay(120);
    if (
      !payload.name.trim() ||
      !payload.days.length ||
      !payload.outletIds.length ||
      !payload.itemIds.length
    )
      throw new Error("Complete the name, days, outlet and item selections.");
    if (payload.start >= payload.end)
      throw new Error(
        "End time must be later than start time. Overnight windows are not supported in this prototype.",
      );
    if (payload.active) {
      const missingMappings = payload.outletIds.flatMap((outletId) => {
        const outlet = state.outlets.find((entry) => entry.id === outletId);
        if (!outlet) return [`Unknown outlet: ${outletId}`];
        return payload.itemIds
          .filter(
            (itemId) =>
              !outlet.menu.some((mapping) => mapping.itemId === itemId),
          )
          .map(
            (itemId) =>
              `${state.menuItems.find((item) => item.id === itemId)?.name || itemId} is not mapped to ${outlet.name}`,
          );
      });
      if (missingMappings.length)
        throw new Error(
          `Map every scheduled item to each selected outlet first. ${missingMappings[0]}`,
        );
      const conflict = state.timeMenus.find(
        (menu) =>
          menu.active &&
          menu.id !== payload.id &&
          menu.outletIds.some((id) => payload.outletIds.includes(id)) &&
          menu.days.some((day) => payload.days.includes(day)) &&
          payload.start < menu.end &&
          payload.end > menu.start,
      );
      if (conflict)
        throw new Error(
          `Schedule overlaps with ${conflict.name} for a selected outlet/day.`,
        );
    }
    if (payload.id) {
      const index = state.timeMenus.findIndex((menu) => menu.id === payload.id);
      if (index < 0) throw new Error("Schedule not found.");
      state.timeMenus[index] = { ...state.timeMenus[index], ...clone(payload) };
    } else
      state.timeMenus.unshift({ ...clone(payload), id: `tm-${Date.now()}` });
    record("Time-based menu saved", payload.name);
    save();
    return clone(state.timeMenus);
  },

  async getAuditLog() {
    await delay(80);
    return clone(state.audit);
  },

  // Outlet Manager operations intentionally mutate the same shared state used by
  // Central Admin and Customer. Authorization is rechecked for every mutation.
  async getManagerWorkspace({ outletId, phone }) {
    await delay(60);
    const outlet = state.outlets.find(
      (entry) =>
        entry.id === outletId &&
        entry.manager?.phone === phone &&
        entry.manager?.verified === true &&
        entry.manager?.active !== false,
    );
    if (!outlet)
      throw new Error(
        "This manager account is not assigned to the requested outlet.",
      );
    const now = Date.now();
    let changed = false;
    state.orders
      .filter(
        (order) =>
          order.outletId === outletId &&
          order.paymentStatus === "Succeeded" &&
          ["Placed", "Accepted", "Preparing", "Ready"].includes(order.status),
      )
      .forEach((order) => {
        const lateBy = Math.floor(
          (now - new Date(order.promisedAt).getTime()) / 60000,
        );
        if (lateBy >= 10 && !order.criticalLateNotifiedAt) {
          const at = new Date(now).toISOString();
          order.criticalLateNotifiedAt = at;
          order.customerNotifications = [
            ...(order.customerNotifications || []),
            { type: "LATE_10_MIN", label: "Customer notified (demo)", at },
          ];
          order.timeline = [
            ...(order.timeline || []),
            {
              label: "Customer notified (demo)",
              time: new Date(now).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              at,
            },
          ];
          order.managerAlerts = [
            ...(order.managerAlerts || []),
            { type: "CRITICAL_LATE", lateByMinutes: lateBy, at },
          ];
          record(
            "Critical late-order alert",
            `${order.id} · ${lateBy} minutes late · customer notification simulated`,
          );
          changed = true;
        }
      });
    if (changed) save();
    const orders = state.orders
      .filter((order) => order.outletId === outletId)
      .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
    const menu = outlet.menu
      .map((mapping) => {
        const item = state.menuItems.find(
          (entry) => entry.id === mapping.itemId,
        );
        if (!item) return null;
        return {
          ...clone(item),
          mapping: clone(mapping),
          effectivePrice: getEffectivePrice(item, outlet, mapping),
        };
      })
      .filter(Boolean);
    return clone({
      outlet,
      orders,
      menu,
      audit: state.audit
        .filter((entry) => entry.detail?.includes(outlet.name))
        .slice(0, 30),
    });
  },

  async updateManagerOrderStatus({ outletId, phone, orderId, nextStatus }) {
    await delay(70);
    const outlet = state.outlets.find(
      (entry) =>
        entry.id === outletId &&
        entry.manager?.phone === phone &&
        entry.manager?.verified === true &&
        entry.manager?.active !== false,
    );
    if (!outlet) throw new Error("Manager assignment could not be verified.");
    const order = state.orders.find(
      (entry) => entry.id === orderId && entry.outletId === outletId,
    );
    if (!order)
      throw new Error("Order does not belong to your assigned outlet.");
    if (order.paymentStatus !== "Succeeded")
      throw new Error(
        "Only successfully paid orders can enter kitchen processing.",
      );
    const transitions = {
      Placed: "Accepted",
      Accepted: "Preparing",
      Preparing: "Ready",
      Ready: "Handed Off",
    };
    if (transitions[order.status] !== nextStatus)
      throw new Error(
        `Invalid transition: ${order.status} cannot move to ${nextStatus}.`,
      );
    const now = new Date();
    const labels = {
      Accepted: "Accepted",
      Preparing: "Preparing",
      Ready: "Ready",
      "Handed Off": "Handed Off",
    };
    order.status = labels[nextStatus];
    order.timeline = [
      ...(order.timeline || []),
      {
        label: labels[nextStatus],
        time: now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        }),
        at: now.toISOString(),
      },
    ];
    order.statusHistory = [
      ...(order.statusHistory || []),
      {
        status: nextStatus.toUpperCase().replaceAll(" ", "_"),
        at: now.toISOString(),
      },
    ];
    const timestampKey = {
      Accepted: "acceptedAt",
      Preparing: "preparingAt",
      Ready: "readyAt",
      "Handed Off": "handedOffAt",
    }[nextStatus];
    order[timestampKey] = now.toISOString();
    if (nextStatus === "Preparing") order.startedAt = now.toISOString();
    if (nextStatus === "Ready") order.completedPrepAt = now.toISOString();
    record(
      "Manager updated order",
      `${order.id} at ${outlet.name} → ${nextStatus}`,
    );
    save();
    return clone(order);
  },

  async overrideManagerOrderEta({ outletId, phone, orderId, minutes, reason }) {
    await delay(70);
    const outlet = state.outlets.find(
      (entry) =>
        entry.id === outletId &&
        entry.manager?.phone === phone &&
        entry.manager?.verified === true &&
        entry.manager?.active !== false,
    );
    if (!outlet) throw new Error("Manager assignment could not be verified.");
    const order = state.orders.find(
      (entry) => entry.id === orderId && entry.outletId === outletId,
    );
    if (!order || !["Accepted", "Preparing"].includes(order.status))
      throw new Error(
        "Only an active kitchen order can receive an ETA override.",
      );
    const estimate = Number(minutes);
    const minimum = Number(outlet.prepTime || 15);
    if (!Number.isSafeInteger(estimate) || estimate < minimum || estimate > 240)
      throw new Error(
        `Enter a whole-number estimate between ${minimum} and 240 minutes.`,
      );
    if (!String(reason || "").trim())
      throw new Error("Add a short reason for changing this order's estimate.");
    const now = new Date();
    const previousPromisedAt = order.promisedAt;
    order.prepMinutes = estimate;
    order.promisedAt = new Date(now.getTime() + estimate * 60000).toISOString();
    order.promisedLabel = new Date(order.promisedAt).toLocaleTimeString(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    );
    order.etaOverride = {
      minutes: estimate,
      reason: String(reason).trim(),
      previousPromisedAt,
      updatedAt: now.toISOString(),
    };
    order.timeline = [
      ...(order.timeline || []),
      {
        label: `ETA updated to ${estimate} min · ${String(reason).trim()}`,
        time: now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        }),
        at: now.toISOString(),
      },
    ];
    order.customerNotifications = [
      ...(order.customerNotifications || []),
      {
        type: "ETA_UPDATED",
        label: "Updated preparation estimate (demo)",
        at: now.toISOString(),
        minutes: estimate,
      },
    ];
    record(
      "Manager overrode preparation estimate",
      `${order.id} at ${outlet.name} → ${estimate} min (${String(reason).trim()})`,
    );
    save();
    return clone(order);
  },

  async updateManagerMenuAvailability({
    outletId,
    phone,
    itemId,
    available,
    reason = "",
    restockAt = "",
  }) {
    await delay(70);
    const outlet = state.outlets.find(
      (entry) =>
        entry.id === outletId &&
        entry.manager?.phone === phone &&
        entry.manager?.verified === true &&
        entry.manager?.active !== false,
    );
    if (!outlet) throw new Error("Manager assignment could not be verified.");
    const mapping = outlet.menu.find((entry) => entry.itemId === itemId);
    if (!mapping)
      throw new Error("This item is not mapped to your assigned outlet.");
    if (typeof available !== "boolean")
      throw new Error("Choose an availability state.");
    mapping.available = available;
    mapping.availabilityReason = available
      ? ""
      : String(reason || "Temporarily paused");
    mapping.restockAt = available ? "" : String(restockAt || "");
    mapping.availabilityUpdatedAt = new Date().toISOString();
    const item = state.menuItems.find((entry) => entry.id === itemId);
    record(
      available
        ? "Manager marked menu item available"
        : "Manager marked menu item unavailable",
      `${item?.name || itemId} at ${outlet.name}${mapping.availabilityReason ? ` · ${mapping.availabilityReason}` : ""}`,
    );
    save();
    return clone(mapping);
  },

  // Customer-order bridge: paid mock orders are stored in the same order collection
  // consumed by Central Admin. This keeps the two frontends on one demo data model.
  async createCustomerOrder(payload) {
    await delay(120);
    const now = new Date();
    const outlet = getOutletOrThrow(payload.outletId);
    if (!outlet.active)
      throw new Error("This outlet is not currently accepting orders.");
    if (!Array.isArray(payload.items) || payload.items.length === 0)
      throw new Error("An order must contain at least one food item.");
    const requestedByItem = new Map();
    for (const item of payload.items) {
      const quantity = Number(item.quantity ?? item.qty ?? 0);
      if (!Number.isSafeInteger(quantity) || quantity < 1)
        throw new Error(
          `Enter a valid whole-number quantity for ${item.name || "this item"}.`,
        );
      const mapping = outlet.menu.find((entry) => entry.itemId === item.itemId);
      const catalogItem = state.menuItems.find(
        (entry) => entry.id === item.itemId,
      );
      if (!mapping || !mapping.available || !catalogItem?.active)
        throw new Error(
          `${item.name || "An item"} is no longer available at this outlet.`,
        );
      requestedByItem.set(
        item.itemId,
        (requestedByItem.get(item.itemId) || 0) + quantity,
      );
    }
    for (const [itemId, quantity] of requestedByItem) {
      const mapping = outlet.menu.find((entry) => entry.itemId === itemId);
      const stockQty = Number(mapping?.stockQty ?? DEFAULT_OUTLET_STOCK);
      if (quantity > stockQty) {
        const itemName =
          state.menuItems.find((entry) => entry.id === itemId)?.name || itemId;
        throw new Error(
          `Only ${stockQty} ${stockQty === 1 ? "unit is" : "units are"} left for ${itemName}. Update your cart and retry.`,
        );
      }
    }
    let id = `WEB-${String(Date.now()).slice(-9)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    while (state.orders.some((entry) => entry.id === id))
      id = `WEB-${String(Date.now()).slice(-9)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    const items = clone(payload.items || []).map((item) => ({
      itemId: item.itemId || null,
      category: item.category || null,
      name: item.name,
      qty: Number(item.quantity ?? item.qty ?? 1),
      price: Number(item.unitPrice || item.price || 0),
      portion: item.portion || "Regular",
      addons: (item.addons || []).map((addon) =>
        typeof addon === "string" ? addon : addon.name,
      ),
    }));
    const activeKitchenOrders = state.orders.filter(
      (entry) =>
        entry.outletId === outlet.id &&
        entry.paymentStatus === "Succeeded" &&
        ["Placed", "Accepted", "Preparing", "Ready"].includes(entry.status),
    ).length;
    const itemPrepMinutes = items.map((line) => {
      const catalog = state.menuItems.find(
        (entry) => entry.id === line.itemId || entry.name === line.name,
      );
      return Number(catalog?.prepTime || 0);
    });
    const baseItemMinutes = itemPrepMinutes.some((value) => value > 0)
      ? Math.max(...itemPrepMinutes)
      : Number(payload.prepMinutes || 0);
    const workloadMinutes = Math.min(24, activeKitchenOrders * 3);
    const complexityMinutes =
      Math.max(
        0,
        new Set(items.map((line) => line.itemId || line.name)).size - 1,
      ) * 2;
    const outletMinimumMinutes = Number(outlet.prepTime || 15);
    const predictedMinutes =
      baseItemMinutes + workloadMinutes + complexityMinutes;
    const prepMinutes = Math.max(predictedMinutes, outletMinimumMinutes);
    const estimateDetails = {
      method: "Workload-based demo estimate",
      baseItemMinutes,
      activeOrders: activeKitchenOrders,
      workloadMinutes,
      complexityMinutes,
      outletMinimumMinutes,
      predictedMinutes,
      minutes: Math.max(predictedMinutes, outletMinimumMinutes),
      calculatedAt: now.toISOString(),
    };
    const promisedAt = new Date(now.getTime() + prepMinutes * 60000);
    const amount = Number(payload.amount || 0);
    const order = {
      id,
      customer: payload.customer?.name || "Demo Customer",
      phone: payload.customer?.phone || "9000000101",
      customerId: payload.customer?.id || "demo-customer-1",
      outletId: payload.outletId,
      outletSnapshot: {
        id: outlet.id,
        name: outlet.name,
        address: outlet.address,
      },
      address: clone(payload.address || null),
      itemSummary: items.map((item) => `${item.name} ×${item.qty}`).join(", "),
      items,
      subtotal: Number(payload.subtotal || 0),
      deliveryFee: Number(payload.deliveryFee || 0),
      amount,
      paymentMethod: payload.paymentMethod === "upi" ? "UPI" : "Card",
      paymentStatus: "Succeeded",
      paymentReference: payload.paymentReference,
      couponCode: payload.couponCode || null,
      couponDiscount: Number(payload.couponDiscount || 0),
      loyaltyDiscount: Number(payload.loyaltyDiscount || 0),
      status: "Placed",
      placedAt: now.toISOString(),
      placedLabel: now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      promisedAt: promisedAt.toISOString(),
      promisedLabel: promisedAt.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      prepMinutes,
      estimateDetails,
      gstInclusive: true,
      instructions: payload.instructions || "",
      timeline: [
        {
          label: "Placed",
          time: now.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
          }),
          at: now.toISOString(),
        },
      ],
      statusHistory: [{ status: "PLACED", at: now.toISOString() }],
    };
    // Stock deduction happens in the same shared Central Admin state write as
    // order creation. Failed/abandoned payments never reach this method.
    for (const [itemId, quantity] of requestedByItem) {
      const mapping = outlet.menu.find((entry) => entry.itemId === itemId);
      mapping.stockQty = Math.max(
        0,
        Number(mapping.stockQty ?? DEFAULT_OUTLET_STOCK) - quantity,
      );
    }
    state.orders.unshift(order);
    record("Customer order placed", `${order.id} at ${outlet.name}`);
    save();
    return clone(order);
  },

  async updateCustomerOrderStatus(orderId, nextStatus) {
    await delay(100);
    const order = state.orders.find((entry) => entry.id === orderId);
    if (!order) throw new Error("Order not found.");
    const labels = {
      PLACED: "Placed",
      ACCEPTED: "Accepted",
      PREPARING: "Preparing",
      READY: "Ready",
      HANDED_OFF: "Handed Off",
      CANCELLED: "Cancelled",
    };
    if (!labels[nextStatus]) throw new Error("Unsupported order status.");
    if (order.status === "Cancelled" || order.status === "Handed Off")
      return clone(order);
    if (order.paymentStatus !== "Succeeded")
      throw new Error(
        "Only successfully paid orders can enter kitchen processing.",
      );
    const allowedNext = {
      Placed: "ACCEPTED",
      Accepted: "PREPARING",
      Preparing: "READY",
      Ready: "HANDED_OFF",
    };
    if (allowedNext[order.status] !== nextStatus)
      throw new Error(
        `Invalid order transition from ${order.status} to ${labels[nextStatus]}.`,
      );
    order.status = labels[nextStatus];
    const now = new Date();
    order.timeline = [
      ...(order.timeline || []),
      {
        label: labels[nextStatus],
        time: now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        }),
        at: now.toISOString(),
      },
    ];
    order.statusHistory = [
      ...(order.statusHistory || []),
      { status: nextStatus, at: now.toISOString() },
    ];
    record(
      "Customer order status simulated",
      `${order.id} → ${labels[nextStatus]}`,
    );
    save();
    return clone(order);
  },

  async getCustomerOrder(orderId) {
    await delay(60);
    return clone(state.orders.find((entry) => entry.id === orderId) || null);
  },
  async resetDemoData() {
    state = freshState();
    save();
    return true;
  },
};
