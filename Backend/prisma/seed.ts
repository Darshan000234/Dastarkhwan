import { prisma } from "../src/db/prisma.js";

const cityId = "city-hyderabad";

const seededAt = new Date();

const operatingDays = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

// --------------------------------------------------
// MANAGERS
// Pincode is intentionally NOT stored for managers.
// --------------------------------------------------

const managers = [
  {
    id: "user-manager-rahul",
    fullName: "Rahul Sharma",
    phone: "9000000041",
    outletId: "out-kondapur",
  },
  {
    id: "user-manager-amit",
    fullName: "Amit Verma",
    phone: "9000000042",
    outletId: "out-gachibowli",
  },
  {
    id: "user-manager-priya",
    fullName: "Priya Nair",
    phone: "9000000043",
    outletId: "out-kukatpally",
  },
];

// --------------------------------------------------
// CUSTOMERS
// Pincode belongs to the customer.
// Each customer also receives a matching address.
// --------------------------------------------------

const customers = [
  {
    id: "user-customer-asha",
    fullName: "Asha Rao",
    phone: "9000000101",
    email: "asha.demo@dastarkhwan.test",
    pincode: "500084",

    address: {
      id: "addr-demo-asha",
      label: "Home",
      recipientName: "Asha Rao",
      phone: "9000000101",
      line1: "Flat 201, Green Residency",
      line2: null,
      locality: "Kondapur",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500084",
      landmark: "Near Botanical Garden",
      isDefault: true,
    },
  },
  {
    id: "user-customer-arjun",
    fullName: "Arjun Reddy",
    phone: "9000000102",
    email: "arjun.demo@dastarkhwan.test",
    pincode: "500032",

    address: {
      id: "addr-demo-arjun",
      label: "Home",
      recipientName: "Arjun Reddy",
      phone: "9000000102",
      line1: "Flat 302, Sunrise Apartments",
      line2: null,
      locality: "Gachibowli",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500032",
      landmark: "Near DLF Road",
      isDefault: true,
    },
  },
  {
    id: "user-customer-sana",
    fullName: "Sana Khan",
    phone: "9000000103",
    email: "sana.demo@dastarkhwan.test",
    pincode: "500081",

    address: {
      id: "addr-demo-sana",
      label: "Home",
      recipientName: "Sana Khan",
      phone: "9000000103",
      line1: "House 18, Lake View Colony",
      line2: null,
      locality: "Hitech City",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500081",
      landmark: "Near Cyber Towers",
      isDefault: true,
    },
  },
  {
    id: "user-customer-kabir",
    fullName: "Kabir Ahmed",
    phone: "9000000104",
    email: "kabir.demo@dastarkhwan.test",
    pincode: "500019",

    address: {
      id: "addr-demo-kabir",
      label: "Home",
      recipientName: "Kabir Ahmed",
      phone: "9000000104",
      line1: "Flat 104, Royal Heights",
      line2: null,
      locality: "Nanakramguda",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500019",
      landmark: "Near Financial District",
      isDefault: true,
    },
  },
];

// --------------------------------------------------
// FOOD CATALOGUE
// --------------------------------------------------

