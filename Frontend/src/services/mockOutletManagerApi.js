import { mockApi, subscribeMockApi } from "./mockApi";

const readSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem("demo_auth_session") || "null");
  } catch {
    return null;
  }
};

function requireManagerSession() {
  const session = readSession();
  if (
    !session ||
    session.role !== "outlet_manager" ||
    !session.phone ||
    !session.outletId
  ) {
    throw new Error(
      "Sign in with an assigned Outlet Manager account to continue.",
    );
  }
  return session;
}

const minutesBetween = (a, b) =>
  Math.max(
    0,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000),
  );
const isPaid = (order) => order.paymentStatus === "Succeeded";
const isActive = (order) =>
  isPaid(order) &&
  ["Placed", "Accepted", "Preparing", "Ready"].includes(order.status);
const isLate = (order, now = Date.now()) =>
  isActive(order) && new Date(order.promisedAt).getTime() < now;
const isCriticalLate = (order, now = Date.now()) =>
  isLate(order, now) &&
  now - new Date(order.promisedAt).getTime() >= 10 * 60000;
const dayStart = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${parts}T00:00:00+05:30`);
};

function calculateOverview(outlet, orders, menu) {
  const now = Date.now();
  const today = dayStart(now).getTime();
  const todays = orders.filter(
    (order) => new Date(order.placedAt).getTime() >= today,
  );
  const paidToday = todays.filter(isPaid);
  const active = orders.filter(isActive);
  const completed = orders.filter(
    (order) => order.status === "Handed Off" && isPaid,
  );
  const late = active.filter((order) => isLate(order, now));
  const prep = completed
    .map((order) => {
      if (order.startedAt && order.completedPrepAt)
        return minutesBetween(order.startedAt, order.completedPrepAt);
      return Number(order.prepMinutes || 0);
    })
    .filter((value) => value > 0);
  const avgPrep = prep.length
    ? Math.round(prep.reduce((sum, value) => sum + value, 0) / prep.length)
    : 0;
  const revenue = paidToday
    .filter((order) => order.status !== "Cancelled")
    .reduce((sum, order) => sum + Number(order.amount || 0), 0);
  const pending = active.filter((order) => order.status === "Placed");
  const preparing = active.filter((order) =>
    ["Accepted", "Preparing"].includes(order.status),
  );
  const ready = active.filter((order) => order.status === "Ready");
  const unavailable = menu.filter((item) => !item.mapping.available);
  const closing = outlet.closeTime
    ? (() => {
        const [closeHour, closeMinute] = outlet.closeTime
          .split(":")
          .map(Number);
        const clock = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date(now));
        const [currentHour, currentMinute] = clock.split(":").map(Number);
        const diff =
          closeHour * 60 + closeMinute - (currentHour * 60 + currentMinute);
        return diff >= 0 && diff <= 90;
      })()
    : false;
  const attention = [
    ...pending.map((order) => ({
      id: `new-${order.id}`,
      tone: "warning",
      title: `New order ${order.id}`,
      detail: `${order.customer} · awaiting acceptance`,
      orderId: order.id,
    })),
    ...late.map((order) => ({
      id: `late-${order.id}`,
      tone: isCriticalLate(order, now) ? "danger" : "warning",
      title: `${order.id} is ${isCriticalLate(order, now) ? "critically late" : "late"}`,
      detail: `${Math.floor((now - new Date(order.promisedAt).getTime()) / 60000)} min past promised time`,
      orderId: order.id,
    })),
    ...orders
      .filter((order) => ["Pending", "Failed"].includes(order.paymentStatus))
      .slice(0, 3)
      .map((order) => ({
        id: `payment-${order.id}`,
        tone: "warning",
        title: `Payment ${order.paymentStatus.toLowerCase()} · ${order.id}`,
        detail: "Not eligible for the paid kitchen queue",
        orderId: order.id,
      })),
    ...unavailable.map((item) => ({
      id: `menu-${item.id}`,
      tone: "neutral",
      title: `${item.name} unavailable`,
      detail: item.mapping.availabilityReason || "Temporarily unavailable",
    })),
    ...(closing
      ? [
          {
            id: "closing",
            tone: "neutral",
            title: "Outlet approaching closing time",
            detail: `Scheduled close ${outlet.closeTime}`,
          },
        ]
      : []),
  ];
  return {
    ordersToday: todays.length,
    activeOrders: active.length,
    averagePrep: avgPrep,
    lateOrders: late.length,
    completedOrders: completed.length,
    revenueToday: revenue,
    queue: {
      new: pending.length,
      preparing: preparing.length,
      ready: ready.length,
      late: late.length,
    },
    attention,
    recentOrders: [...orders]
      .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
      .slice(0, 7),
  };
}

function performanceFor(orders, range) {
  const now = Date.now();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 1;
  const cutoff = dayStart(now).getTime() - (days - 1) * 86400000;
  const rows = orders.filter(
    (order) => new Date(order.placedAt).getTime() >= cutoff,
  );
  const paid = rows.filter(
    (order) => isPaid(order) && order.status !== "Cancelled",
  );
  const completed = rows.filter(
    (order) => order.status === "Handed Off" && isPaid(order),
  );
  const cancelled = rows.filter((order) => order.status === "Cancelled");
  const completionTime = (order) =>
    order.completedPrepAt ||
    order.readyAt ||
    order.handedOffAt ||
    order.timeline?.find((event) => event.label === "Ready" && event.at)?.at ||
    null;
  const lateCompleted = completed.filter(
    (order) =>
      completionTime(order) &&
      new Date(completionTime(order)).getTime() >
        new Date(order.promisedAt).getTime(),
  );
  const lateActive = rows.filter((order) => isLate(order, now));
  const late = [
    ...lateActive,
    ...lateCompleted.filter(
      (order) => !lateActive.some((entry) => entry.id === order.id),
    ),
  ];
  const prepValues = completed
    .map((order) => {
      const started =
        order.startedAt ||
        order.timeline?.find((event) => event.label === "Preparing" && event.at)
          ?.at;
      const ended = completionTime(order);
      return started && ended
        ? minutesBetween(started, ended)
        : Number(order.prepMinutes || 0);
    })
    .filter(Boolean);
  const revenue = paid.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0,
  );
  const popular = new Map();
  paid.forEach((order) =>
    (order.items || []).forEach((item) => {
      const key = item.itemId || item.name;
      const row = popular.get(key) || {
        id: key,
        name: item.name,
        quantity: 0,
        revenue: 0,
      };
      row.quantity += Number(item.qty || item.quantity || 1);
      row.revenue +=
        Number(item.price || 0) * Number(item.qty || item.quantity || 1);
      popular.set(key, row);
    }),
  );
  const trend = Array.from({ length: days === 1 ? 8 : days }, (_, index) => {
    const start = new Date(cutoff + index * (days === 1 ? 3 : 1) * 3600000);
    const end = new Date(start.getTime() + (days === 1 ? 3 : 24) * 3600000);
    const bucket = rows.filter((order) => {
      const at = new Date(order.placedAt).getTime();
      return at >= start.getTime() && at < end.getTime();
    });
    const bucketPrep = bucket
      .filter((order) => order.status === "Handed Off" && isPaid(order))
      .map((order) => {
        const started =
          order.startedAt ||
          order.timeline?.find(
            (event) => event.label === "Preparing" && event.at,
          )?.at;
        const ended = completionTime(order);
        return started && ended
          ? minutesBetween(started, ended)
          : Number(order.prepMinutes || 0);
      })
      .filter(Boolean);
    return {
      label:
        days === 1
          ? start.toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              hour12: true,
            })
          : start.toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "numeric",
              month: "short",
            }),
      orders: bucket.length,
      revenue: bucket
        .filter((order) => isPaid(order) && order.status !== "Cancelled")
        .reduce((sum, order) => sum + Number(order.amount || 0), 0),
      avgPrep: bucketPrep.length
        ? Math.round(
            bucketPrep.reduce((sum, value) => sum + value, 0) /
              bucketPrep.length,
          )
        : 0,
    };
  });
  const total = rows.length;
  return {
    totalOrders: total,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    averagePrep: prepValues.length
      ? Math.round(prepValues.reduce((a, b) => a + b, 0) / prepValues.length)
      : 0,
    lateOrders: late.length,
    averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
    revenue,
    onTime: completed.filter(
      (order) =>
        completionTime(order) &&
        new Date(completionTime(order)).getTime() <=
          new Date(order.promisedAt).getTime(),
    ).length,
    onTimeMeasured: completed.filter((order) => Boolean(completionTime(order)))
      .length,
    averageDelay: late.length
      ? Math.round(
          late.reduce((sum, order) => {
            const ended = completionTime(order);
            return (
              sum +
              Math.max(
                0,
                ((ended ? new Date(ended).getTime() : now) -
                  new Date(order.promisedAt).getTime()) /
                  60000,
              )
            );
          }, 0) / late.length,
        )
      : 0,
    overrides: rows.filter((order) => order.etaOverride).length,
    statusDistribution: [
      "Placed",
      "Accepted",
      "Preparing",
      "Ready",
      "Handed Off",
      "Cancelled",
    ].map((status) => ({
      status,
      count: rows.filter((order) => order.status === status).length,
    })),
    trend,
    popular: [...popular.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6),
  };
}

export const mockOutletManagerApi = {
  subscribe: subscribeMockApi,
  async getManagerProfile() {
    const session = requireManagerSession();
    const workspace = await mockApi.getManagerWorkspace({
      outletId: session.outletId,
      phone: session.phone,
    });
    return {
      manager: workspace.outlet.manager,
      outlet: workspace.outlet,
      phone: session.phone,
      role: "Outlet Manager",
      sessionName: session.name,
    };
  },
  async getWorkspace() {
    const session = requireManagerSession();
    const workspace = await mockApi.getManagerWorkspace({
      outletId: session.outletId,
      phone: session.phone,
    });
    const activeOrders = workspace.orders.filter(isActive).length;
    const menuById = new Map(workspace.menu.map((item) => [item.id, item]));
    const orders = workspace.orders.map((order) => {
      const prepTimes = (order.items || [])
        .map((line) => Number(menuById.get(line.itemId)?.prepTime || 0))
        .filter((value) => value > 0);
      const baseItemMinutes = prepTimes.length
        ? Math.max(...prepTimes)
        : Number(order.prepMinutes || workspace.outlet.prepTime || 15);
      const activeBeforeThisOrder = Math.max(
        0,
        activeOrders - (isActive(order) ? 1 : 0),
      );
      const workloadMinutes = Math.min(24, activeBeforeThisOrder * 3);
      const complexityMinutes =
        Math.max(
          0,
          new Set((order.items || []).map((line) => line.itemId || line.name))
            .size - 1,
        ) * 2;
      const predictedMinutes = Math.max(
        baseItemMinutes + workloadMinutes + complexityMinutes,
        Number(workspace.outlet.prepTime || 15),
      );
      return {
        ...order,
        estimateExplanation: order.etaOverride
          ? {
              ...order.estimateDetails,
              ...order.etaOverride,
              minutes: order.prepMinutes,
              overridden: true,
            }
          : order.estimateDetails || {
              method: "Seeded scenario estimate",
              baseItemMinutes,
              activeOrders: activeBeforeThisOrder,
              workloadMinutes,
              complexityMinutes,
              outletMinimumMinutes: Number(workspace.outlet.prepTime || 15),
              predictedMinutes,
              minutes: Number(order.prepMinutes || predictedMinutes),
              overridden: false,
            },
      };
    });
    return {
      ...workspace,
      orders,
      overview: calculateOverview(workspace.outlet, orders, workspace.menu),
    };
  },
  async getAssignedOutlet() {
    return (await this.getManagerProfile()).outlet;
  },
  async getOutletOverview() {
    return (await this.getWorkspace()).overview;
  },
  async getKitchenOrders() {
    const workspace = await this.getWorkspace();
    const sortBy = { Placed: 0, Accepted: 1, Preparing: 1, Ready: 2 };
    return workspace.orders
      .filter(isActive)
      .sort(
        (a, b) =>
          (sortBy[a.status] ?? 9) - (sortBy[b.status] ?? 9) ||
          (a.status === "Ready"
            ? new Date(a.readyAt || a.placedAt) -
              new Date(b.readyAt || b.placedAt)
            : new Date(a.promisedAt) - new Date(b.promisedAt)),
      );
  },
  async getOutletMenuAvailability() {
    return (await this.getWorkspace()).menu;
  },
  async getLateOrders() {
    return (await this.getWorkspace()).orders.filter((order) => isLate(order));
  },
  async getOrders(filters = {}) {
    const workspace = await this.getWorkspace();
    let rows = workspace.orders;
    const q = (filters.search || "").trim().toLowerCase();
    if (q)
      rows = rows.filter(
        (order) =>
          order.id.toLowerCase().includes(q) ||
          order.customer.toLowerCase().includes(q),
      );
    if (filters.status && filters.status !== "all")
      rows = rows.filter((order) => order.status === filters.status);
    if (filters.payment && filters.payment !== "all")
      rows = rows.filter((order) => order.paymentStatus === filters.payment);
    if (filters.scope === "active") rows = rows.filter(isActive);
    if (filters.scope === "completed")
      rows = rows.filter((order) => order.status === "Handed Off");
    if (filters.scope === "cancelled")
      rows = rows.filter((order) => order.status === "Cancelled");
    if (filters.from)
      rows = rows.filter(
        (order) =>
          new Date(order.placedAt) >= new Date(`${filters.from}T00:00:00`),
      );
    if (filters.to)
      rows = rows.filter(
        (order) =>
          new Date(order.placedAt) <= new Date(`${filters.to}T23:59:59`),
      );
    return rows;
  },
  async getOrder(orderId) {
    const workspace = await this.getWorkspace();
    const order = workspace.orders.find((entry) => entry.id === orderId);
    if (!order) throw new Error("Order not found in your assigned outlet.");
    return order;
  },
  async getOutletOrders(filters = {}) {
    return this.getOrders(filters);
  },
  async getOrderDetails(orderId) {
    return this.getOrder(orderId);
  },
  async getOrderStatusHistory(orderId) {
    const order = await this.getOrder(orderId);
    return order.timeline || [];
  },
  async calculatePreparationEstimate(orderId) {
    const order = await this.getOrder(orderId);
    return (
      order.estimateExplanation ||
      order.estimateDetails || {
        minutes: order.prepMinutes,
        method: "Seeded scenario estimate",
      }
    );
  },
  async updateOrderStatus(orderId, nextStatus) {
    const session = requireManagerSession();
    return mockApi.updateManagerOrderStatus({
      outletId: session.outletId,
      phone: session.phone,
      orderId,
      nextStatus,
    });
  },
  async overrideEta(orderId, payload) {
    const session = requireManagerSession();
    return mockApi.overrideManagerOrderEta({
      outletId: session.outletId,
      phone: session.phone,
      orderId,
      ...payload,
    });
  },
  async updateAvailability(itemId, payload) {
    const session = requireManagerSession();
    return mockApi.updateManagerMenuAvailability({
      outletId: session.outletId,
      phone: session.phone,
      itemId,
      ...payload,
    });
  },
  async getPerformance(range = "7d") {
    const workspace = await this.getWorkspace();
    return performanceFor(workspace.orders, range);
  },
  async getOutletPerformance(range = "7d") {
    return this.getPerformance(range);
  },
  async getAccount() {
    return this.getManagerProfile();
  },
  async getManagerAccount() {
    return this.getManagerProfile();
  },
};

export { isActive as isKitchenActive, isLate as isOrderLate, isCriticalLate };
