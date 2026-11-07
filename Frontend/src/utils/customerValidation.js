export const isPincode = (value) => /^[1-9]\d{5}$/.test(String(value || ""));
export const isPhone = (value) => /^[6-9]\d{9}$/.test(String(value || ""));
export const isEmail = (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const required = (value) => String(value || "").trim().length > 0;