const foods = [
  {
    id: "chicken-biryani",
    name: "Chicken Dum Biryani",
    slug: "chicken-dum-biryani",
    description:
      "Basmati rice, marinated chicken and whole spices, slow-cooked on dum.",
    category: "Biryani",
    foodType: "NON_VEG",
    spiceLevel: "MEDIUM",
    allergens: ["Dairy"],
    prepTimeMinutes: 25,
    imageUrl:
      "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500",
    basePrice: 380,
    cityPrice: 390,
    portions: [
      { name: "Regular", price: 380 },
      { name: "Family", price: 1050 },
    ],
    addons: [
      { name: "Boiled Egg", price: 25 },
      { name: "Raita", price: 30 },
    ],
  },
  {
    id: "mutton-biryani",
    name: "Mutton Biryani",
    slug: "mutton-biryani",
    description:
      "Tender mutton layered with fragrant rice, saffron and fried onions.",
    category: "Biryani",
    foodType: "NON_VEG",
    spiceLevel: "HOT",
    allergens: ["Dairy"],
    prepTimeMinutes: 35,
    imageUrl:
      "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=500",
    basePrice: 450,
    cityPrice: 470,
    portions: [
      { name: "Regular", price: 450 },
      { name: "Family", price: 1250 },
    ],
    addons: [{ name: "Raita", price: 30 }],
  },
  {
    id: "veg-biryani",
    name: "Veg Biryani",
    slug: "veg-biryani",
    description:
      "Seasonal vegetables, basmati rice and aromatic whole spices.",
    category: "Biryani",
    foodType: "VEG",
    spiceLevel: "MILD",
    allergens: ["Dairy"],
    prepTimeMinutes: 20,
    imageUrl:
      "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500",
    basePrice: 280,
    cityPrice: 290,
    portions: [
      { name: "Regular", price: 280 },
      { name: "Family", price: 780 },
    ],
    addons: [{ name: "Raita", price: 25 }],
  },
  {
    id: "chicken-65",
    name: "Chicken 65",
    slug: "chicken-65",
    description:
      "Crisp chicken tossed with curry leaves and a bold spice blend.",
    category: "Starters",
    foodType: "NON_VEG",
    spiceLevel: "HOT",
    allergens: ["Dairy"],
    prepTimeMinutes: 18,
    imageUrl:
      "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500",
    basePrice: 220,
    cityPrice: 230,
    portions: [
      { name: "Half", price: 220 },
      { name: "Full", price: 390 },
    ],
    addons: [],
  },
  {
    id: "mirchi-salan",
    name: "Mirchi Ka Salan",
    slug: "mirchi-ka-salan",
    description:
      "Green chillies in a peanut, sesame and tamarind gravy.",
    category: "Sides",
    foodType: "VEG",
    spiceLevel: "HOT",
    allergens: ["Peanuts", "Sesame"],
    prepTimeMinutes: 15,
    imageUrl:
      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500",
    basePrice: 110,
    cityPrice: 120,
    portions: [
      { name: "Side", price: 60 },
      { name: "Regular", price: 120 },
    ],
    addons: [],
  },
  {
    id: "double-meetha",
    name: "Double Ka Meetha",
    slug: "double-ka-meetha",
    description:
      "Golden fried bread soaked in fragrant saffron milk.",
    category: "Desserts",
    foodType: "VEG",
    spiceLevel: "NONE",
    allergens: ["Dairy", "Gluten"],
    prepTimeMinutes: 12,
    imageUrl:
      "https://images.unsplash.com/photo-1666190092689-e3968aa0c32c?w=500",
    basePrice: 150,
    cityPrice: 160,
    portions: [{ name: "Regular", price: 150 }],
    addons: [],
  },
  {
    id: "haleem",
    name: "Mutton Haleem",
    slug: "mutton-haleem",
    description:
      "Traditional Hyderabadi haleem with slow-cooked meat, lentils and grains, finished with fried onions.",
    category: "Specials",
    foodType: "NON_VEG",
    spiceLevel: "MEDIUM",
    allergens: ["Dairy"],
    prepTimeMinutes: 40,
    imageUrl:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500",
    basePrice: 320,
    cityPrice: 340,
    portions: [{ name: "Regular", price: 320 }],
    addons: [{ name: "Extra fried onions", price: 20 }],
  },
  {
    id: "dal-makhani",
    name: "Dal Makhani",
    slug: "dal-makhani",
    description:
      "Black lentils simmered slowly with tomato, butter and cream.",
    category: "Mains",
    foodType: "VEG",
    spiceLevel: "MILD",
    allergens: ["Dairy"],
    prepTimeMinutes: 25,
    imageUrl:
      "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500",
    basePrice: 240,
    cityPrice: 250,
    portions: [
      { name: "Regular", price: 240 },
      { name: "Family", price: 650 },
    ],
    addons: [],
  },
  {
    id: "shami-kebab",
    name: "Hyderabadi Shami Kebab",
    slug: "hyderabadi-shami-kebab",
    description:
      "Soft, aromatic minced-meat kebabs with lentils, herbs and warm spices.",
    category: "Starters",
    foodType: "NON_VEG",
    spiceLevel: "MEDIUM",
    allergens: [],
    prepTimeMinutes: 18,
    imageUrl:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500",
    basePrice: 260,
    cityPrice: 270,
    portions: [
      { name: "4 pieces", price: 260 },
      { name: "8 pieces", price: 490 },
    ],
    addons: [{ name: "Mint chutney", price: 20 }],
  },
  {
    id: "paneer-65",
    name: "Paneer 65",
    slug: "paneer-65",
    description:
      "Crisp paneer bites tossed with curry leaves, chilli and yoghurt spices.",
    category: "Starters",
    foodType: "VEG",
    spiceLevel: "HOT",
    allergens: ["Dairy"],
    prepTimeMinutes: 18,
    imageUrl:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500",
    basePrice: 240,
    cityPrice: 250,
    portions: [
      { name: "Half", price: 240 },
      { name: "Full", price: 420 },
    ],
    addons: [],
  },
  {
    id: "mirchi-bajji",
    name: "Mirchi Bajji",
    slug: "mirchi-bajji",
    description:
      "Green chillies dipped in a seasoned gram-flour batter and fried crisp.",
    category: "Starters",
    foodType: "VEG",
    spiceLevel: "HOT",
    allergens: ["Peanuts"],
    prepTimeMinutes: 15,
    imageUrl:
      "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500",
    basePrice: 150,
    cityPrice: 160,
    portions: [
      { name: "4 pieces", price: 150 },
      { name: "8 pieces", price: 280 },
    ],
    addons: [{ name: "Peanut chutney", price: 25 }],
  },
  {
    id: "bagara-baingan",
    name: "Bagara Baingan",
    slug: "bagara-baingan",
    description:
      "Baby eggplants simmered in a rich sesame, peanut and tamarind gravy.",
    category: "Mains",
    foodType: "VEG",
    spiceLevel: "MEDIUM",
    allergens: ["Peanuts", "Sesame"],
    prepTimeMinutes: 28,
    imageUrl:
      "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500",
    basePrice: 260,
    cityPrice: 270,
    portions: [
      { name: "Regular", price: 260 },
      { name: "Family", price: 640 },
    ],
    addons: [],
  },
  {
    id: "qubani-meetha",
    name: "Qubani Ka Meetha",
    slug: "qubani-ka-meetha",
    description:
      "A Hyderabadi apricot dessert served chilled with a creamy finish.",
    category: "Desserts",
    foodType: "VEG",
    spiceLevel: "NONE",
    allergens: ["Dairy", "Tree nuts"],
    prepTimeMinutes: 10,
    imageUrl:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500",
    basePrice: 180,
    cityPrice: 190,
    portions: [{ name: "Regular", price: 180 }],
    addons: [{ name: "Cream", price: 25 }],
  },
  {
    id: "irani-chai",
    name: "Irani Chai",
    slug: "irani-chai",
    description:
      "Strong, slow-brewed tea with a smooth, milky finish.",
    category: "Beverages",
    foodType: "VEG",
    spiceLevel: "NONE",
    allergens: ["Dairy"],
    prepTimeMinutes: 6,
    imageUrl:
      "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=500",
    basePrice: 70,
    cityPrice: 75,
    portions: [
      { name: "Cup", price: 70 },
      { name: "Large", price: 110 },
    ],
    addons: [],
  },
];

