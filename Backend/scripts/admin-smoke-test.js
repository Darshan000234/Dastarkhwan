
import "dotenv/config";

const BASE_URL =
  process.env.TEST_API_URL || "http://localhost:5000/api/v1";

const API_ROOT = BASE_URL.replace(/\/api\/v1\/?$/, "");
const ADMIN_PHONE = process.env.TEST_ADMIN_PHONE || "9000000001";
const TIMEOUT_MS = 12000;

let passed = 0;
let failed = 0;
let skipped = 0;

let adminCookie = null;

function log(type, message) {
  const symbols = {
    PASS: "✅",
    FAIL: "❌",
    SKIP: "⚠️",
    INFO: "ℹ️",
  };

  console.log(`${symbols[type]} ${message}`);
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

function dataOf(response) {
  return response?.data?.data ?? response?.data ?? {};
}

async function apiRequest(path, options = {}, cookie = adminCookie) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS,
  );

  try {
    const headers = {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    };

    if (cookie) {
      headers.Cookie = cookie;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const text = await response.text();

    let body = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      data: body,
      setCookie: response.headers.get("set-cookie"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticateAdmin() {
  log("INFO", "Authenticating Central Admin");

  const otpResponse = await apiRequest(
    "/auth/otp/request",
    {
      method: "POST",
      body: JSON.stringify({
        phone: ADMIN_PHONE,
        intent: "staff",
      }),
    },
    null,
  );

  if (!otpResponse.ok || !otpResponse.data?.devOtp) {
    throw new Error(
      `Admin OTP request failed: ${
        otpResponse.data?.message || JSON.stringify(otpResponse.data)
      }`,
    );
  }

  const verifyResponse = await apiRequest(
    "/auth/otp/verify",
    {
      method: "POST",
      body: JSON.stringify({
        phone: ADMIN_PHONE,
        intent: "staff",
        otp: otpResponse.data.devOtp,
      }),
    },
    null,
  );

  if (!verifyResponse.ok) {
    throw new Error(
      `Admin OTP verification failed: ${
        verifyResponse.data?.message ||
        JSON.stringify(verifyResponse.data)
      }`,
    );
  }

  adminCookie =
    verifyResponse.setCookie?.split(";")[0] || null;

  if (!adminCookie) {
    throw new Error(
      "Admin login succeeded but the authentication cookie was not returned.",
    );
  }

  record("Central Admin OTP login", true);

  const session = await apiRequest("/auth/session");

  const sessionData = dataOf(session);
  const user = sessionData.user || sessionData;

  record(
    "Admin session",
    session.ok,
    `HTTP ${session.status}`,
  );

  record(
    "Admin role verification",
    user.role === "central_admin",
    `Role: ${user.role || "not returned"}`,
  );
}

async function getEndpoint(name, path, expectedArrayKey = null) {
  const response = await apiRequest(path);

  const success =
    response.ok &&
    response.data?.success !== false;

  if (!success) {
    record(
      name,
      false,
      `HTTP ${response.status}: ${
        response.data?.message || "Request failed"
      }`,
    );

    return null;
  }

  const data = dataOf(response);

  if (expectedArrayKey) {
    const rows = data[expectedArrayKey];

    if (!Array.isArray(rows)) {
      record(
        name,
        false,
        `Expected "${expectedArrayKey}" array was not returned`,
      );

      return null;
    }

    record(
      name,
      true,
      `HTTP ${response.status}, ${rows.length} records`,
    );

    return {
      data,
      rows,
    };
  }

  record(name, true, `HTTP ${response.status}`);

  return {
    data,
  };
}

async function testHealth() {
  log("INFO", "Checking backend health");

  const response = await fetch(`${API_ROOT}/health`);

  const body = await response.json().catch(() => null);

  record(
    "API health",
    response.ok && body?.status === "ok",
    `HTTP ${response.status}`,
  );
}

async function testAdminOverview() {
  log("INFO", "Testing Admin overview");

  await getEndpoint(
    "Admin overview",
    "/admin/overview",
  );
}

async function testAuditAndSettings() {
  log("INFO", "Testing Admin audit logs and settings");

  await getEndpoint(
    "Admin audit logs",
    "/admin/audit-log?page=1&limit=5",
    "logs",
  );

  await getEndpoint(
    "Admin settings",
    "/admin/settings",
  );

  const invalidFilter = await apiRequest(
    "/admin/audit-log?unexpectedFilter=test",
  );

  record(
    "Admin rejects unsupported audit filter",
    invalidFilter.status === 400,
    `HTTP ${invalidFilter.status}`,
  );
}

async function testOrders() {
  log("INFO", "Testing Admin orders");

  const result = await getEndpoint(
    "Admin order listing",
    "/admin/orders?page=1&limit=5",
    "orders",
  );

  if (!result) return;

  const order = result.rows[0];

  if (!order) {
    skip("Admin order detail", "No order exists in the database");
    return;
  }

  const orderId = order.id || order.orderNumber;

  if (!orderId) {
    skip("Admin order detail", "No usable order ID in list response");
    return;
  }

  await getEndpoint(
    "Admin order detail",
    `/admin/orders/${encodeURIComponent(orderId)}`,
  );
}

async function testOutlets() {
  log("INFO", "Testing outlet management");

  const result = await getEndpoint(
    "Admin outlet listing",
    "/admin/outlets?page=1&limit=5",
    "outlets",
  );

  if (!result) return;

  const outlet = result.rows[0];

  if (!outlet?.id) {
    skip("Outlet details", "No outlet is available in the database");
    skip("Outlet analytics", "No outlet is available in the database");
    skip("Outlet orders", "No outlet is available in the database");
    skip("Outlet menu", "No outlet is available in the database");
    return;
  }

  const outletId = encodeURIComponent(outlet.id);

  await getEndpoint(
    "Outlet details",
    `/admin/outlets/${outletId}`,
  );

  await getEndpoint(
    "Outlet analytics",
    `/admin/outlets/${outletId}/analytics`,
  );

  await getEndpoint(
    "Outlet orders",
    `/admin/outlets/${outletId}/orders?page=1&limit=5`,
    "orders",
  );

  await getEndpoint(
    "Outlet menu",
    `/admin/outlets/${outletId}/menu?page=1&limit=5`,
    "menuItems",
  );
}

async function testMenuCMS() {
  log("INFO", "Testing Menu CMS");

  const catalog = await getEndpoint(
    "Menu catalog listing",
    "/admin/menu/catalog?page=1&limit=5",
    "items",
  );

  if (catalog) {
    const item = catalog.rows[0];

    if (item?.id) {
      await getEndpoint(
        "Menu catalog item detail",
        `/admin/menu/catalog/${encodeURIComponent(item.id)}`,
      );
    } else {
      skip(
        "Menu catalog item detail",
        "No catalog item exists in the database",
      );
    }
  }

  await getEndpoint(
    "Time menu listing",
    "/admin/menu/time-menus?page=1&limit=5",
    "timeMenus",
  );
}

async function testAuthorization() {
  log("INFO", "Testing Admin authorization");

  const publicResponse = await apiRequest(
    "/admin/overview",
    {},
    null,
  );

  record(
    "Admin rejects unauthenticated requests",
    publicResponse.status === 401,
    `HTTP ${publicResponse.status}`,
  );
}

async function run() {
  console.log("\n======================================");
  console.log(" DASTARKHWAN ADMIN SMOKE TEST");
  console.log("======================================");
  console.log(`API: ${BASE_URL}`);
  console.log(`Admin phone: ${ADMIN_PHONE}\n`);

  try {
    await testHealth();
  } catch (error) {
    record("API health", false, error.message);
    console.log("\nBackend is not reachable. Start it first.");
    process.exitCode = 1;
    return;
  }

  try {
    await authenticateAdmin();
  } catch (error) {
    record("Admin authentication", false, error.message);
    console.log("\nAdmin tests stopped because authentication failed.");
    process.exitCode = 1;
    return;
  }

  const tests = [
    ["Admin overview", testAdminOverview],
    ["Audit and settings", testAuditAndSettings],
    ["Orders", testOrders],
    ["Outlets", testOutlets],
    ["Menu CMS", testMenuCMS],
    ["Authorization", testAuthorization],
  ];

  for (const [name, test] of tests) {
    try {
      await test();
    } catch (error) {
      record(name, false, error.message);
    }
  }

  console.log("\n======================================");
  console.log(" ADMIN TEST SUMMARY");
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
