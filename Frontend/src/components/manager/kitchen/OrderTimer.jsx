import { Clock3 } from "lucide-react";
import { timerState, elapsedLabel } from "../../../hooks/useOrderTimer";
export default function OrderTimer({ order, now }) {
  const timer = timerState(order, now);
  return (
    <div className={`om-order-clock ${timer.state}`}>
      <Clock3 size={17} />
      <strong>{timer.label}</strong>
      <small>Elapsed {elapsedLabel(order.placedAt, now)}</small>
    </div>
  );
}