// --------------------------------------------------
// OUTLETS
// --------------------------------------------------

const outletSeeds = [
  {
    id: "out-kondapur",
    code: "HYD-KON-01",
    name: "Kondapur",
    type: "RESTAURANT",
    addressLine1: "Main Road",
    locality: "Kondapur",
    pincode: "500084",
    primaryPincode: "500084",
    phone: "9000000011",
    fssaiLicense: "DEMO-FSSAI-KON-001",
    supportsVeg: true,
    supportsNonVeg: true,
    deliveryPincodes: ["500084", "500081", "500032"],
    deliveryRadiusKm: 5,
    openingTime: "11:00",
    closingTime: "23:00",
    operatingDays,
    minimumPrepMinutes: 25,
    managerPhone: "9000000041",
    isActive: true,
  },
  {
    id: "out-gachibowli",
    code: "HYD-GAC-02",
    name: "Gachibowli Cloud Kitchen",
    type: "CLOUD_KITCHEN",
    addressLine1: "Tech Park Service Road",
    locality: "Gachibowli",
    pincode: "500032",
    primaryPincode: "500032",
    phone: "9000000012",
    fssaiLicense: "DEMO-FSSAI-GAC-002",
    supportsVeg: true,
    supportsNonVeg: true,
    deliveryPincodes: ["500032", "500019", "500081"],
    deliveryRadiusKm: 4,
    openingTime: "10:00",
    closingTime: "23:30",
    operatingDays,
    minimumPrepMinutes: 22,
    managerPhone: "9000000042",
    isActive: true,
  },
  {
    id: "out-kukatpally",
    code: "HYD-KUK-03",
    name: "Kukatpally",
    type: "RESTAURANT",
    addressLine1: "JNTU Road",
    locality: "Kukatpally",
    pincode: "500072",
    primaryPincode: "500072",
    phone: "9000000013",
    fssaiLicense: "DEMO-FSSAI-KUK-003",
    supportsVeg: true,
    supportsNonVeg: true,
    deliveryPincodes: ["500072", "500085"],
    deliveryRadiusKm: 6,
    openingTime: "11:00",
    closingTime: "22:30",
    operatingDays,
    minimumPrepMinutes: 30,
    managerPhone: "9000000043",
    isActive: false,
  },
];

