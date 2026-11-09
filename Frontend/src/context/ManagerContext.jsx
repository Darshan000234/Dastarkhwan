import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import managerApi from "../services/managerApi.js";

const ManagerContext = createContext(null);

function buildAttention({ kitchenOrders, lateOrders, menu }) {
  const alerts = [];

  kitchenOrders
    .filter((order) => order.rawStatus === "PLACED")
    .forEach((order) => {
      alerts.push({
        id: `new-${order.orderId}`,
        tone: "warning",
        title: `New order ${order.id}`,
        detail: `${order.customer} · awaiting acceptance`,
        orderId: order.id,
      });
    });

  lateOrders.forEach((order) => {
    alerts.push({
      id: `late-${order.orderId}`,
      tone: "danger",
      title: `${order.id} is late`,
      detail: `${order.lateMinutes || 0} minutes past promised time`,
      orderId: order.id,
    });
  });

  menu
    .filter((item) => !item.mapping?.available)
    .forEach((item) => {
      alerts.push({
        id: `menu-${item.id}`,
        tone: "neutral",
        title: `${item.name} unavailable`,
        detail: item.mapping?.availabilityReason || "Currently unavailable",
      });
    });

  return alerts;
}

export function ManagerProvider({ children }) {
  const [workspace, setWorkspace] = useState(null);

  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [lateOrders, setLateOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      const [
        workspaceData,
        overviewData,
        orderData,
        kitchenData,
        lateData,
        menuData,
        performanceData,
        accountData,
      ] = await Promise.all([
        managerApi.getWorkspace(),
        managerApi.getOverview({ range: "today" }),
        managerApi.getOrders({
          page: 1,
          limit: 10,
          sortBy: "placedAt",
          sortOrder: "desc",
        }),
        managerApi.getAllKitchenOrders(),
        managerApi.getAllLateOrders(),
        managerApi.getAllMenuAvailability(),
        managerApi.getPerformance("today"),
        managerApi.getAccount(),
      ]);

      const nextOrders = orderData.orders || [];
      const nextKitchenOrders = kitchenData.orders || [];
      const nextLateOrders = lateData.orders || [];
      const nextMenu = menuData.menuItems || [];

      const manager = accountData.manager || workspaceData.manager;

      const outlet = {
        ...(workspaceData.outlet || {}),
        prepTime:
          workspaceData.outlet?.minimumPrepMinutes ??
          workspaceData.outlet?.prepTime ??
          15,
        manager,
      };

      const attention = buildAttention({
        kitchenOrders: nextKitchenOrders,
        lateOrders: nextLateOrders,
        menu: nextMenu,
      });

      const overview = {
        ...overviewData,
        popular: performanceData.popular || [],
        attention,
      };

      setOrders(nextOrders);
      setKitchenOrders(nextKitchenOrders);
      setLateOrders(nextLateOrders);
      setMenu(nextMenu);

      setWorkspace({
        ...workspaceData,
        manager,
        outlet,
        overview,
        menuSummary: workspaceData.menu || {},
        account: accountData,
        kitchenPagination: kitchenData.pagination || null,
        latePagination: lateData.pagination || null,
        orderPagination: orderData.pagination || null,
        menuPagination: menuData.pagination || null,
      });

      setError("");

      return {
        workspace: workspaceData,
        orders: nextOrders,
        kitchenOrders: nextKitchenOrders,
        lateOrders: nextLateOrders,
        menu: nextMenu,
      };
    } catch (err) {
      setError(err.message || "Unable to load manager workspace.");
      throw err;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshKitchen = useCallback(async () => {
    const [kitchenData, lateData] = await Promise.all([
      managerApi.getAllKitchenOrders(),
      managerApi.getAllLateOrders(),
    ]);

    const nextKitchenOrders = kitchenData.orders || [];
    const nextLateOrders = lateData.orders || [];

    setKitchenOrders(nextKitchenOrders);
    setLateOrders(nextLateOrders);

    setWorkspace((current) => {
      if (!current) return current;

      const attention = buildAttention({
        kitchenOrders: nextKitchenOrders,
        lateOrders: nextLateOrders,
        menu,
      });

      return {
        ...current,
        overview: {
          ...current.overview,
          attention,
        },
        kitchenPagination: kitchenData.pagination || null,
        latePagination: lateData.pagination || null,
      };
    });

    return {
      orders: nextKitchenOrders,
      lateOrders: nextLateOrders,
    };
  }, [menu]);

  const refreshOrders = useCallback(async () => {
    const data = await managerApi.getOrders({
      page: 1,
      limit: 10,
      sortBy: "placedAt",
      sortOrder: "desc",
    });

    const nextOrders = data.orders || [];

    setOrders(nextOrders);

    return nextOrders;
  }, []);

  const refreshMenu = useCallback(async () => {
    const data = await managerApi.getAllMenuAvailability();
    const nextMenu = data.menuItems || [];

    setMenu(nextMenu);

    setWorkspace((current) => {
      if (!current) return current;

      return {
        ...current,
        menuSummary: data.summary || current.menuSummary,
        menuPagination: data.pagination || null,
        overview: {
          ...current.overview,
          attention: buildAttention({
            kitchenOrders,
            lateOrders,
            menu: nextMenu,
          }),
        },
      };
    });

    return nextMenu;
  }, [kitchenOrders, lateOrders]);

  const run = useCallback(
    async (action, refreshTarget = "all") => {
      /*
       * Never update the UI optimistically. If the mutation fails,
       * action rejects and no success refresh/message is implied.
       */
      const result = await action();

      if (refreshTarget === "kitchen") {
        await refreshKitchen();
      } else if (refreshTarget === "orders") {
        await refreshOrders();
      } else if (refreshTarget === "menu") {
        await refreshMenu();
      } else {
        await refresh();
      }

      return result;
    },
    [refresh, refreshKitchen, refreshMenu, refreshOrders],
  );

  useEffect(() => {
    refresh().catch(() => {
      // The error is exposed through context.
    });
  }, [refresh]);

  const value = useMemo(
    () => ({
      ...workspace,

      loading,
      refreshing,
      error,

      manager: workspace?.manager || null,
      outlet: workspace?.outlet || null,
      overview: workspace?.overview || null,

      orders,
      menu,
      kitchenOrders,
      lateOrders,

      refresh,
      refreshKitchen,
      refreshOrders,
      refreshMenu,
      run,
    }),
    [
      workspace,
      loading,
      refreshing,
      error,
      orders,
      menu,
      kitchenOrders,
      lateOrders,
      refresh,
      refreshKitchen,
      refreshOrders,
      refreshMenu,
      run,
    ],
  );

  return (
    <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>
  );
}

export function useManager() {
  const context = useContext(ManagerContext);

  if (!context) {
    throw new Error("useManager must be used inside ManagerProvider.");
  }

  return context;
}
