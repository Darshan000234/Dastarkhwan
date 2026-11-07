export const seedTimeMenus = [
  {
    id: "tm-lunch",
    name: "Lunch",
    start: "11:00",
    end: "15:30",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    outletIds: ["out-gachibowli", "out-kukatpally"],
    itemIds: ["veg-biryani", "dal-makhani"],
    active: true,
  },
  {
    id: "tm-dinner",
    name: "Dinner",
    start: "18:00",
    end: "23:00",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    outletIds: ["out-kondapur", "out-kukatpally"],
    itemIds: ["chicken-biryani", "mutton-biryani", "haleem"],
    active: true,
  },
];