// --------------------------------------------------
// OUTLET MENU MAPPINGS
// --------------------------------------------------

const outletMappings = {
  "out-kondapur": [
    ["chicken-biryani", "Dinner", null],
    ["mutton-biryani", "Dinner", 460],
    ["chicken-65", "All Day", null],
    ["double-meetha", "All Day", null],
    ["haleem", "Dinner", null],
    ["shami-kebab", "All Day", null],
    ["mirchi-bajji", "All Day", null],
    ["qubani-meetha", "All Day", null],
    ["irani-chai", "All Day", null],
  ],

  "out-gachibowli": [
    ["veg-biryani", "All Day", null],
    ["mirchi-salan", "All Day", null],
    ["chicken-65", "All Day", 230],
    ["dal-makhani", "Lunch", null],
    ["paneer-65", "All Day", null],
    ["bagara-baingan", "Lunch", null],
    ["irani-chai", "All Day", null],
  ],

  "out-kukatpally": [
    ["haleem", "Dinner", 350],
    ["chicken-biryani", "Dinner", 390],
    ["veg-biryani", "All Day", null],
    ["double-meetha", "All Day", null],
    ["dal-makhani", "Lunch", null],
    ["shami-kebab", "All Day", null],
    ["paneer-65", "All Day", null],
    ["qubani-meetha", "All Day", null],
    ["irani-chai", "All Day", null],
  ],
};

// --------------------------------------------------
// TIME MENUS
// --------------------------------------------------

const timeMenus = [
  {
    id: "tm-lunch",
    name: "Lunch",
    startTime: "11:00",
    endTime: "15:30",
    days: operatingDays,
    outletIds: ["out-gachibowli", "out-kukatpally"],
    itemIds: ["veg-biryani", "dal-makhani"],
  },
  {
    id: "tm-dinner",
    name: "Dinner",
    startTime: "18:00",
    endTime: "23:00",
    days: operatingDays,
    outletIds: ["out-kondapur", "out-kukatpally"],
    itemIds: [
      "chicken-biryani",
      "mutton-biryani",
      "haleem",
    ],
  },
];

// --------------------------------------------------
// MAIN SEED
// --------------------------------------------------

