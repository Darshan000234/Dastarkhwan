import { adminApi } from "./adminApi";

export async function getEligibleOutlets(pincode) {
  const clean = String(pincode || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(clean)) return [];
  const outlets = await adminApi.getOutlets();
  return outlets
    .filter(
      (outlet) => outlet.active && (outlet.pincodes || []).includes(clean),
    )
    .sort(
      (a, b) =>
        Number(b.primaryPincode === clean) - Number(a.primaryPincode === clean),
    );
}

export async function checkServiceability(pincode) {
  const clean = String(pincode || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(clean))
    return {
      serviceable: false,
      reason: "Enter a valid six-digit pincode.",
      outlets: [],
    };
  const outlets = await getEligibleOutlets(clean);
  if (!outlets.length)
    return {
      serviceable: false,
      reason: "We do not have an active outlet serving this pincode yet.",
      outlets: [],
    };
  return {
    serviceable: true,
    pincode: clean,
    outlets,
    selectedOutlet: outlets[0],
  };
}

export async function getOutletById(outletId) {
  return adminApi.getOutletById(outletId);
}
