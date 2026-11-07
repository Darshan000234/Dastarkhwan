import { Modal, StatusBadge, money, statusTone } from "../common/AdminUI";

export default function OrderDetailsDrawer({ order, outletName, onClose }) {
  const lateMinutes =
    order && order.status === "Preparing" && order.paymentStatus === "Succeeded"
      ? Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(order.promisedAt).getTime()) / 60000,
          ),
        )
      : 0;

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={`Order ${order?.id || ""}`}
      wide
    >
      {order && (
        <div className="ad-order-detail">
          <div className="ad-order-detail-top">
            <div>
              <span className="ad-eyebrow">CUSTOMER ORDER</span>
              <h3>{order.customer}</h3>
              <p>
                {order.phone} · {outletName}
              </p>
            </div>
            <StatusBadge tone={statusTone(order.status)}>
              {order.status}
            </StatusBadge>
          </div>
          <div className="ad-detail-grid">
            <div className="ad-detail-block">
              <span>Payment status</span>
              <strong>{order.paymentStatus}</strong>
              <small>{order.paymentMethod}</small>
            </div>
            <div className="ad-detail-block">
              <span>Order amount</span>
              <strong>{money(order.amount)}</strong>
              <small>GST inclusive</small>
            </div>
            <div className="ad-detail-block">
              <span>Placed at</span>
              <strong>{order.placedLabel}</strong>
              <small>
                {new Date(order.placedAt).toLocaleDateString("en-IN")}
              </small>
            </div>
            <div className="ad-detail-block">
              <span>Promised time</span>
              <strong>{order.promisedLabel}</strong>
              <small>{order.prepMinutes} min prep estimate</small>
            </div>
          </div>
          <h4>Items ordered</h4>
          <div className="ad-order-items">
            {order.items.map((item, index) => (
              <div key={`${item.name}-${index}`}>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    Qty {item.qty} · {money(item.price)} each
                    {item.portion ? ` · ${item.portion}` : ""}
                    {item.addons?.length
                      ? ` · Add-ons: ${item.addons.join(", ")}`
                      : ""}
                  </small>
                </span>
                <strong>{money(item.price * item.qty)}</strong>
              </div>
            ))}
          </div>
          <div className="ad-gst-breakdown">
            <div>
              <span>Order total (GST inclusive)</span>
              <strong>{money(order.amount)}</strong>
            </div>
            <div>
              <span>Included GST component (5%)</span>
              <strong>{money(order.amount - order.amount / 1.05)}</strong>
            </div>
            <small>
              GST is already included in displayed menu prices. This is an
              informational split only; no additional tax is added to the order.
            </small>
          </div>
          <div className="ad-order-total">
            <span>Customer payable · no additional GST</span>
            <strong>{money(order.amount)}</strong>
          </div>
          {order.instructions && (
            <p className="ad-instructions">
              <strong>Special instructions:</strong> {order.instructions}
            </p>
          )}
          <h4>Order timeline</h4>
          <div className="ad-timeline">
            {order.timeline.map((event, index) => (
              <div key={`${event.label}-${index}`}>
                <i />
                <span>
                  <strong>{event.label}</strong>
                  <small>{event.time}</small>
                </span>
              </div>
            ))}
          </div>
          {lateMinutes > 0 && (
            <div className="ad-inline-warning">
              Late by approximately {lateMinutes} minute
              {lateMinutes === 1 ? "" : "s"}. The Outlet Manager owns
              kitchen-stage updates.
            </div>
          )}
          {order.paymentStatus === "Failed" && (
            <div className="ad-inline-warning">
              Payment failed. This order is cancelled and must not be treated as
              a successfully placed kitchen order.
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
