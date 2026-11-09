import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  ChefHat,
  Clock3,
  Maximize2,
  PackageCheck,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Link } from "react-router-dom";
import socketClient from "../../../services/socketClient.js";
import { useManager } from "../../../context/ManagerContext";
import managerApi from "../../../services/managerApi";
import { useOrderTimer, timerState } from "../../../hooks/useOrderTimer";
import { Badge, Empty, Toast, timeOnly } from "../common/ManagerUI";
import KitchenOrderCard from "./KitchenOrderCard";
import ManagerOrderDetailsDrawer from "../orders/ManagerOrderDetailsDrawer";
import PreparationTimeOverride from "./PreparationTimeOverride";

function playAlert() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 740;
    gain.gain.value = 0.06;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.onended = () => context.close();
  } catch {
    // Audio is optional.
  }
}

export default function KitchenDisplayPage() {
  const {
    outlet,
    kitchenOrders,
    lateOrders,
    refreshKitchen,
    refresh,
  } = useManager();

  const now = useOrderTimer();

  const [sound, setSound] = useState(false);
  const [selected, setSelected] = useState(null);
  const [overrideOrder, setOverrideOrder] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState("success");
  const [fullScreen, setFullScreen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const previousNew = useRef(0);

  const lateIds = useMemo(
    () => new Set(lateOrders.map((order) => order.orderId)),
    [lateOrders],
  );

  const paidActive = useMemo(
    () =>
      kitchenOrders.filter(
        (order) =>
          order.rawPaymentStatus === "SUCCEEDED" &&
          ["PLACED", "ACCEPTED", "PREPARING", "READY"].includes(
            order.rawStatus,
          ),
      ),
    [kitchenOrders],
  );

  const columns = useMemo(
    () => ({
      new: paidActive
        .filter((order) => order.rawStatus === "PLACED")
        .sort(
          (a, b) =>
            new Date(a.placedAt) - new Date(b.placedAt),
        ),

      preparing: paidActive
        .filter((order) =>
          ["ACCEPTED", "PREPARING"].includes(order.rawStatus),
        )
        .sort(
          (a, b) =>
            new Date(a.promisedAt) - new Date(b.promisedAt),
        ),

      ready: paidActive
        .filter((order) => order.rawStatus === "READY")
        .sort(
          (a, b) =>
            new Date(a.promisedAt) - new Date(b.promisedAt),
        ),
    }),
    [paidActive],
  );

  const lateCount = paidActive.filter(
    (order) => lateIds.has(order.orderId),
  ).length;

  const criticalCount = paidActive.filter(
    (order) =>
      lateIds.has(order.orderId) &&
      timerState(order, now).minutes >= 10,
  ).length;

  useEffect(() => {
    if (sound && columns.new.length > previousNew.current) {
      playAlert();
    }

    previousNew.current = columns.new.length;
  }, [columns.new.length, sound]);

  const doAction = async (order, nextStatus) => {
    const databaseOrderId = order.orderId;

    if (!databaseOrderId) {
      setToast("The database order ID is missing. Refresh the kitchen.");
      setToastTone("error");
      return;
    }

    setBusyId(databaseOrderId);

    try {
      await managerApi.updateOrderStatus(
        databaseOrderId,
        nextStatus,
      );

      if (!socketClient.connected) {
  await refreshKitchen();
}

      setToast(`${order.id} moved to ${nextStatus}.`);
      setToastTone("success");
    } catch (error) {
      setToast(error.message || "Unable to update order status.");
      setToastTone("error");
    } finally {
      setBusyId("");
    }
  };

  const saveOverride = async (payload) => {
    if (!overrideOrder?.orderId) {
      throw new Error("The database order ID is missing.");
    }

    const result = await managerApi.overrideEta(
      overrideOrder.orderId,
      payload,
    );

    await refreshKitchen();

    // Re-fetch the order detail to show the server-authoritative ETA.
    const updated = await managerApi.getOrderDetails(
      overrideOrder.orderId,
    );

    setSelected(updated);
    setToast("Preparation estimate updated.");
    setToastTone("success");
    setOverrideOrder(null);

    return result;
  };

  const refreshData = async () => {
    setRefreshing(true);

    try {
      await refresh();
      setToast("Kitchen data refreshed.");
      setToastTone("success");
    } catch (error) {
      setToast(error.message || "Unable to refresh kitchen data.");
      setToastTone("error");
    } finally {
      setRefreshing(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        setFullScreen(true);
      } else {
        await document.exitFullscreen?.();
        setFullScreen(false);
      }
    } catch {
      setToast("Full-screen mode is not available on this device.");
      setToastTone("error");
    }
  };

  useEffect(() => {
    const handler = () => {
      setFullScreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handler);

    return () => {
      document.removeEventListener("fullscreenchange", handler);
    };
  }, []);

  return (
    <div className="om-kds-page">
      <header className="om-kds-header">
        <div className="om-kds-brand">
          <span>
            <ChefHat size={23} />
          </span>
          <div>
            <strong>Dastarkhwan</strong>
            <small>{outlet?.name} · Kitchen Display</small>
          </div>
        </div>

        <div className="om-kds-live">
          <i />
          Backend connected · Live refresh on demand
        </div>

        <div className="om-kds-header-right">
          <span>
            <Clock3 size={16} />
            {new Date(now).toLocaleTimeString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>

          <Badge tone={outlet?.active ? "success" : "danger"}>
            {outlet?.active ? "Outlet open" : "Outlet inactive"}
          </Badge>

          <button
            type="button"
            className="om-kds-icon"
            onClick={() => setSound((value) => !value)}
            title={sound ? "Mute new-order sound" : "Enable new-order sound"}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </button>

          <button
            type="button"
            className="om-kds-icon"
            onClick={toggleFullscreen}
            title={fullScreen ? "Exit full screen" : "Toggle full screen"}
          >
            <Maximize2 />
          </button>

          <Link to="/manager" className="om-kds-back">
            <ArrowLeft size={15} /> Dashboard
          </Link>
        </div>
      </header>

      <div className="om-kds-statusbar">
        <div>
          <strong>{paidActive.length}</strong>
          <span>Active paid orders</span>
        </div>

        <div>
          <strong>{columns.new.length}</strong>
          <span>New orders</span>
        </div>

        <div className={lateCount ? "late" : ""}>
          <strong>{lateCount}</strong>
          <span>Late orders</span>
        </div>

        <div className={criticalCount ? "critical" : ""}>
          <strong>{criticalCount}</strong>
          <span>10+ min late</span>
        </div>

        <button
          type="button"
          onClick={refreshData}
          disabled={refreshing}
        >
          <RefreshCw size={15} />
          {refreshing ? "Refreshing…" : "Refresh data"}
        </button>
      </div>

      {criticalCount > 0 && (
        <div className="om-kds-critical-banner">
          <Bell size={18} />
          <div>
            <strong>
              {criticalCount} critical late order
              {criticalCount === 1 ? "" : "s"}
            </strong>
            <span>
              These paid orders are at least 10 minutes past their
              promised completion time.
            </span>
          </div>
        </div>
      )}

      <div className="om-kds-columns">
        {[
          {
            key: "new",
            title: "NEW",
            subtitle: "Awaiting acceptance",
            icon: Bell,
            tone: "new",
          },
          {
            key: "preparing",
            title: "PREPARING",
            subtitle: "Accepted · on the line",
            icon: ChefHat,
            tone: "prep",
          },
          {
            key: "ready",
            title: "READY FOR HANDOFF",
            subtitle: "Prepared · waiting pickup",
            icon: PackageCheck,
            tone: "ready",
          },
        ].map((column) => {
          const Icon = column.icon;

          return (
            <section
              className={`om-kds-column ${column.tone}`}
              key={column.key}
            >
              <header>
                <div>
                  <span>
                    <Icon size={19} />
                  </span>
                  <div>
                    <h2>{column.title}</h2>
                    <small>{column.subtitle}</small>
                  </div>
                </div>

                <b>{columns[column.key].length}</b>
              </header>

              <div className="om-kds-column-body">
                {columns[column.key].length ? (
                  columns[column.key].map((order) => (
                    <KitchenOrderCard
                      key={order.orderId}
                      order={{
                        ...order,
                        isLate: lateIds.has(order.orderId),
                      }}
                      now={now}
                      busy={busyId === order.orderId}
                      onView={setSelected}
                      onAction={doAction}
                    />
                  ))
                ) : (
                  <Empty
                    title="Nothing in this queue"
                    detail="New paid orders will appear here after refreshing."
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>

      <ManagerOrderDetailsDrawer
        order={selected}
        onClose={() => setSelected(null)}
        onOverride={setOverrideOrder}
      />

      <PreparationTimeOverride
        order={overrideOrder}
        minimum={Number(outlet?.prepTime || 15)}
        onClose={() => setOverrideOrder(null)}
        onSave={saveOverride}
      />

      <Toast
        message={toast}
        tone={toastTone}
        onClose={() => setToast("")}
      />
    </div>
  );
}