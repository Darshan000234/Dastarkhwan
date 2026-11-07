import { Check, Circle } from "lucide-react";
const STEPS = ["Placed", "Accepted", "Preparing", "Ready", "Handed Off"];
export default function OrderTimeline({ order }) {
  const currentIndex = STEPS.indexOf(order.status);
  return (
    <div className="cu-timeline">
      {STEPS.map((step, index) => {
        const event = order.timeline?.find((entry) => entry.label === step);
        const done = index <= currentIndex;
        return (
          <div
            className={`cu-timeline-step ${done ? "is-done" : ""} ${index === currentIndex ? "is-current" : ""}`}
            key={step}
          >
            <span className="cu-timeline-marker">
              {done ? <Check size={13} /> : <Circle size={11} />}
            </span>
            <div>
              <strong>{step}</strong>
              <small>
                {event?.time ||
                  (index === currentIndex + 1 ? "Next step" : "Waiting")}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}
