import { useEffect, useState } from "react";
export function useOrderTimer() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
export function timerState(order, now = Date.now()) {
  const target = new Date(order.promisedAt).getTime();
  const diff = target - now;
  if (diff < 0) {
    const late = Math.floor(Math.abs(diff) / 60000);
    return {
      state: late >= 10 ? "critical" : "late",
      minutes: late,
      label: `${late}m late`,
    };
  }
  const minutes = Math.ceil(diff / 60000);
  return {
    state: minutes <= 5 ? "soon" : "normal",
    minutes,
    label: minutes <= 1 ? "Due now" : `${minutes}m left`,
  };
}
export function elapsedLabel(start, now = Date.now()) {
  const mins = Math.max(
    0,
    Math.floor((now - new Date(start).getTime()) / 60000),
  );
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
