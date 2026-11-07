export const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export function getPortionPrice(item, portion, effectivePrice) {
  const base = Number(item.basePrice || 0);
  const offset = Number(effectivePrice ?? base) - base;
  return Math.max(0, Number(portion?.price ?? effectivePrice ?? base) + offset);
}

export function cartLineKey(line) {
  return [
    line.outletId,
    line.itemId,
    line.portion,
    (line.addons || [])
      .map((addon) => addon.id || addon.name)
      .sort()
      .join("|"),
  ].join("::");
}

export function calculateCartTotals(
  cart,
  couponDiscount = 0,
  loyaltyDiscount = 0,
) {
  const subtotal = cart.reduce(
    (sum, item) =>
      sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
    0,
  );
  const deliveryFee = subtotal === 0 || subtotal >= 799 ? 0 : 35;
  const discount = Math.min(
    subtotal,
    Math.max(0, Number(couponDiscount) + Number(loyaltyDiscount)),
  );
  return {
    subtotal,
    couponDiscount: Math.min(subtotal, Math.max(0, Number(couponDiscount))),
    loyaltyDiscount: Math.min(
      Math.max(0, subtotal - Number(couponDiscount)),
      Math.max(0, Number(loyaltyDiscount)),
    ),
    deliveryFee,
    total: Math.max(0, subtotal - discount + deliveryFee),
    gstInclusive: true,
  };
}
