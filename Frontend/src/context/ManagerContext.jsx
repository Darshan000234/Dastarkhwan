import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./authContext.jsx";
import socketClient from "../services/socketClient.js";
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
  const { user, loading: authLoading } = useAuth();
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

  const refreshOverview = useCallback(async () => {
    const overviewData = await managerApi.getOverview({
      range: "today",
    });

    setWorkspace((current) => {
      if (!current) return current;

      return {
        ...current,
        overview: {
          ...current.overview,
          ...overviewData,

          // Preserve values maintained by the existing context.
          popular: current.overview?.popular || [],
          attention: current.overview?.attention || [],
        },
      };
    });

    return overviewData;
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
    if (authLoading || user?.role !== "outlet_manager") {
      return undefined;
    }

    refresh().catch(() => {
      // The error is exposed through context.
    });
  }, [authLoading, user?.id, user?.role, refresh]);

  useEffect(() => {
    if (authLoading || user?.role !== "outlet_manager") {
      return undefined;
    }

    let active = true;
    let reconnecting = false;

    const socket = socketClient.connect();

    const refreshKitchenAndOrders = async () => {
      try {
        await Promise.all([
          refreshKitchen(),
          refreshOrders(),
          refreshOverview(),
        ]);
      } catch (error) {
        if (active) {
          console.error(
            "Unable to refresh manager data after socket event:",
            error,
          );
        }
      }
    };

    const onOrderCreated = (payload) => {
      console.log(payload);

      if (!active) return;

      refreshKitchenAndOrders();
    };

    const onOrderStatusUpdated = () => {
      if (!active) return;

      Promise.all([refreshKitchen(), refreshOrders()]).catch((error) => {
        if (active) {
          console.error(
            "Unable to refresh manager data after order status update:",
            error,
          );
        }
      });
    };

    const onOrderEtaUpdated = () => {
      if (!active) return;

      refreshKitchenAndOrders();
    };

    const onMenuAvailabilityUpdated = async () => {
      if (!active) return;

      try {
        await refreshMenu();
      } catch (error) {
        if (active) {
          console.error(
            "Unable to refresh manager menu after socket event:",
            error,
          );
        }
      }
    };

    const onConnect = async () => {
      if (!active) return;

      // Initial connection is already followed by the initial
      // workspace refresh. Only reconnects need recovery refresh.
      if (reconnecting) {
        try {
          await refresh();
        } catch (error) {
          console.error(
            "Unable to restore manager workspace after reconnect:",
            error,
          );
        }
      }

      reconnecting = true;
    };

    const onDisconnect = () => {
      reconnecting = true;
    };

    socket.on("order:created", onOrderCreated);
    socket.on("order:status-updated", onOrderStatusUpdated);
    socket.on("order:eta-updated", onOrderEtaUpdated);
    socket.on("menu:availability-updated", onMenuAvailabilityUpdated);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      active = false;

      socket.off("order:created", onOrderCreated);
      socket.off("order:status-updated", onOrderStatusUpdated);
      socket.off("order:eta-updated", onOrderEtaUpdated);
      socket.off("menu:availability-updated", onMenuAvailabilityUpdated);

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);

      socketClient.disconnect();
    };
  }, [
    authLoading,
    user?.id,
    user?.role,
    refresh,
    refreshKitchen,
    refreshOrders,
    refreshOverview,
    refreshMenu,
  ]);
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
      refreshOverview,
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
      refreshOverview,
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
