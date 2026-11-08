import apiClient from "./apiClient.js";

function buildRequestProfile(intent, profile) {
  if (intent !== "signup") {
    return {};
  }

  if (!profile) {
    throw new Error("Customer signup profile is required.");
  }

  return {
    profile: {
      name: profile.name,
      email: profile.email ?? "",
      pincode: profile.pincode,
    },
  };
}

export const authApi = {
  requestOtp({ phone, intent, profile }) {
    return apiClient.post("/auth/otp/request", {
      phone,
      intent,
      ...buildRequestProfile(intent, profile),
    });
  },

  verifyOtp({ phone, intent, otp, profile }) {
    return apiClient.post("/auth/otp/verify", {
      phone,
      intent,
      otp,
      ...buildRequestProfile(intent, profile),
    });
  },

  getSession() {
    return apiClient.get("/auth/session");
  },

  logout() {
    return apiClient.post("/auth/logout");
  },
};

export default authApi;