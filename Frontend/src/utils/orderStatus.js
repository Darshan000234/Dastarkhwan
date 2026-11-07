export const ORDER_STATUSES = [
  "Placed",
  "Accepted",
  "Preparing",
  "Ready",
  "Handed Off",
  "Cancelled",
];
export const PAYMENT_STATUSES = ["Pending", "Succeeded", "Failed", "Cancelled"];
export const NEXT_STATUS = {
  Placed: "Accepted",
  Accepted: "Preparing",
  Preparing: "Ready",
  Ready: "Handed Off",
};
export const statusClass = (status) =>
  String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-");