async function main() {
  console.log("Starting Dastarkhwan demo seed...");

  // 1. CITY
  await prisma.city.upsert({
    where: {
      id: cityId,
    },
    update: {
      name: "Hyderabad",
      state: "Telangana",
      country: "India",
      isActive: true,
    },
    create: {
      id: cityId,
      name: "Hyderabad",
      state: "Telangana",
      country: "India",
      isActive: true,
    },
  });

  console.log("City seeded.");

  // 2. CENTRAL ADMIN
  // Explicitly clear pincode in case it was populated by an earlier seed.
  await prisma.user.upsert({
    where: {
      phone: "9000000001",
    },
    update: {
      fullName: "Demo Admin",
      role: "CENTRAL_ADMIN",
      pincode: null,
      isActive: true,
    },
    create: {
      id: "user-central-admin",
      fullName: "Demo Admin",
      phone: "9000000001",
      role: "CENTRAL_ADMIN",
      isActive: true,
    },
  });

  console.log("Central admin seeded.");

  // 3. OUTLET MANAGERS
  // Managers do not receive customer pincodes.
  for (const manager of managers) {
    await prisma.user.upsert({
      where: {
        phone: manager.phone,
      },
      update: {
        fullName: manager.fullName,
        role: "OUTLET_MANAGER",
        pincode: null,
        isActive: true,
        phoneVerifiedAt: seededAt,
      },
      create: {
        id: manager.id,
        fullName: manager.fullName,
        phone: manager.phone,
        role: "OUTLET_MANAGER",
        isActive: true,
        phoneVerifiedAt: seededAt,
      },
    });
  }

  console.log("Outlet managers seeded.");

  // 4. CUSTOMERS AND CUSTOMER ADDRESSES
  // Customer pincode is stored in User.pincode.
  // Address pincode is stored separately in Address.pincode.
  for (const customer of customers) {
    const { address, ...customerData } = customer;

    const user = await prisma.user.upsert({
      where: {
        phone: customerData.phone,
      },
      update: {
        fullName: customerData.fullName,
        email: customerData.email,
        pincode: customerData.pincode,
        role: "CUSTOMER",
        isActive: true,
        phoneVerifiedAt: seededAt,
        emailVerifiedAt: seededAt,
      },
      create: {
        id: customerData.id,
        fullName: customerData.fullName,
        phone: customerData.phone,
        email: customerData.email,
        pincode: customerData.pincode,
        role: "CUSTOMER",
        isActive: true,
        phoneVerifiedAt: seededAt,
        emailVerifiedAt: seededAt,
      },
    });

    await prisma.address.upsert({
      where: {
        id: address.id,
      },
      update: {
        label: address.label,
        recipientName: address.recipientName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        locality: address.locality,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark,
        isDefault: address.isDefault,
        userId: user.id,
      },
      create: {
        id: address.id,
        userId: user.id,
        label: address.label,
        recipientName: address.recipientName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        locality: address.locality,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark,
        isDefault: address.isDefault,
      },
    });
  }

  console.log("Customers and addresses seeded.");

  // 5. OUTLETS
  for (const outlet of outletSeeds) {
    const manager = await prisma.user.findUniqueOrThrow({
      where: {
        phone: outlet.managerPhone,
      },
    });

    const outletData = {
      code: outlet.code,
      name: outlet.name,
      type: outlet.type,
      cityId,
      addressLine1: outlet.addressLine1,
      locality: outlet.locality,
      state: "Telangana",
      pincode: outlet.pincode,
      primaryPincode: outlet.primaryPincode,
      phone: outlet.phone,
      fssaiLicense: outlet.fssaiLicense,
      supportsVeg: outlet.supportsVeg,
      supportsNonVeg: outlet.supportsNonVeg,
      deliveryPincodes: outlet.deliveryPincodes,
      deliveryRadiusKm: outlet.deliveryRadiusKm,
      openingTime: outlet.openingTime,
      closingTime: outlet.closingTime,
      operatingDays: outlet.operatingDays,
      minimumPrepMinutes: outlet.minimumPrepMinutes,
      managerId: manager.id,
      isActive: outlet.isActive,
    };

    await prisma.outlet.upsert({
      where: {
        id: outlet.id,
      },
      update: outletData,
      create: {
        id: outlet.id,
        ...outletData,
      },
    });
  }

  console.log("Outlets seeded.");

  // 6. FOOD ITEMS, PORTIONS, ADD-ONS AND CITY PRICES
  for (const food of foods) {
    const {
      id,
      basePrice,
      cityPrice,
      portions,
      addons,
      ...foodData
    } = food;

    const foodItem = await prisma.foodItem.upsert({
      where: {
        id,
      },
      update: {
        ...foodData,
        basePrice,
        isActive: true,
      },
      create: {
        id,
        ...foodData,
        basePrice,
        isActive: true,
      },
    });

    // Portions
    for (const portion of portions) {
      await prisma.foodPortion.upsert({
        where: {
          foodItemId_name: {
            foodItemId: foodItem.id,
            name: portion.name,
          },
        },
        update: {
          price: portion.price,
          isActive: true,
        },
        create: {
          foodItemId: foodItem.id,
          name: portion.name,
          price: portion.price,
          isActive: true,
        },
      });
    }

    // Add-on group and options
    if (addons.length > 0) {
      const addonGroup = await prisma.addonGroup.upsert({
        where: {
          foodItemId_name: {
            foodItemId: foodItem.id,
            name: "Extras",
          },
        },
        update: {
          isRequired: false,
          minSelect: 0,
          maxSelect: addons.length,
          sortOrder: 0,
        },
        create: {
          foodItemId: foodItem.id,
          name: "Extras",
          isRequired: false,
          minSelect: 0,
          maxSelect: addons.length,
          sortOrder: 0,
        },
      });

      for (let index = 0; index < addons.length; index++) {
        const addon = addons[index];

        await prisma.addonOption.upsert({
          where: {
            addonGroupId_name: {
              addonGroupId: addonGroup.id,
              name: addon.name,
            },
          },
          update: {
            price: addon.price,
            isActive: true,
            sortOrder: index,
          },
          create: {
            addonGroupId: addonGroup.id,
            name: addon.name,
            price: addon.price,
            isActive: true,
            sortOrder: index,
          },
        });
      }
    }

    // City-specific menu price
    await prisma.cityMenuPrice.upsert({
      where: {
        cityId_foodItemId: {
          cityId,
          foodItemId: foodItem.id,
        },
      },
      update: {
        price: cityPrice,
      },
      create: {
        cityId,
        foodItemId: foodItem.id,
        price: cityPrice,
      },
    });
  }

  console.log("Food catalogue, portions, add-ons and city prices seeded.");

  // 7. OUTLET MENU ITEMS
  for (const [outletId, mappings] of Object.entries(outletMappings)) {
    for (const [foodItemId, timeMenuLabel, priceOverride] of mappings) {
      const isAvailable =
        !(
          outletId === "out-kondapur" &&
          foodItemId === "double-meetha"
        ) &&
        !(
          outletId === "out-kukatpally" &&
          foodItemId === "dal-makhani"
        );

      await prisma.outletMenuItem.upsert({
        where: {
          outletId_foodItemId: {
            outletId,
            foodItemId,
          },
        },
        update: {
          isAvailable,
          timeMenuLabel,
          priceOverride,
          stockQuantity: 30,
          unavailabilityReason: isAvailable
            ? null
            : "Temporarily unavailable",
        },
        create: {
          outletId,
          foodItemId,
          isAvailable,
          timeMenuLabel,
          priceOverride,
          stockQuantity: 30,
          unavailabilityReason: isAvailable
            ? null
            : "Temporarily unavailable",
        },
      });
    }
  }

  console.log("Outlet menu mappings seeded.");

  // 8. TIME MENUS
  for (const timeMenu of timeMenus) {
    await prisma.timeMenu.upsert({
      where: {
        id: timeMenu.id,
      },
      update: {
        name: timeMenu.name,
        startTime: timeMenu.startTime,
        endTime: timeMenu.endTime,
        days: timeMenu.days,
        isActive: true,
      },
      create: {
        id: timeMenu.id,
        name: timeMenu.name,
        startTime: timeMenu.startTime,
        endTime: timeMenu.endTime,
        days: timeMenu.days,
        isActive: true,
      },
    });

    // Rebuild outlet relationships to keep the seed repeatable.
    await prisma.timeMenuOutlet.deleteMany({
      where: {
        timeMenuId: timeMenu.id,
      },
    });

    await prisma.timeMenuItem.deleteMany({
      where: {
        timeMenuId: timeMenu.id,
      },
    });

    await prisma.timeMenuOutlet.createMany({
      data: timeMenu.outletIds.map((outletId) => ({
        timeMenuId: timeMenu.id,
        outletId,
      })),
    });

    await prisma.timeMenuItem.createMany({
      data: timeMenu.itemIds.map((foodItemId) => ({
        timeMenuId: timeMenu.id,
        foodItemId,
      })),
    });
  }

  console.log("Time menus seeded.");

  // 9. PLATFORM SETTINGS
  const platformSettings = {
    brandName: "Dastarkhwan",
    defaultCity: "Hyderabad",
    gstInclusive: true,
    gstRate: 5,
    defaultPrepTime: 25,
  };

  await prisma.appSetting.upsert({
    where: {
      key: "platform",
    },
    update: {
      value: platformSettings,
    },
    create: {
      key: "platform",
      value: platformSettings,
    },
  });

  console.log("Platform settings seeded.");

  // 10. SUMMARY
  const [
    userCount,
    customerCount,
    addressCount,
    outletCount,
    foodCount,
    portionCount,
    addonGroupCount,
    addonOptionCount,
    outletMenuCount,
    timeMenuCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        role: "CUSTOMER",
      },
    }),
    prisma.address.count(),
    prisma.outlet.count(),
    prisma.foodItem.count(),
    prisma.foodPortion.count(),
    prisma.addonGroup.count(),
    prisma.addonOption.count(),
    prisma.outletMenuItem.count(),
    prisma.timeMenu.count(),
  ]);

  console.log("\nDastarkhwan demo seed completed successfully.");

  console.table({
    users: userCount,
    customers: customerCount,
    customerAddresses: addressCount,
    outlets: outletCount,
    foodItems: foodCount,
    foodPortions: portionCount,
    addonGroups: addonGroupCount,
    addonOptions: addonOptionCount,
    outletMenuItems: outletMenuCount,
    timeMenus: timeMenuCount,
  });
}

// --------------------------------------------------
// EXECUTION
// --------------------------------------------------

main()
  .catch((error) => {
    console.error("Dastarkhwan seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });