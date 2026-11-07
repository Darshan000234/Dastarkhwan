import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { mockCustomerApi } from "../services/mockCustomerApi";
import { cartLineKey } from "../utils/customerPricing";
import { subscribeMockApi } from "../services/mockApi";

const CustomerContext = createContext(null);

export function CustomerProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [outlets, setOutlets] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({});
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [selectedPincode, setSelectedPincode] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("");
  const [cart, setCart] = useState([]);
  const [couponCode, setCouponCode] = useState(null);
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(0);
  const [loyalty, setLoyalty] = useState({ balance: 0, transactions: [], awardedOrderIds: [] });
  const [pendingLocation, setPendingLocation] = useState(null);
  const [locationChoices, setLocationChoices] = useState([]);
  const [toast, setToast] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mockCustomerApi.getBootstrap();
      setOutlets(data.outlets || []); setCatalog(data.catalog || []); setOrders(data.orders || []); setSettings(data.settings || {});
      setProfile(data.profile); setAddresses(data.addresses || []); setSelectedAddressId(data.selectedAddressId || data.addresses?.find((a) => a.isDefault)?.id || null);
      setSelectedPincode(data.selectedPincode || ""); setSelectedOutletId(data.selectedOutletId || ""); setCart(data.cart || []);
      setCouponCode(data.couponCode || null); setLoyaltyRedeemPoints(data.loyaltyRedeemPoints || 0); setLoyalty(data.loyalty || { balance: 0, transactions: [], awardedOrderIds: [] });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Keep an already-open customer tab in sync with manager/admin mutations to
  // the shared outlet, menu and order store. No network transport is involved.
  useEffect(() => {
    let alive = true;
    const syncShared = async () => {
      try {
        const data = await mockCustomerApi.getBootstrap();
        if (!alive) return;
        setOutlets(data.outlets || []); setCatalog(data.catalog || []); setOrders(data.orders || []); setSettings(data.settings || {});
      } catch { /* retain the last known customer state */ }
    };
    const unsubscribe = subscribeMockApi(syncShared);
    return () => { alive = false; unsubscribe(); };
  }, []);

  const persist = useCallback((patch) => mockCustomerApi.saveCustomerState(patch), []);
  const notify = useCallback((message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const commitOutlet = useCallback(async (outlet, pincode, clearCart = false) => {
    if (!outlet) return;
    const nextCart = clearCart ? [] : cart;
    setSelectedPincode(pincode); setSelectedOutletId(outlet.id);
    if (clearCart) { setCart([]); setCouponCode(null); setLoyaltyRedeemPoints(0); }
    await persist({ selectedPincode: pincode, selectedOutletId: outlet.id, ...(clearCart ? { cart: [], couponCode: null, loyaltyRedeemPoints: 0 } : {}) });
    setPendingLocation(null); setLocationChoices([]);
    notify(`Delivery outlet set to ${outlet.name}.`);
    return nextCart;
  }, [cart, persist, notify]);

  const requestLocation = useCallback(async (pincode) => {
    const result = await mockCustomerApi.checkServiceability(pincode);
    if (!result.serviceable) { notify(result.reason, "error"); return result; }
    if (cart.length && selectedOutletId && result.outlets.every((outlet) => outlet.id !== selectedOutletId)) {
      setPendingLocation({ pincode: result.pincode, outlets: result.outlets });
      return { ...result, requiresCartConfirmation: true };
    }
    setLocationChoices(result.outlets);
    if (result.outlets.length === 1) await commitOutlet(result.outlets[0], result.pincode);
    else if (result.outlets.some((outlet) => outlet.id === selectedOutletId)) await commitOutlet(result.outlets.find((outlet) => outlet.id === selectedOutletId), result.pincode);
    else await commitOutlet(result.selectedOutlet, result.pincode);
    if (result.outlets.length > 1) setLocationChoices(result.outlets);
    return result;
  }, [cart.length, selectedOutletId, commitOutlet, notify]);

  const chooseOutlet = useCallback(async (outletId) => {
    const outlet = locationChoices.find((entry) => entry.id === outletId) || outlets.find((entry) => entry.id === outletId);
    if (!outlet || !outlet.active) return;
    const targetPincode = pendingLocation?.pincode || selectedPincode;
    if (cart.length && selectedOutletId !== outlet.id) {
      setPendingLocation({ pincode: targetPincode, outlets: [outlet] });
      return;
    }
    await commitOutlet(outlet, targetPincode);
  }, [locationChoices, outlets, cart.length, selectedOutletId, selectedPincode, pendingLocation, commitOutlet]);

  const confirmLocationSwitch = useCallback(async () => {
    if (!pendingLocation?.outlets?.length) return;
    await commitOutlet(pendingLocation.outlets[0], pendingLocation.pincode, true);
  }, [pendingLocation, commitOutlet]);
  const cancelLocationSwitch = useCallback(() => setPendingLocation(null), []);

  const addToCart = useCallback(async (line) => {
    if (!selectedOutletId) { notify("Enter your delivery pincode before adding food.", "error"); return false; }
    if (line.outletId !== selectedOutletId) { notify("This dish belongs to another outlet.", "error"); return false; }
    const item = await mockCustomerApi.getMenuItemById(line.itemId, selectedOutletId);
    if (!item?.mapping?.available) { notify("This dish is currently unavailable.", "error"); return false; }
    if (cart.some((entry) => entry.outletId !== selectedOutletId)) { notify("A cart can contain items from one outlet only.", "error"); return false; }
    const key = cartLineKey(line);
    const existing = cart.find((entry) => cartLineKey(entry) === key);
    const next = existing
      ? cart.map((entry) => cartLineKey(entry) === key ? { ...entry, quantity: entry.quantity + line.quantity } : entry)
      : [...cart, line];
    const validation = await mockCustomerApi.validateCart(next, selectedOutletId);
    if (!validation.valid) { notify(validation.errors.join(" "), "error"); return false; }
    setCart(next); await persist({ cart: next }); notify(`${line.name} added to your cart.`); return true;
  }, [selectedOutletId, cart, persist, notify]);

  const changeQuantity = useCallback(async (key, delta) => {
    const next = cart.map((line) => cartLineKey(line) === key ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line);
    const validation = await mockCustomerApi.validateCart(next, selectedOutletId);
    if (!validation.valid) { notify(validation.errors.join(" "), "error"); return false; }
    setCart(next); await persist({ cart: next }); return true;
  }, [cart, selectedOutletId, persist, notify]);
  const removeCartLine = useCallback(async (key) => {
    const next = cart.filter((line) => cartLineKey(line) !== key);
    setCart(next); await persist({ cart: next });
  }, [cart, persist]);
  const clearCart = useCallback(async () => { setCart([]); setCouponCode(null); setLoyaltyRedeemPoints(0); await persist({ cart: [], couponCode: null, loyaltyRedeemPoints: 0 }); }, [persist]);
  const applyCoupon = useCallback(async (code) => {
    const result = await mockCustomerApi.applyCoupon(code, cart, selectedOutletId);
    setCouponCode(result.coupon.code); await persist({ couponCode: result.coupon.code }); notify(`${result.coupon.code} applied. You save ₹${Math.round(result.discount)}.`); return result;
  }, [cart, selectedOutletId, persist, notify]);
  const removeCoupon = useCallback(async () => { setCouponCode(null); await persist({ couponCode: null }); }, [persist]);
  const setRedeemPoints = useCallback(async (points) => { const safe = Math.max(0, Math.min(Number(points || 0), loyalty.balance)); setLoyaltyRedeemPoints(safe); await persist({ loyaltyRedeemPoints: safe }); }, [loyalty.balance, persist]);

  const saveProfile = useCallback(async (patch) => { const updated = await mockCustomerApi.updateProfile(patch); setProfile(updated); notify("Profile updated."); return updated; }, [notify]);
  const saveAddress = useCallback(async (payload, id) => {
    const updated = id ? await mockCustomerApi.updateAddress(id, payload) : await mockCustomerApi.addAddress(payload);
    const data = await mockCustomerApi.getBootstrap();
    setAddresses(data.addresses);
    if (!id || updated.isDefault) {
      setSelectedAddressId(updated.id);
      await persist({ selectedAddressId: updated.id });
    }
    notify(id ? "Address updated." : "Address saved.");
    return updated;
  }, [notify, persist]);
  const deleteAddress = useCallback(async (id) => {
    await mockCustomerApi.deleteAddress(id);
    const data = await mockCustomerApi.getBootstrap();
    setAddresses(data.addresses);
    setSelectedAddressId(data.selectedAddressId);
    const replacement = data.addresses.find((entry) => entry.id === data.selectedAddressId);
    if (replacement?.pincode && replacement.pincode !== selectedPincode) await requestLocation(replacement.pincode);
    notify("Address removed.");
  }, [notify, selectedPincode, requestLocation]);
  const setDefaultAddress = useCallback(async (id) => { await mockCustomerApi.setDefaultAddress(id); setAddresses((rows) => rows.map((entry) => ({ ...entry, isDefault: entry.id === id }))); setSelectedAddressId(id); const address = addresses.find((entry) => entry.id === id); if (address?.pincode && address.pincode !== selectedPincode) await requestLocation(address.pincode); notify("Default address updated."); }, [notify, addresses, selectedPincode, requestLocation]);
  const selectAddress = useCallback(async (id) => {
    const address = addresses.find((entry) => entry.id === id);
    if (!address) return;
    setSelectedAddressId(id); await persist({ selectedAddressId: id });
    if (address.pincode !== selectedPincode) await requestLocation(address.pincode);
  }, [addresses, selectedPincode, persist, requestLocation]);

  const refreshOrders = useCallback(async () => setOrders(await mockCustomerApi.getCustomerOrders()), []);
  const refreshLoyalty = useCallback(async () => setLoyalty(await mockCustomerApi.getLoyalty()), []);

  const value = useMemo(() => ({
    loading, outlets, catalog, orders, settings, profile, addresses, selectedAddressId, selectedPincode, selectedOutletId, cart, couponCode, loyaltyRedeemPoints, loyalty,
    pendingLocation, locationChoices, toast, setToast, refresh, requestLocation, chooseOutlet, confirmLocationSwitch, cancelLocationSwitch,
    addToCart, changeQuantity, removeCartLine, clearCart, applyCoupon, removeCoupon, setRedeemPoints,
    saveProfile, saveAddress, deleteAddress, setDefaultAddress, selectAddress, refreshOrders, refreshLoyalty, notify,
  }), [loading, outlets, catalog, orders, settings, profile, addresses, selectedAddressId, selectedPincode, selectedOutletId, cart, couponCode, loyaltyRedeemPoints, loyalty, pendingLocation, locationChoices, toast, refresh, requestLocation, chooseOutlet, confirmLocationSwitch, cancelLocationSwitch, addToCart, changeQuantity, removeCartLine, clearCart, applyCoupon, removeCoupon, setRedeemPoints, saveProfile, saveAddress, deleteAddress, setDefaultAddress, selectAddress, refreshOrders, refreshLoyalty, notify]);

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer() {
  const value = useContext(CustomerContext);
  if (!value) throw new Error("useCustomer must be used inside CustomerProvider.");
  return value;
}
