import { prisma } from "../src/db/prisma.js";

const cityId = "city-hyderabad";

const managers = [
  { id: "user-manager-rahul", fullName: "Rahul Sharma", phone: "9000000041", outletId: "out-kondapur" },
  { id: "user-manager-amit", fullName: "Amit Verma", phone: "9000000042", outletId: "out-gachibowli" },
  { id: "user-manager-priya", fullName: "Priya Nair", phone: "9000000043", outletId: "out-kukatpally" },
];

const foods = [
  { id: "chicken-biryani", name: "Chicken Dum Biryani", slug: "chicken-dum-biryani", description: "Basmati rice, marinated chicken and whole spices, slow-cooked on dum.", category: "Biryani", foodType: "NON_VEG", spiceLevel: "MEDIUM", allergens: ["Dairy"], prepTimeMinutes: 25, imageUrl: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500", basePrice: 380, cityPrice: 390, portions: [{ name: "Regular", price: 380 }, { name: "Family", price: 1050 }], addons: [{ name: "Boiled Egg", price: 25 }, { name: "Raita", price: 30 }] },
  { id: "mutton-biryani", name: "Mutton Biryani", slug: "mutton-biryani", description: "Tender mutton layered with fragrant rice, saffron and fried onions.", category: "Biryani", foodType: "NON_VEG", spiceLevel: "HOT", allergens: ["Dairy"], prepTimeMinutes: 35, imageUrl: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=500", basePrice: 450, cityPrice: 470, portions: [{ name: "Regular", price: 450 }, { name: "Family", price: 1250 }], addons: [{ name: "Raita", price: 30 }] },
  { id: "veg-biryani", name: "Veg Biryani", slug: "veg-biryani", description: "Seasonal vegetables, basmati rice and aromatic whole spices.", category: "Biryani", foodType: "VEG", spiceLevel: "MILD", allergens: ["Dairy"], prepTimeMinutes: 20, imageUrl: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500", basePrice: 280, cityPrice: 290, portions: [{ name: "Regular", price: 280 }, { name: "Family", price: 780 }], addons: [{ name: "Raita", price: 25 }] },
  { id: "chicken-65", name: "Chicken 65", slug: "chicken-65", description: "Crisp chicken tossed with curry leaves and a bold spice blend.", category: "Starters", foodType: "NON_VEG", spiceLevel: "HOT", allergens: ["Dairy"], prepTimeMinutes: 18, imageUrl: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500", basePrice: 220, cityPrice: 230, portions: [{ name: "Half", price: 220 }, { name: "Full", price: 390 }], addons: [] },
  { id: "mirchi-salan", name: "Mirchi Ka Salan", slug: "mirchi-ka-salan", description: "Green chillies in a peanut, sesame and tamarind gravy.", category: "Sides", foodType: "VEG", spiceLevel: "HOT", allergens: ["Peanuts", "Sesame"], prepTimeMinutes: 15, imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500", basePrice: 110, cityPrice: 120, portions: [{ name: "Side", price: 60 }, { name: "Regular", price: 120 }], addons: [] },
  { id: "double-meetha", name: "Double Ka Meetha", slug: "double-ka-meetha", description: "Golden fried bread soaked in fragrant saffron milk.", category: "Desserts", foodType: "VEG", spiceLevel: "NONE", allergens: ["Dairy", "Gluten"], prepTimeMinutes: 12, imageUrl: "https://images.unsplash.com/photo-1666190092689-e3968aa0c32c?w=500", basePrice: 150, cityPrice: 160, portions: [{ name: "Regular", price: 150 }], addons: [] },
  { id: "haleem", name: "Mutton Haleem", slug: "mutton-haleem", description: "Traditional Hyderabadi haleem with slow-cooked meat, lentils and grains, finished with fried onions.", category: "Specials", foodType: "NON_VEG", spiceLevel: "MEDIUM", allergens: ["Dairy"], prepTimeMinutes: 40, imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500", basePrice: 320, cityPrice: 340, portions: [{ name: "Regular", price: 320 }], addons: [{ name: "Extra fried onions", price: 20 }] },
  { id: "dal-makhani", name: "Dal Makhani", slug: "dal-makhani", description: "Black lentils simmered slowly with tomato, butter and cream.", category: "Mains", foodType: "VEG", spiceLevel: "MILD", allergens: ["Dairy"], prepTimeMinutes: 25, imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500", basePrice: 240, cityPrice: 250, portions: [{ name: "Regular", price: 240 }, { name: "Family", price: 650 }], addons: [] },
  { id: "shami-kebab", name: "Hyderabadi Shami Kebab", slug: "hyderabadi-shami-kebab", description: "Soft, aromatic minced-meat kebabs with lentils, herbs and warm spices.", category: "Starters", foodType: "NON_VEG", spiceLevel: "MEDIUM", allergens: [], prepTimeMinutes: 18, imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500", basePrice: 260, cityPrice: 270, portions: [{ name: "4 pieces", price: 260 }, { name: "8 pieces", price: 490 }], addons: [{ name: "Mint chutney", price: 20 }] },
  { id: "paneer-65", name: "Paneer 65", slug: "paneer-65", description: "Crisp paneer bites tossed with curry leaves, chilli and yoghurt spices.", category: "Starters", foodType: "VEG", spiceLevel: "HOT", allergens: ["Dairy"], prepTimeMinutes: 18, imageUrl: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500", basePrice: 240, cityPrice: 250, portions: [{ name: "Half", price: 240 }, { name: "Full", price: 420 }], addons: [] },
  { id: "mirchi-bajji", name: "Mirchi Bajji", slug: "mirchi-bajji", description: "Green chillies dipped in a seasoned gram-flour batter and fried crisp.", category: "Starters", foodType: "VEG", spiceLevel: "HOT", allergens: ["Peanuts"], prepTimeMinutes: 15, imageUrl: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500", basePrice: 150, cityPrice: 160, portions: [{ name: "4 pieces", price: 150 }, { name: "8 pieces", price: 280 }], addons: [{ name: "Peanut chutney", price: 25 }] },
  { id: "bagara-baingan", name: "Bagara Baingan", slug: "bagara-baingan", description: "Baby eggplants simmered in a rich sesame, peanut and tamarind gravy.", category: "Mains", foodType: "VEG", spiceLevel: "MEDIUM", allergens: ["Peanuts", "Sesame"], prepTimeMinutes: 28, imageUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500", basePrice: 260, cityPrice: 270, portions: [{ name: "Regular", price: 260 }, { name: "Family", price: 640 }], addons: [] },
  { id: "qubani-meetha", name: "Qubani Ka Meetha", slug: "qubani-ka-meetha", description: "A Hyderabadi apricot dessert served chilled with a creamy finish.", category: "Desserts", foodType: "VEG", spiceLevel: "NONE", allergens: ["Dairy", "Tree nuts"], prepTimeMinutes: 10, imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500", basePrice: 180, cityPrice: 190, portions: [{ name: "Regular", price: 180 }], addons: [{ name: "Cream", price: 25 }] },
  { id: "irani-chai", name: "Irani Chai", slug: "irani-chai", description: "Strong, slow-brewed tea with a smooth, milky finish.", category: "Beverages", foodType: "VEG", spiceLevel: "NONE", allergens: ["Dairy"], prepTimeMinutes: 6, imageUrl: "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=500", basePrice: 70, cityPrice: 75, portions: [{ name: "Cup", price: 70 }, { name: "Large", price: 110 }], addons: [] },
];

async function main() {
  await prisma.city.upsert({
    where: { id: cityId },
    update: { name: "Hyderabad", state: "Telangana", country: "India" },
    create: { id: cityId, name: "Hyderabad", state: "Telangana", country: "India" },
  });

  await prisma.user.upsert({
    where: { phone: "9000000001" },
    update: { fullName: "Demo Admin", role: "CENTRAL_ADMIN", isActive: true },
    create: { id: "user-central-admin", fullName: "Demo Admin", phone: "9000000001", role: "CENTRAL_ADMIN", isActive: true },
  });

  for (const manager of managers) {
    await prisma.user.upsert({
      where: { phone: manager.phone },
      update: { fullName: manager.fullName, role: "OUTLET_MANAGER", isActive: true, phoneVerifiedAt: new Date() },
      create: { id: manager.id, fullName: manager.fullName, phone: manager.phone, role: "OUTLET_MANAGER", isActive: true, phoneVerifiedAt: new Date() },
    });
  }

  const outletSeeds = [
    { id: "out-kondapur", code: "HYD-KON-01", name: "Kondapur", type: "RESTAURANT", addressLine1: "Main Road", locality: "Kondapur", pincode: "500084", primaryPincode: "500084", phone: "9000000011", fssaiLicense: "DEMO-FSSAI-KON-001", supportsVeg: true, supportsNonVeg: true, deliveryPincodes: ["500084", "500081", "500032"], deliveryRadiusKm: 5, openingTime: "11:00", closingTime: "23:00", operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], minimumPrepMinutes: 25, managerPhone: "9000000041", isActive: true },
    { id: "out-gachibowli", code: "HYD-GAC-02", name: "Gachibowli Cloud Kitchen", type: "CLOUD_KITCHEN", addressLine1: "Tech Park Service Road", locality: "Gachibowli", pincode: "500032", primaryPincode: "500032", phone: "9000000012", fssaiLicense: "DEMO-FSSAI-GAC-002", supportsVeg: true, supportsNonVeg: true, deliveryPincodes: ["500032", "500019", "500081"], deliveryRadiusKm: 4, openingTime: "10:00", closingTime: "23:30", operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], minimumPrepMinutes: 22, managerPhone: "9000000042", isActive: true },
    { id: "out-kukatpally", code: "HYD-KUK-03", name: "Kukatpally", type: "RESTAURANT", addressLine1: "JNTU Road", locality: "Kukatpally", pincode: "500072", primaryPincode: "500072", phone: "9000000013", fssaiLicense: "DEMO-FSSAI-KUK-003", supportsVeg: true, supportsNonVeg: true, deliveryPincodes: ["500072", "500085"], deliveryRadiusKm: 6, openingTime: "11:00", closingTime: "22:30", operatingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], minimumPrepMinutes: 30, managerPhone: "9000000043", isActive: false },
  ];

  for (const outlet of outletSeeds) {
    const manager = await prisma.user.findUniqueOrThrow({ where: { phone: outlet.managerPhone } });
    await prisma.outlet.upsert({
      where: { id: outlet.id },
      update: {
        code: outlet.code, name: outlet.name, type: outlet.type,
        addressLine1: outlet.addressLine1, locality: outlet.locality,
        state: "Telangana", pincode: outlet.pincode, primaryPincode: outlet.primaryPincode,
        phone: outlet.phone, fssaiLicense: outlet.fssaiLicense, supportsVeg: outlet.supportsVeg, supportsNonVeg: outlet.supportsNonVeg,
        deliveryPincodes: outlet.deliveryPincodes,
        deliveryRadiusKm: outlet.deliveryRadiusKm,
        openingTime: outlet.openingTime, closingTime: outlet.closingTime,
        operatingDays: outlet.operatingDays,
        minimumPrepMinutes: outlet.minimumPrepMinutes,
        managerId: manager.id, isActive: outlet.isActive,
      },
      create: {
        id: outlet.id, code: outlet.code, name: outlet.name, type: outlet.type,
        cityId, addressLine1: outlet.addressLine1, locality: outlet.locality,
        state: "Telangana", pincode: outlet.pincode, primaryPincode: outlet.primaryPincode,
        phone: outlet.phone, fssaiLicense: outlet.fssaiLicense, supportsVeg: outlet.supportsVeg, supportsNonVeg: outlet.supportsNonVeg,
        deliveryPincodes: outlet.deliveryPincodes,
        deliveryRadiusKm: outlet.deliveryRadiusKm,
        openingTime: outlet.openingTime, closingTime: outlet.closingTime,
        operatingDays: outlet.operatingDays,
        minimumPrepMinutes: outlet.minimumPrepMinutes,
        managerId: manager.id, isActive: outlet.isActive,
      },
    });
  }

  for (const food of foods) {
    const { basePrice, cityPrice, portions, addons, ...foodData } = food;
    await prisma.foodItem.upsert({
      where: { id: food.id },
      update: {
        ...foodData,
        basePrice,
        portions: { deleteMany: {}, create: portions },
        addonGroups: {
          deleteMany: {},
          create: addons.length ? [{ name: "Extras", isRequired: false, minSelect: 0, maxSelect: addons.length, options: { create: addons.map((addon) => ({ name: addon.name, price: addon.price })) } }] : [],
        },
      },
      create: {
        ...foodData,
        basePrice,
        portions: { create: portions },
        addonGroups: {
          create: addons.length ? [{ name: "Extras", isRequired: false, minSelect: 0, maxSelect: addons.length, options: { create: addons.map((addon) => ({ name: addon.name, price: addon.price })) } }] : [],
        },
      },
    });
    await prisma.cityMenuPrice.upsert({
      where: { cityId_foodItemId: { cityId, foodItemId: food.id } },
      update: { price: cityPrice },
      create: { cityId, foodItemId: food.id, price: cityPrice },
    });
  }

  const outletMappings = {
    "out-kondapur": [
      ["chicken-biryani", "Dinner", null], ["mutton-biryani", "Dinner", 460], ["chicken-65", "All Day", null],
      ["double-meetha", "All Day", null], ["haleem", "Dinner", null], ["shami-kebab", "All Day", null],
      ["mirchi-bajji", "All Day", null], ["qubani-meetha", "All Day", null], ["irani-chai", "All Day", null],
    ],
    "out-gachibowli": [
      ["veg-biryani", "All Day", null], ["mirchi-salan", "All Day", null], ["chicken-65", "All Day", 230],
      ["dal-makhani", "Lunch", null], ["paneer-65", "All Day", null], ["bagara-baingan", "Lunch", null], ["irani-chai", "All Day", null],
    ],
    "out-kukatpally": [
      ["haleem", "Dinner", 350], ["chicken-biryani", "Dinner", 390], ["veg-biryani", "All Day", null],
      ["double-meetha", "All Day", null], ["dal-makhani", "Lunch", null], ["shami-kebab", "All Day", null],
      ["paneer-65", "All Day", null], ["qubani-meetha", "All Day", null], ["irani-chai", "All Day", null],
    ],
  };

  for (const [outletId, mappings] of Object.entries(outletMappings)) {
    for (const [foodItemId, timeMenuLabel, priceOverride] of mappings) {
      const isAvailable = !(outletId === "out-kondapur" && foodItemId === "double-meetha") && !(outletId === "out-kukatpally" && foodItemId === "dal-makhani");
      await prisma.outletMenuItem.upsert({
        where: { outletId_foodItemId: { outletId, foodItemId } },
        update: { isAvailable, timeMenuLabel, priceOverride },
        create: { outletId, foodItemId, isAvailable, timeMenuLabel, priceOverride, stockQuantity: 30 },
      });
    }
  }

  const timeMenus = [
    { id: "tm-lunch", name: "Lunch", startTime: "11:00", endTime: "15:30", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], outletIds: ["out-gachibowli", "out-kukatpally"], itemIds: ["veg-biryani", "dal-makhani"] },
    { id: "tm-dinner", name: "Dinner", startTime: "18:00", endTime: "23:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], outletIds: ["out-kondapur", "out-kukatpally"], itemIds: ["chicken-biryani", "mutton-biryani", "haleem"] },
  ];

  for (const tm of timeMenus) {
    await prisma.timeMenu.upsert({
      where: { id: tm.id },
      update: { name: tm.name, startTime: tm.startTime, endTime: tm.endTime, days: tm.days, isActive: true },
      create: { id: tm.id, name: tm.name, startTime: tm.startTime, endTime: tm.endTime, days: tm.days, isActive: true },
    });
    await prisma.timeMenuOutlet.deleteMany({ where: { timeMenuId: tm.id } });
    await prisma.timeMenuItem.deleteMany({ where: { timeMenuId: tm.id } });
    await prisma.timeMenuOutlet.createMany({ data: tm.outletIds.map((outletId) => ({ timeMenuId: tm.id, outletId })) });
    await prisma.timeMenuItem.createMany({ data: tm.itemIds.map((foodItemId) => ({ timeMenuId: tm.id, foodItemId })) });
  }

  await prisma.appSetting.upsert({
    where: { key: "platform" },
    update: { value: { brandName: "Dastarkhwan", defaultCity: "Hyderabad", gstInclusive: true, gstRate: 5, defaultPrepTime: 25 } },
    create: { key: "platform", value: { brandName: "Dastarkhwan", defaultCity: "Hyderabad", gstInclusive: true, gstRate: 5, defaultPrepTime: 25 } },
  });

  console.log("Dastarkhwan seed complete: Hyderabad, 3 outlets, 3 manager users, 13 catalog items and outlet mappings.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
