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
import { useManager } from "../../../context/ManagerContext";
import { mockOutletManagerApi } from "../../../services/mockOutletManagerApi";
import { useOrderTimer } from "../../../hooks/useOrderTimer";
import { timerState } from "../../../hooks/useOrderTimer";
import { Badge, Empty, Toast, timeOnly } from "../common/ManagerUI";
import KitchenOrderCard from "./KitchenOrderCard";
import ManagerOrderDetailsDrawer from "../orders/ManagerOrderDetailsDrawer";
import PreparationTimeOverride from "./PreparationTimeOverride";

function playAlert() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
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
    /* sound is optional; visual alerts remain available */
  }
}

export default function KitchenDisplayPage() {
  const { outlet, orders, run, refresh } = useManager();
  const now = useOrderTimer();
  const [sound, setSound] = useState(false);
  const [selected, setSelected] = useState(null);
  const [overrideOrder, setOverrideOrder] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState("success");
  const previousNew = useRef(0);
  const [fullScreen, setFullScreen] = useState(false);
  const paidActive = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.paymentStatus === "Succeeded" &&
          ["Placed", "Accepted", "Preparing", "Ready"].includes(order.status),
      ),
    [orders],
  );
  const columns = useMemo(
    () => ({
      new: paidActive
        .filter((order) => order.status === "Placed")
        .sort((a, b) => new Date(a.placedAt) - new Date(b.placedAt)),
      preparing: paidActive
        .filter((order) => ["Accepted", "Preparing"].includes(order.status))
        .sort((a, b) => new Date(a.promisedAt) - new Date(b.promisedAt)),
      ready: paidActive
        .filter((order) => order.status === "Ready")
        .sort(
          (a, b) =>
            new Date(a.readyAt || a.promisedAt) -
            new Date(b.readyAt || b.promisedAt),
        ),
    }),
    [paidActive],
  );
  const lateCount = paidActive.filter(
    (order) =>
      timerState(order, now).state === "late" ||
      timerState(order, now).state === "critical",
  ).length;
  const criticalCount = paidActive.filter(
    (order) => timerState(order, now).state === "critical",
  ).length;
  useEffect(() => {
    if (sound && columns.new.length > previousNew.current) playAlert();
    previousNew.current = columns.new.length;
  }, [columns.new.length, sound]);
  const doAction = async (order, next) => {
    setBusyId(order.id);
    try {
      await run(() => mockOutletManagerApi.updateOrderStatus(order.id, next));
      setToast(`${order.id} moved to ${next}.`);
      setToastTone("success");
    } catch (error) {
      setToast(error.message);
      setToastTone("error");
    } finally {
      setBusyId("");
    }
  };
  const saveOverride = async (payload) => {
    await run(() =>
      mockOutletManagerApi.overrideEta(overrideOrder.id, payload),
    );
    setToast(`Preparation estimate updated for ${overrideOrder.id}.`);
    setToastTone("success");
    setOverrideOrder(null);
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
    const handler = () => setFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
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
            <small>{outlet.name} · Kitchen Display</small>
          </div>
        </div>
        <div className="om-kds-live">
          <i />
          Demo mode · Updates simulated locally
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
          <Badge tone={outlet.active ? "success" : "danger"}>
            {outlet.active ? "Outlet open" : "Outlet inactive"}
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
            title="Toggle full screen"
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
          <span>Active orders</span>
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
          <span>10+ min critical</span>
        </div>
        <button type="button" onClick={refresh}>
          <RefreshCw size={15} /> Refresh data
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
              At least 10 minutes past the promised time. Customer notification
              is recorded in demo order history.
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
                      key={order.id}
                      order={order}
                      now={now}
                      busy={busyId === order.id}
                      onView={setSelected}
                      onAction={doAction}
                    />
                  ))
                ) : (
                  <Empty
                    title="Nothing in this queue"
                    detail="New activity will appear here automatically."
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
        minimum={Number(outlet.prepTime || 15)}
        onClose={() => setOverrideOrder(null)}
        onSave={saveOverride}
      />
      <Toast message={toast} tone={toastTone} onClose={() => setToast("")} />
    </div>
  );
}
