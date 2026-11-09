import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import socketClient from "../services/socketClient.js";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "./authContext.jsx";
import customerApi from "../services/customerApi.js";
import { cartLineKey } from "../utils/customerPricing.js";

const CustomerContext = createContext(null);
const EMPTY_CATALOG = Object.freeze([]);

const EMPTY_LOYALTY = {
  balance: 0,
  lifetimeEarned: 0,
  lifetimeRedeemed: 0,
  redemption: {
    pointsPerRupee: 10,
    pointsPerReward: 100,
    rewardValue: 10,
    maximumSubtotalPercentage: 25,
  },
  transactions: [],
};

function addressPayload(payload) {
  return {
    name: payload.name,
    phone: payload.phone,
    pincode: payload.pincode,
    house: payload.house,
    street: payload.street,
    landmark: payload.landmark || "",
    city: payload.city,
    type: payload.type,
    isDefault: Boolean(payload.isDefault),
  };
}

function mergeValidatedLines(originalLines, serverItems, outletId) {
  return originalLines.map((line, index) => {
    const serverLine = serverItems[index];

    if (!serverLine) {
      return line;
    }

    return {
      ...line,
      name: serverLine.name || line.name,
      category: serverLine.category || line.category,
      image: serverLine.image || line.image,
      quantity: serverLine.quantity,
      portionId: serverLine.portionId || line.portionId,
      portion: serverLine.portion || line.portion,
      addons: serverLine.addons || line.addons,
      unitPrice: Number(serverLine.unitPrice || 0),
      lineTotal: Number(serverLine.lineTotal || 0),
      outletId,
    };
  });
}

