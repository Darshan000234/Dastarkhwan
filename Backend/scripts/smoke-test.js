
import "dotenv/config";

const BASE_URL =
  process.env.TEST_API_URL || "http://localhost:5000/api/v1";

const REQUEST_TIMEOUT = 12000;

let passed = 0;
let failed = 0;
let skipped = 0;

const sessions = {
  customer: null,
  manager: null,
  admin: null,
};

function log(type, message) {
  const symbols = {
    PASS: "✅",
    FAIL: "❌",
    SKIP: "⚠️",
    INFO: "ℹ️",
  };

  console.log(`${symbols[type] || ""} ${message}`);
}

async function request(path, options = {}, token = null) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT,
  );

  try {
    const headers = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    };

    if (token) {
      headers.Cookie = token;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const text = await response.text();

    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    const setCookie = response.headers.get("set-cookie");

    return {
      status: response.status,
      ok: response.ok,
      data,
      setCookie,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function record(name, condition, detail = "") {
  if (condition) {
    passed++;
    log("PASS", `${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    log("FAIL", `${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function skip(name, reason) {
  skipped++;
  log("SKIP", `${name} — ${reason}`);
}

function printBody(label, body) {
  console.log(`\n${label}`);

  console.log(
    JSON.stringify(body, null, 2),
  );
}

async function authenticate(phone, intent, profile = null) {
  const payload = {
    phone,
    intent,
    ...(profile ? { profile } : {}),
  };

  const otpResponse = await request("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!otpResponse.ok || !otpResponse.data?.devOtp) {
    throw new Error(
      `OTP request failed for ${phone}: ` +
      JSON.stringify(otpResponse.data),
    );
  }

  const verifyResponse = await request("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({
      phone,
      intent,
      otp: otpResponse.data.devOtp,
    }),
  });

  if (!verifyResponse.ok) {
    throw new Error(
      `OTP verification failed for ${phone}: ` +
      JSON.stringify(verifyResponse.data),
    );
  }

  const cookie =
    verifyResponse.setCookie?.split(";")[0] || null;

  if (!cookie) {
    throw new Error(
      "Login succeeded but no authentication cookie was returned.",
    );
  }

  return {
    cookie,
    session: verifyResponse.data,
  };
}

function dataOf(response) {
  return response?.data?.data ?? response?.data ?? {};
}

function hasError(response) {
  return !response.ok;
}

async function testHealth() {
  log("INFO", "Checking API health");

  const response = await request("/../health");

  // The API health path is mounted outside /api/v1.
  const health = await fetch(
    BASE_URL.replace("/api/v1", "") + "/../health",
  ).catch(() => null);

  // Prefer the actual configured health endpoint.
  const root = BASE_URL.replace(/\/api\/v1\/?$/, "");

  const healthResponse = await fetch(`${root}/../health`)
    .catch(() => null);

  if (!healthResponse) {
    record(
      "Health check",
      false,
      "Could not reach the health endpoint",
    );
    return;
  }

  const body = await healthResponse.json().catch(() => null);

  record(
    "Health check",
    healthResponse.ok && body?.status === "ok",
  );
}

async function testCustomerAuth() {
  log("INFO", "Testing customer authentication");

  const customerPhone =
    process.env.TEST_CUSTOMER_PHONE || "9000000101";

  const result = await authenticate(
    customerPhone,
    "login",
  );

  sessions.customer = result.cookie;

  record(
    "Customer OTP login",
    Boolean(sessions.customer),
  );

  const session = await request(
    "/auth/session",
    {},
    sessions.customer,
  );

  record(
    "Customer session",
    session.ok,
    session.data?.message || "",
  );

  record(
    "Customer role",
    dataOf(session).user?.role === "customer" ||
      dataOf(session).role === "customer",
    "Must be customer",
  );
}

async function testAdminAuth() {
  log("INFO", "Testing Central Admin authentication");

  const phone = process.env.TEST_ADMIN_PHONE;

  if (!phone) {
    skip(
      "Admin authentication",
      "Set TEST_ADMIN_PHONE to a seeded Central Admin phone number",
    );
    return;
  }

  const result = await authenticate(phone, "staff");

  sessions.admin = result.cookie;

  record(
    "Central Admin login",
    Boolean(sessions.admin),
  );

  const overview = await request(
    "/admin/overview",
    {},
    sessions.admin,
  );

  record(
    "Admin overview",
    overview.ok,
    `HTTP ${overview.status}`,
  );

  const catalog = await request(
    "/admin/menu/catalog?page=1&limit=5",
    {},
    sessions.admin,
  );

  record(
    "Admin catalog listing",
    catalog.ok,
    `HTTP ${catalog.status}`,
  );
}

async function testManagerAuth() {
  log("INFO", "Testing Outlet Manager authentication");

  const phone =
    process.env.TEST_MANAGER_PHONE || "9000000041";

  const result = await authenticate(phone, "staff");

  sessions.manager = result.cookie;

  record(
    "Manager login",
    Boolean(sessions.manager),
  );

  const workspace = await request(
    "/manager/workspace",
    {},
    sessions.manager,
  );

  record(
    "Manager workspace",
    workspace.ok,
    `HTTP ${workspace.status}`,
  );

  const orders = await request(
    "/manager/kitchen/orders",
    {},
    sessions.manager,
  );

  record(
    "Manager kitchen orders",
    orders.ok,
    `HTTP ${orders.status}`,
  );

  const availability = await request(
    "/manager/menu-availability",
    {},
    sessions.manager,
  );

  record(
    "Manager menu availability",
    availability.ok,
    `HTTP ${availability.status}`,
  );
}

async function testPublicCustomerApis() {
  log("INFO", "Testing public customer APIs");

  const pincode =
    process.env.TEST_PINCODE || "500084";

  const serviceability = await request(
    `/customer/serviceability/${encodeURIComponent(pincode)}`,
  );

  record(
    "Pincode serviceability",
    serviceability.ok,
    `HTTP ${serviceability.status}`,
  );

  if (!serviceability.ok) {
    printBody("Serviceability response", serviceability.data);
  }

  const menu = await request(
    `/customer/menu?pincode=${encodeURIComponent(pincode)}`,
  );

  record(
    "Customer menu endpoint",
    menu.ok,
    `HTTP ${menu.status}`,
  );

  if (!menu.ok) {
    printBody("Menu response", menu.data);
  }
}

async function testAuthorization() {
  log("INFO", "Testing role restrictions");

  const adminProtected = await request("/admin/overview");

  record(
    "Admin endpoint rejects unauthenticated request",
    adminProtected.status === 401,
    `HTTP ${adminProtected.status}`,
  );

  if (sessions.customer) {
    const customerAdmin = await request(
      "/admin/overview",
      {},
      sessions.customer,
    );

    record(
      "Customer cannot access Admin",
      customerAdmin.status === 403,
      `HTTP ${customerAdmin.status}`,
    );
  }

  if (sessions.manager && sessions.customer) {
    const customerManager = await request(
      "/manager/workspace",
      {},
      sessions.customer,
    );

    record(
      "Customer cannot access Manager",
      customerManager.status === 403,
      `HTTP ${customerManager.status}`,
    );
  }
}

async function testCustomerOrderingBasics() {
  log("INFO", "Testing customer ordering APIs");

  if (!sessions.customer) {
    skip(
      "Customer cart and checkout",
      "Customer authentication failed",
    );
    return;
  }

  const bootstrap = await request(
    "/customer/bootstrap",
    {},
    sessions.customer,
  );

  record(
    "Customer bootstrap",
    bootstrap.ok,
    `HTTP ${bootstrap.status}`,
  );

  const profile = await request(
    "/customer/profile",
    {},
    sessions.customer,
  );

  record(
    "Customer profile",
    profile.ok,
    `HTTP ${profile.status}`,
  );

  const addresses = await request(
    "/customer/addresses",
    {},
    sessions.customer,
  );

  record(
    "Customer addresses",
    addresses.ok,
    `HTTP ${addresses.status}`,
  );

  const orders = await request(
    "/customer/orders",
    {},
    sessions.customer,
  );

  record(
    "Customer order history",
    orders.ok,
    `HTTP ${orders.status}`,
  );

  const rewards = await request(
    "/customer/rewards",
    {},
    sessions.customer,
  );

  record(
    "Customer loyalty summary",
    rewards.ok,
    `HTTP ${rewards.status}`,
  );
}

async function run() {
  console.log("\n======================================");
  console.log(" DASTARKHWAN BACKEND SMOKE TEST");
  console.log("======================================");
  console.log(`API: ${BASE_URL}\n`);

  try {
    // Health endpoint has a separate mount path.
    const root = BASE_URL.replace(/\/api\/v1\/?$/, "");
    const health = await fetch(`${root}/health`);

    const healthData = await health.json().catch(() => null);

    record(
      "API health",
      health.ok && healthData?.status === "ok",
      `HTTP ${health.status}`,
    );
  } catch (error) {
    record(
      "API health",
      false,
      error.message,
    );

    console.log("\nBackend is not reachable. Start it before running the test.");
    process.exitCode = 1;
    return;
  }

  try {
    await testCustomerAuth();
  } catch (error) {
    record("Customer authentication", false, error.message);
  }

  try {
    await testManagerAuth();
  } catch (error) {
    record("Manager authentication", false, error.message);
  }

  try {
    await testAdminAuth();
  } catch (error) {
    record("Admin authentication", false, error.message);
  }

  try {
    await testPublicCustomerApis();
  } catch (error) {
    record("Public customer APIs", false, error.message);
  }

  try {
    await testCustomerOrderingBasics();
  } catch (error) {
    record("Customer ordering APIs", false, error.message);
  }

  try {
    await testAuthorization();
  } catch (error) {
    record("Authorization tests", false, error.message);
  }

  console.log("\n======================================");
  console.log(" TEST SUMMARY");
  console.log("======================================");
  console.log(`Passed:  ${passed}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log("======================================\n");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Unexpected test runner error:", error);
  process.exitCode = 1;
});
