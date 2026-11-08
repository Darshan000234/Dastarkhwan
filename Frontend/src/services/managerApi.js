
import { apiRequest, unwrapData } from "./apiClient";

export const managerApi = {
  async getWorkspace() {
    const [
      workspaceResponse,
      overviewResponse,
      kitchenResponse,
      menuResponse,
    ] = await Promise.all([
      apiRequest("/manager/workspace"),

      apiRequest("/manager/overview?range=today"),

      apiRequest(
        "/manager/kitchen/orders?status=all&page=1&limit=100",
      ),

      apiRequest("/manager/menu-availability?page=1&limit=100"),
    ]);

    const workspace = unwrapData(workspaceResponse);
    const overview = unwrapData(overviewResponse);
    const kitchen = unwrapData(kitchenResponse);
    const menuData = unwrapData(menuResponse);

    const menu = (menuData.menuItems || []).map((item) => ({
      ...item,
      mapping: {
        ...item.mapping,

        // Compatibility with existing Manager UI fields.
        stockQty: item.mapping?.stockQuantity ?? 0,
        timeMenu: item.mapping?.timeMenuLabel ?? null,
        restockAt: item.mapping?.expectedRestockAt ?? null,
      },
    }));

    return {
      ...workspace,

      // The existing UI reads workspace.outlet.manager.
      outlet: {
        ...workspace.outlet,
        manager: workspace.manager,
      },

      orders: kitchen.orders || [],
      menu,
      menuSummary: workspace.menu,
      overview,
      kitchenLanes: kitchen.lanes,
      pagination: {
        kitchen: kitchen.pagination,
        menu: menuData.pagination,
      },
    };
  },

  async getOrders(filters = {}) {
    const params = new URLSearchParams();

    params.set("page", String(filters.page || 1));
    params.set("limit", String(filters.limit || 20));

    if (filters.scope) params.set("scope", filters.scope);
    if (filters.status && filters.status !== "all") {
      params.set("status", filters.status.toUpperCase());
    }

    if (filters.search) params.set("search", filters.search);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    const response = await apiRequest(
      `/manager/orders?${params.toString()}`,
    );

    return unwrapData(response);
  },

  async getOrderDetails(orderId) {
    const response = await apiRequest(
      `/manager/orders/${encodeURIComponent(orderId)}`,
    );

    return unwrapData(response).order;
  },

  async updateOrderStatus(orderId, status, note = null) {
    const response = await apiRequest(
      `/manager/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PATCH",
        body: {
          status: status.toUpperCase(),
          ...(note ? { note } : {}),
        },
      },
    );

    return unwrapData(response);
  },

  async overrideEta(orderId, minutes, reason) {
    const response = await apiRequest(
      `/manager/orders/${encodeURIComponent(orderId)}/eta`,
      {
        method: "PATCH",
        body: {
          minutes,
          reason,
        },
      },
    );

    return unwrapData(response);
  },

  async updateAvailability(foodItemId, payload) {
    const response = await apiRequest(
      `/manager/menu-availability/${encodeURIComponent(foodItemId)}`,
      {
        method: "PATCH",
        body: payload,
      },
    );

    return unwrapData(response);
  },

  async getPerformance(range = "7d") {
    const response = await apiRequest(
      `/manager/performance?range=${encodeURIComponent(range)}`,
    );

    return unwrapData(response);
  },

  async getAccount() {
    const response = await apiRequest("/manager/account");
    return unwrapData(response);
  },

  async updateAccount(payload) {
    const response = await apiRequest("/manager/account", {
      method: "PATCH",
      body: payload,
    });

    return unwrapData(response);
  },
};