export function CustomerProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, loading: authLoading, logout } = useAuth();

  const [bootstrapState, setBootstrapState] = useState({
    userId: null,
    status: "pending",
  });

  const [loadError, setLoadError] = useState("");

  const [outlets, setOutlets] = useState([]);
  const catalog = EMPTY_CATALOG;
  const [orders, setOrders] = useState([]);
  const [settings] = useState({});

  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  const [selectedPincode, setSelectedPincode] = useState("");
  const [selectedOutletId, setSelectedOutletId] = useState("");

  const [cart, setCart] = useState([]);
  const [cartQuote, setCartQuote] = useState(null);

  const [couponCode, setCouponCode] = useState(null);
  const [loyaltyRedeemPoints, setLoyaltyRedeemPoints] = useState(0);
  const [loyalty, setLoyalty] = useState(EMPTY_LOYALTY);

  const [checkoutDraft, setCheckoutDraft] = useState(null);

  const [pendingLocation, setPendingLocation] = useState(null);
  const [locationChoices, setLocationChoices] = useState([]);
  const [locationChoicePincode, setLocationChoicePincode] = useState("");

  const [cateringEnquiries, setCateringEnquiries] = useState([]);

  const [toast, setToast] = useState(null);

  const loading =
    authLoading ||
    (user?.role === "customer" &&
      !(
        bootstrapState.userId === user.id &&
        ["ready", "error"].includes(bootstrapState.status)
      ));

  const notify = useCallback((message, type = "success") => {
    setToast({
      message,
      type,
      id: Date.now(),
    });
  }, []);

  const redirectToLogin = useCallback(() => {
    navigate("/login", {
      replace: true,
      state: {
        from: location,
      },
    });
  }, [navigate, location]);

  const withCustomerAuth = useCallback(
    async (request) => {
      if (!user || user.role !== "customer") {
        redirectToLogin();
        throw new Error("Sign in with a customer account to continue.");
      }

      try {
        return await request();
      } catch (error) {
        if (error.status === 401) {
          try {
            await logout();
          } catch {
            // The local authentication state is cleared by AuthContext.
          }

          redirectToLogin();
        }

        throw error;
      }
    },
    [user, redirectToLogin, logout],
  );

  /* ======================================================
     BOOTSTRAP
  ====================================================== */

  const loadCustomerData = useCallback(async () => {
    const [bootstrap, ordersData, rewards, rewardTransactions] =
      await Promise.all([
        customerApi.getBootstrap(),
        customerApi.getOrders({ page: 1, limit: 100 }),
        customerApi.getRewards(),
        customerApi.getRewardTransactions({
          page: 1,
          limit: 100,
        }),
      ]);

    return {
      bootstrap,
      ordersData,
      rewards,
      rewardTransactions,
    };
  }, []);

  const applyCustomerData = useCallback((result) => {
    const { bootstrap, ordersData, rewards, rewardTransactions } = result;

    setProfile(bootstrap.profile || null);
    setAddresses(bootstrap.addresses || []);

    setSelectedAddressId(
      bootstrap.selectedAddressId ||
        bootstrap.addresses?.find((address) => address.isDefault)?.id ||
        null,
    );

    setSelectedPincode(bootstrap.selectedPincode || "");
    setSelectedOutletId(bootstrap.selectedOutletId || "");

    setOutlets(bootstrap.serviceableOutlets || []);

    setOrders(ordersData.orders || []);

    setLoyalty({
      ...EMPTY_LOYALTY,
      ...rewards,
      transactions: rewardTransactions.transactions || [],
    });

    setLoadError("");
  }, []);

  useEffect(() => {
    if (authLoading || user?.role !== "customer") {
      return undefined;
    }

    let active = true;

    loadCustomerData()
      .then((result) => {
        if (!active) return;

        applyCustomerData(result);

        setBootstrapState({
          userId: user.id,
          status: "ready",
        });
      })
      .catch(async (error) => {
        if (!active) return;

        setLoadError(error.message || "Unable to load customer data.");

        setBootstrapState({
          userId: user.id,
          status: "error",
        });

        if (error.status === 401) {
          try {
            await logout();
          } catch {
            // AuthContext clears the user in finally.
          }

          redirectToLogin();
        }
      });

    return () => {
      active = false;
    };
  }, [
    authLoading,
    user?.id,
    user?.role,
    loadCustomerData,
    applyCustomerData,
    logout,
    redirectToLogin,
  ]);
  const refresh = useCallback(async () => {
    const result = await withCustomerAuth(loadCustomerData);

    applyCustomerData(result);

    setBootstrapState({
      userId: user.id,
      status: "ready",
    });

    return result.bootstrap;
  }, [withCustomerAuth, loadCustomerData, applyCustomerData, user]);

  /* ======================================================
     LOCATION AND OUTLET SELECTION
  ====================================================== */

  const commitOutlet = useCallback(
    async (outlet, pincode, clearCart = false) => {
      if (!outlet?.id || !pincode) {
        throw new Error("A valid outlet and pincode are required.");
      }

      setSelectedPincode(pincode);
      setSelectedOutletId(outlet.id);

      if (clearCart) {
        setCart([]);
        setCartQuote(null);
        setCouponCode(null);
        setLoyaltyRedeemPoints(0);
        setCheckoutDraft(null);
      }

      setPendingLocation(null);
      setLocationChoices([]);
      setLocationChoicePincode("");

      notify(`Delivery outlet set to ${outlet.name}.`);
    },
    [notify],
  );

  const requestLocation = useCallback(
    async (pincode) => {
      if (!/^[1-9]\d{5}$/.test(String(pincode || ""))) {
        const message = "Enter a valid six-digit Indian pincode.";
        notify(message, "error");

        return {
          serviceable: false,
          pincode,
          outlets: [],
          reason: message,
        };
      }

      let result;

      try {
        result = await customerApi.getServiceability(pincode);
      } catch (error) {
        notify(error.message || "Unable to check this pincode.", "error");

        return {
          serviceable: false,
          pincode,
          outlets: [],
          reason: error.message,
        };
      }

      const eligibleOutlets = result.outlets || [];

      setOutlets(eligibleOutlets);
      setLocationChoices(eligibleOutlets);
      setLocationChoicePincode(result.pincode);

      if (!result.serviceable || eligibleOutlets.length === 0) {
        notify(
          result.reason || "No active outlet currently serves this pincode.",
          "error",
        );

        return result;
      }

      const existingOutlet = eligibleOutlets.find(
        (outlet) => outlet.id === selectedOutletId,
      );

      if (existingOutlet) {
        await commitOutlet(existingOutlet, result.pincode);

        if (eligibleOutlets.length > 1) {
          setLocationChoices(eligibleOutlets);
          setLocationChoicePincode(result.pincode);
        }

        return result;
      }

      if (cart.length > 0 && selectedOutletId) {
        if (eligibleOutlets.length === 1) {
          setPendingLocation({
            pincode: result.pincode,
            outlets: [eligibleOutlets[0]],
          });

          return {
            ...result,
            requiresCartConfirmation: true,
          };
        }

        // Multiple outlets are shown in the existing location modal.
        // The customer chooses one before the cart-switch prompt.
        return result;
      }

      if (eligibleOutlets.length === 1) {
        await commitOutlet(eligibleOutlets[0], result.pincode);
      }

      return result;
    },
    [selectedOutletId, cart.length, commitOutlet, notify],
  );

  const chooseOutlet = useCallback(
    async (outletId) => {
      const outlet =
        locationChoices.find((entry) => entry.id === outletId) ||
        outlets.find((entry) => entry.id === outletId);

      if (!outlet || !outlet.active) {
        throw new Error("Choose an outlet returned by serviceability.");
      }

      const targetPincode =
        locationChoicePincode || pendingLocation?.pincode || selectedPincode;

      if (!targetPincode) {
        throw new Error("Check a delivery pincode first.");
      }

      if (cart.length && selectedOutletId && selectedOutletId !== outlet.id) {
        setPendingLocation({
          pincode: targetPincode,
          outlets: [outlet],
        });

        return false;
      }

      await commitOutlet(outlet, targetPincode);

      return true;
    },
    [
      locationChoices,
      outlets,
      locationChoicePincode,
      pendingLocation,
      selectedPincode,
      cart.length,
      selectedOutletId,
      commitOutlet,
    ],
  );

  const confirmLocationSwitch = useCallback(async () => {
    const outlet = pendingLocation?.outlets?.[0];

    if (!outlet || !pendingLocation?.pincode) {
      return;
    }

    await commitOutlet(outlet, pendingLocation.pincode, true);
  }, [pendingLocation, commitOutlet]);

  const cancelLocationSwitch = useCallback(() => {
    setPendingLocation(null);
  }, []);

  /* ======================================================
     CART PAYLOAD
  ====================================================== */

  const buildCartPayload = useCallback(
    (lines = cart, options = {}) => {
      const addressId =
        options.addressId !== undefined ? options.addressId : selectedAddressId;

      const nextCoupon = Object.prototype.hasOwnProperty.call(
        options,
        "couponCode",
      )
        ? options.couponCode
        : couponCode;

      const nextPoints =
        options.loyaltyPoints !== undefined
          ? options.loyaltyPoints
          : loyaltyRedeemPoints;

      const payload = {
        outletId: options.outletId || selectedOutletId,
        items: lines.map((line) => ({
          itemId: line.itemId,
          outletId: line.outletId,
          quantity: line.quantity,
          ...(line.portionId ? { portionId: line.portionId } : {}),
          ...(line.portion ? { portion: line.portion } : {}),
          addons: (line.addons || []).map((addon) => ({
            id: addon.id,
            name: addon.name,
          })),
          ...(line.specialNote ? { specialNote: line.specialNote } : {}),
        })),
        fulfillmentType: "DELIVERY",
        loyaltyPoints: nextPoints,
      };

      if (addressId) payload.addressId = addressId;
      if (nextCoupon) payload.couponCode = nextCoupon;

      if (options.instructions !== undefined) {
        payload.instructions = options.instructions;
      }

      return payload;
    },
    [
      cart,
      selectedAddressId,
      selectedOutletId,
      couponCode,
      loyaltyRedeemPoints,
    ],
  );

  const validateCart = useCallback(
    async (lines = cart, options = {}) => {
      const payload = buildCartPayload(lines, options);

      return withCustomerAuth(() =>
        customerApi.validateCart({
          outletId: payload.outletId,
          addressId: payload.addressId,
          items: payload.items,
          fulfillmentType: payload.fulfillmentType,
        }),
      );
    },
    [cart, buildCartPayload, withCustomerAuth],
  );

  const refreshQuote = useCallback(
    async (options = {}) => {
      if (!cart.length) {
        setCartQuote(null);
        return null;
      }

      const payload = buildCartPayload(cart, options);

      const result = await withCustomerAuth(() =>
        customerApi.quoteCart(payload),
      );

      setCartQuote(result);

      return result;
    },
    [cart, buildCartPayload, withCustomerAuth],
  );

  /* ======================================================
     CART OPERATIONS
  ====================================================== */

  const addToCart = useCallback(
    async (line) => {
      if (!user || user.role !== "customer") {
        redirectToLogin();
        return false;
      }

      if (!selectedOutletId) {
        notify("Enter your delivery pincode before adding food.", "error");
        return false;
      }

      if (line.outletId !== selectedOutletId) {
        notify("This dish belongs to another outlet.", "error");
        return false;
      }

      try {
        const detail = await withCustomerAuth(() =>
          customerApi.getMenuItem(line.itemId, {
            pincode: selectedPincode,
            outletId: selectedOutletId,
          }),
        );

        const currentItem = detail.item;

        if (!currentItem?.mapping?.available) {
          notify(
            currentItem?.availabilityReason ||
              "This dish is currently unavailable.",
            "error",
          );

          return false;
        }

        const key = cartLineKey(line);
        const existing = cart.find((entry) => cartLineKey(entry) === key);

        const nextCart = existing
          ? cart.map((entry) =>
              cartLineKey(entry) === key
                ? {
                    ...entry,
                    quantity: entry.quantity + line.quantity,
                  }
                : entry,
            )
          : [...cart, line];

        if (nextCart.some((entry) => entry.outletId !== selectedOutletId)) {
          notify("A cart can contain items from one outlet only.", "error");

          return false;
        }

        const validation = await validateCart(nextCart);

        if (validation.valid !== true) {
          notify("The backend could not validate your cart.", "error");
          return false;
        }

        const validatedCart = mergeValidatedLines(
          nextCart,
          validation.items || [],
          selectedOutletId,
        );

        setCart(validatedCart);
        setCartQuote(null);

        notify(`${line.name} added to your cart.`);

        return true;
      } catch (error) {
        notify(error.message || "Unable to add this item.", "error");
        return false;
      }
    },
    [
      user,
      redirectToLogin,
      selectedOutletId,
      selectedPincode,
      cart,
      withCustomerAuth,
      validateCart,
      notify,
    ],
  );

  const changeQuantity = useCallback(
    async (key, delta) => {
      const nextCart = cart.map((line) =>
        cartLineKey(line) === key
          ? {
              ...line,
              quantity: Math.max(1, line.quantity + delta),
            }
          : line,
      );

      try {
        const validation = await validateCart(nextCart);

        if (validation.valid !== true) {
          notify("The backend could not validate the updated cart.", "error");
          return false;
        }

        setCart(
          mergeValidatedLines(
            nextCart,
            validation.items || [],
            selectedOutletId,
          ),
        );

        setCartQuote(null);

        return true;
      } catch (error) {
        notify(error.message || "Unable to update quantity.", "error");
        return false;
      }
    },
    [cart, validateCart, selectedOutletId, notify],
  );

  const removeCartLine = useCallback((key) => {
    setCart((current) => current.filter((line) => cartLineKey(line) !== key));

    setCartQuote(null);
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCartQuote(null);
    setCouponCode(null);
    setLoyaltyRedeemPoints(0);
    setCheckoutDraft(null);
  }, []);

  /* ======================================================
     COUPON AND LOYALTY PREVIEW
  ====================================================== */

  const applyCoupon = useCallback(
    async (code) => {
      const cleanCode = String(code || "")
        .trim()
        .toUpperCase();

      if (!cleanCode) {
        throw new Error("Enter a coupon code.");
      }

      const payload = buildCartPayload(cart, {
        couponCode: cleanCode,
      });

      const result = await withCustomerAuth(() =>
        customerApi.quoteCart(payload),
      );

      setCouponCode(cleanCode);
      setCartQuote(result);

      notify(`${cleanCode} applied successfully.`);

      return result;
    },
    [cart, buildCartPayload, withCustomerAuth, notify],
  );

  const removeCoupon = useCallback(async () => {
    const payload = buildCartPayload(cart, {
      couponCode: null,
    });

    const result = await withCustomerAuth(() => customerApi.quoteCart(payload));

    setCouponCode(null);
    setCartQuote(result);
  }, [cart, buildCartPayload, withCustomerAuth]);

  const setRedeemPoints = useCallback(
    async (points) => {
      const requestedPoints = Number(points || 0);

      if (
        !Number.isSafeInteger(requestedPoints) ||
        requestedPoints < 0 ||
        requestedPoints % 100 !== 0
      ) {
        throw new Error(
          "Loyalty points must be a non-negative multiple of 100.",
        );
      }

      if (requestedPoints === 0) {
        const result = await withCustomerAuth(() =>
          customerApi.quoteCart(
            buildCartPayload(cart, {
              loyaltyPoints: 0,
            }),
          ),
        );

        setLoyaltyRedeemPoints(0);
        setCartQuote(result);

        return result;
      }

      const previewPayload = {
        points: requestedPoints,
        outletId: selectedOutletId,
        addressId: selectedAddressId,
        items: buildCartPayload(cart).items,
        ...(couponCode ? { couponCode } : {}),
      };

      const preview = await withCustomerAuth(() =>
        customerApi.redeemPoints(previewPayload),
      );

      const quote = await withCustomerAuth(() =>
        customerApi.quoteCart(
          buildCartPayload(cart, {
            loyaltyPoints: preview.redeemedPoints,
          }),
        ),
      );

      setLoyaltyRedeemPoints(preview.redeemedPoints);
      setCartQuote(quote);

      return preview;
    },
    [
      cart,
      selectedOutletId,
      selectedAddressId,
      couponCode,
      buildCartPayload,
      withCustomerAuth,
    ],
  );

  /* ======================================================
     PROFILE
  ====================================================== */

  const saveProfile = useCallback(
    async (patch) => {
      const updated = await withCustomerAuth(() =>
        customerApi.updateProfile({
          name: patch.name,
          email: patch.email,
        }),
      );

      setProfile(updated);

      notify("Profile updated.");

      return updated;
    },
    [withCustomerAuth, notify],
  );

  /* ======================================================
     ADDRESS BOOK
  ====================================================== */

  const saveAddress = useCallback(
    async (payload, addressId) => {
      const cleanPayload = addressPayload(payload);

      const updated = await withCustomerAuth(() =>
        addressId
          ? customerApi.updateAddress(addressId, cleanPayload)
          : customerApi.createAddress(cleanPayload),
      );

      const result = await withCustomerAuth(() => customerApi.getAddresses());

      setAddresses(result.addresses || []);

      if (!addressId || updated?.isDefault) {
        setSelectedAddressId(updated.id);
      }

      notify(addressId ? "Address updated." : "Address saved.");

      return updated;
    },
    [withCustomerAuth, notify],
  );

  const deleteAddress = useCallback(
    async (addressId) => {
      const previous = addresses.find((address) => address.id === addressId);

      await withCustomerAuth(() => customerApi.deleteAddress(addressId));

      const result = await withCustomerAuth(() => customerApi.getAddresses());

      const nextAddresses = result.addresses || [];

      setAddresses(nextAddresses);

      if (selectedAddressId === addressId) {
        const replacement =
          nextAddresses.find((address) => address.isDefault) ||
          nextAddresses[0] ||
          null;

        setSelectedAddressId(replacement?.id || null);

        if (replacement?.pincode) {
          await requestLocation(replacement.pincode);
        }
      } else if (previous?.isDefault) {
        const replacement = nextAddresses.find((address) => address.isDefault);

        if (replacement?.pincode) {
          await requestLocation(replacement.pincode);
        }
      }

      notify("Address removed.");
    },
    [addresses, selectedAddressId, withCustomerAuth, requestLocation, notify],
  );

  const setDefaultAddress = useCallback(
    async (addressId) => {
      const updated = await withCustomerAuth(() =>
        customerApi.setDefaultAddress(addressId),
      );

      const result = await withCustomerAuth(() => customerApi.getAddresses());

      setAddresses(result.addresses || []);
      setSelectedAddressId(updated.id);

      if (updated.pincode !== selectedPincode) {
        await requestLocation(updated.pincode);
      }

      notify("Default address updated.");
    },
    [withCustomerAuth, selectedPincode, requestLocation, notify],
  );

  const selectAddress = useCallback(
    async (addressId) => {
      const address = addresses.find((entry) => entry.id === addressId);

      if (!address) return;

      setSelectedAddressId(address.id);

      if (address.pincode !== selectedPincode) {
        const result = await requestLocation(address.pincode);

        if (!result.serviceable) {
          throw new Error(result.reason || "This address is not serviceable.");
        }
      }
    },
    [addresses, selectedPincode, requestLocation],
  );

  /* ======================================================
     CUSTOMER ORDERS AND REWARDS
  ====================================================== */

  const refreshOrders = useCallback(async () => {
    const result = await withCustomerAuth(() =>
      customerApi.getOrders({
        page: 1,
        limit: 100,
      }),
    );

    setOrders(result.orders || []);

    return result.orders || [];
  }, [withCustomerAuth]);
  useEffect(() => {
    if (authLoading || user?.role !== "customer") {
      return undefined;
    }

    let active = true;
    let reconnecting = false;

    const socket = socketClient.connect();

    const refreshCustomerOrders = async () => {
      try {
        await refreshOrders();
      } catch (error) {
        if (active) {
          console.error(
            "Unable to refresh customer orders after socket event:",
            error,
          );
        }
      }
    };

    const onOrderStatusUpdated = () => {
      if (!active) return;

      refreshCustomerOrders();
    };

    const onOrderEtaUpdated = () => {
      if (!active) return;

      refreshCustomerOrders();
    };

    const onConnect = () => {
      if (!active) return;

      if (reconnecting) {
        refreshCustomerOrders();
      }

      reconnecting = true;
    };

    const onDisconnect = () => {
      reconnecting = true;
    };

    socket.on("order:status-updated", onOrderStatusUpdated);
    socket.on("order:eta-updated", onOrderEtaUpdated);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      active = false;

      socket.off("order:status-updated", onOrderStatusUpdated);
      socket.off("order:eta-updated", onOrderEtaUpdated);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);

      socketClient.disconnect();
    };
  }, [authLoading, user?.id, user?.role, refreshOrders]);

  const refreshLoyalty = useCallback(async () => {
    const [summary, transactionData] = await withCustomerAuth(() =>
      Promise.all([
        customerApi.getRewards(),
        customerApi.getRewardTransactions({
          page: 1,
          limit: 100,
        }),
      ]),
    );

    const result = {
      ...EMPTY_LOYALTY,
      ...summary,
      transactions: transactionData.transactions || [],
    };

    setLoyalty(result);

    return result;
  }, [withCustomerAuth]);

  const refreshCateringEnquiries = useCallback(async () => {
    const result = await withCustomerAuth(() =>
      customerApi.getCateringEnquiries({
        page: 1,
        limit: 100,
      }),
    );

    setCateringEnquiries(result.enquiries || []);

    return result.enquiries || [];
  }, [withCustomerAuth]);

  const value = useMemo(
    () => ({
      loading,
      loadError,

      outlets,
      catalog,
      orders,
      settings,

      profile,
      addresses,
      selectedAddressId,

      selectedPincode,
      selectedOutletId,

      cart,
      cartQuote,
      couponCode,
      loyaltyRedeemPoints,
      loyalty,

      checkoutDraft,
      setCheckoutDraft,

      pendingLocation,
      locationChoices,
      toast,
      setToast,

      cateringEnquiries,

      refresh,
      requestLocation,
      chooseOutlet,
      confirmLocationSwitch,
      cancelLocationSwitch,

      addToCart,
      validateCart,
      refreshQuote,
      changeQuantity,
      removeCartLine,
      clearCart,

      applyCoupon,
      removeCoupon,
      setRedeemPoints,

      saveProfile,
      saveAddress,
      deleteAddress,
      setDefaultAddress,
      selectAddress,

      refreshOrders,
      refreshLoyalty,
      refreshCateringEnquiries,

      notify,
    }),
    [
      loading,
      loadError,
      outlets,
      catalog,
      orders,
      settings,
      profile,
      addresses,
      selectedAddressId,
      selectedPincode,
      selectedOutletId,
      cart,
      cartQuote,
      couponCode,
      loyaltyRedeemPoints,
      loyalty,
      checkoutDraft,
      pendingLocation,
      locationChoices,
      toast,
      cateringEnquiries,
      refresh,
      requestLocation,
      chooseOutlet,
      confirmLocationSwitch,
      cancelLocationSwitch,
      addToCart,
      validateCart,
      refreshQuote,
      changeQuantity,
      removeCartLine,
      clearCart,
      applyCoupon,
      removeCoupon,
      setRedeemPoints,
      saveProfile,
      saveAddress,
      deleteAddress,
      setDefaultAddress,
      selectAddress,
      refreshOrders,
      refreshLoyalty,
      refreshCateringEnquiries,
      notify,
    ],
  );

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const value = useContext(CustomerContext);

  if (!value) {
    throw new Error("useCustomer must be used inside CustomerProvider.");
  }

  return value;
}
