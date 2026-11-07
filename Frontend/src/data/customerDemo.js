export const CUSTOMER_STORAGE_KEY = "dastarkhwan_customer_demo_v1";

export const seedCustomerProfile = {
  id: "demo-customer-1",
  name: "Ananya Rao",
  phone: "9000000101",
  email: "ananya@example.com",
  marketingOptIn: false,
  verifiedPhone: true,
};

export const seedAddresses = [
  {
    id: "addr-home",
    name: "Ananya Rao",
    phone: "9000000101",
    pincode: "500084",
    house: "Flat 402, Green Heights",
    street: "Kondapur Main Road",
    landmark: "Near botanical garden",
    city: "Hyderabad",
    type: "Home",
    isDefault: true,
  },
  {
    id: "addr-work",
    name: "Ananya Rao",
    phone: "9000000101",
    pincode: "500032",
    house: "Block C, 3rd Floor",
    street: "Financial District",
    landmark: "Near ORR service road",
    city: "Hyderabad",
    type: "Work",
    isDefault: false,
  },
  {
    id: "addr-other",
    name: "Ananya Rao",
    phone: "9000000101",
    pincode: "500072",
    house: "House 12",
    street: "JNTU Road",
    landmark: "Near metro station",
    city: "Hyderabad",
    type: "Other",
    isDefault: false,
  },
];

export const seedLoyalty = {
  balance: 480,
  transactions: [
    {
      id: "lp-1",
      type: "earned",
      points: 120,
      note: "Completed order WEB-778120",
      at: "2026-10-30T18:20:00.000Z",
    },
    {
      id: "lp-2",
      type: "earned",
      points: 80,
      note: "Completed order WEB-778131",
      at: "2026-11-02T14:10:00.000Z",
    },
    {
      id: "lp-3",
      type: "bonus",
      points: 280,
      note: "Welcome rewards balance",
      at: "2026-11-03T10:00:00.000Z",
    },
  ],
  awardedOrderIds: ["WEB-778120", "WEB-778131"],
};

export const seedCoupons = [
  {
    code: "WELCOME10",
    title: "10% off your order",
    description: "10% off up to ₹150 on orders above ₹299.",
    type: "percent",
    value: 10,
    maxDiscount: 150,
    minOrder: 299,
    outletIds: [],
    firstOrderOnly: false,
    active: true,
  },
  {
    code: "BIRYANI100",
    title: "₹100 off biryani favourites",
    description: "Save ₹100 on orders above ₹699.",
    type: "flat",
    value: 100,
    maxDiscount: 100,
    minOrder: 699,
    outletIds: [],
    firstOrderOnly: false,
    active: true,
    category: "Biryani",
  },
  {
    code: "FIRSTORDER",
    title: "A little welcome treat",
    description: "15% off up to ₹120 on your first order above ₹399.",
    type: "percent",
    value: 15,
    maxDiscount: 120,
    minOrder: 399,
    outletIds: [],
    firstOrderOnly: true,
    active: true,
  },
];

export const seedCateringConfig = {
  minimumNoticeDays: 3,
  minimumGuests: 15,
  maximumGuests: 1000,
};
