
import "dotenv/config";

const BASE_URL =
  process.env.TEST_API_URL || "http://localhost:5000/api/v1";

const API_ROOT = BASE_URL.replace(/\/api\/v1\/?$/, "");

const MANAGER_PHONE =
  process.env.TEST_MANAGER_PHONE || "9000000041";

const EXPECTED_OUTLET_ID =
  process.env.TEST_MANAGER_OUTLET_ID || "out-kondapur";

const TIMEOUT_MS = 12000;

let passed = 0;
let failed = 0;
let skipped = 0;

let managerCookie = null;
let managerOutletId = null;

function log(type, message) {
  const symbols = {
    PASS: "✅",
    FAIL: "❌",
    SKIP: "⚠️",
    INFO: "ℹ️",
  };

  console.log(`${symbols[type] || ""} ${message}`);
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

async function apiRequest(path, options = {}, cookie = managerCookie) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS,
  );

  try {
    const headers = {
      Accept: "application/json",
      ...(options.body !== undefined
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

/* =========================================================
   1. AUTHENTICATION
========================================================= */

async function authenticateManager() {
  log("INFO", "Authenticating Outlet Manager");

  const otpResponse = await apiRequest(
    "/auth/otp/request",
    {
      method: "POST",
      body: JSON.stringify({
        phone: MANAGER_PHONE,
        intent: "staff",
      }),
    },
    null,
  );

  if (!otpResponse.ok || !otpResponse.data?.devOtp) {
    throw new Error(
      `Manager OTP request failed: ${
        otpResponse.data?.message ||
        JSON.stringify(otpResponse.data)
      }`,
    );
  }

  const verifyResponse = await apiRequest(
    "/auth/otp/verify",
    {
      method: "POST",
      body: JSON.stringify({
        phone: MANAGER_PHONE,
        intent: "staff",
        otp: otpResponse.data.devOtp,
      }),
    },
    null,
  );

  if (!verifyResponse.ok) {
    throw new Error(
      `Manager OTP verification failed: ${
        verifyResponse.data?.message ||
        JSON.stringify(verifyResponse.data)
      }`,
    );
  }

  managerCookie =
    verifyResponse.setCookie?.split(";")[0] || null;

  if (!managerCookie) {
    throw new Error(
      "Login succeeded but the authentication cookie was not returned.",
    );
  }

  record("Manager OTP login", true);

  const session = await apiRequest("/auth/session");

  record(
    "Manager session",
    session.ok,
    `HTTP ${session.status}`,
  );

  const user = dataOf(session).user || dataOf(session);

  record(
    "Manager role verification",
    user.role === "outlet_manager",
    `Role: ${user.role || "not returned"}`,
  );
}

/* =========================================================
   COMMON GET TEST
========================================================= */

async function getEndpoint(name, path, expectedArrayKey = null) {
  const response = await apiRequest(path);

  const success =
    response.ok &&
    response.data?.success === true;

  if (!success) {
    record(
      name,
      false,
      `HTTP ${response.status}: ${
        response.data?.message ||
        JSON.stringify(response.data)
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

/* =========================================================
   2. WORKSPACE AND OUTLET ASSIGNMENT
========================================================= */

async function testWorkspace() {
  log("INFO", "Testing manager workspace");

  const result = await getEndpoint(
    "Manager workspace",
    "/manager/workspace",
  );

  if (!result) return;

  const { manager, outlet, operations, menu } = result.data;

  record(
    "Workspace manager information",
    Boolean(manager?.id && manager?.name),
  );

  managerOutletId = outlet?.id || null;

  record(
    "Workspace outlet information",
    Boolean(managerOutletId && outlet?.name),
    `Outlet: ${outlet?.name || "missing"}`,
  );

  record(
    "Manager assigned outlet isolation",
    managerOutletId === EXPECTED_OUTLET_ID,
    `Expected: ${EXPECTED_OUTLET_ID}, received: ${managerOutletId}`,
  );

  record(
    "Workspace operations summary",
    Boolean(
      operations &&
      Number.isFinite(operations.newOrders) &&
      Number.isFinite(operations.preparingOrders) &&
      Number.isFinite(operations.readyOrders) &&
      Number.isFinite(operations.lateOrders)
    ),
  );

  record(
    "Workspace menu summary",
    Boolean(
      menu &&
      Number.isFinite(menu.totalItems) &&
      Number.isFinite(menu.availableItems) &&
      Number.isFinite(menu.unavailableItems)
    ),
  );
}

/* =========================================================
   3. OVERVIEW
========================================================= */

async function testOverview() {
  log("INFO", "Testing manager overview");

  const result = await getEndpoint(
    "Manager overview",
    "/manager/overview?range=today",
  );

  if (!result) return;

  record(
    "Overview metrics structure",
    [
      "totalOrders",
      "activeOrders",
      "lateOrders",
      "revenue",
    ].some((key) => key in result.data),
    "Checking overview metrics",
  );

  const invalidRange = await apiRequest(
    "/manager/overview?range=invalid",
  );

  record(
    "Overview rejects invalid date range",
    invalidRange.status === 400,
    `HTTP ${invalidRange.status}`,
  );
}

/* =========================================================
   4. KITCHEN DISPLAY
========================================================= */

async function testKitchenOrders() {
  log("INFO", "Testing Kitchen Display System");

  const result = await getEndpoint(
    "Kitchen orders",
    "/manager/kitchen/orders?status=all&page=1&limit=10",
    "orders",
  );

  if (result) {
    const lanes = result.data.lanes;

    record(
      "Kitchen order lanes",
      Boolean(
        lanes &&
        Array.isArray(lanes.new) &&
        Array.isArray(lanes.preparing) &&
        Array.isArray(lanes.ready)
      ),
      "NEW / PREPARING / READY",
    );
  }

  const lateOrders = await getEndpoint(
    "Late kitchen orders",
    "/manager/kitchen/late-orders?page=1&limit=10",
    "orders",
  );

  if (lateOrders) {
    record(
      "Late order notification fields",
      lateOrders.rows.every(
        (order) =>
          typeof order.isCriticalLate === "boolean" &&
          typeof order.lateMinutes === "number",
      ),
      "Checking late-order metadata",
    );
  }

  const invalidStatus = await apiRequest(
    "/manager/kitchen/orders?status=INVALID_STATUS",
  );

  record(
    "Kitchen rejects invalid order status",
    invalidStatus.status === 400,
    `HTTP ${invalidStatus.status}`,
  );

  const invalidQuery = await apiRequest(
    "/manager/kitchen/orders?unexpectedFilter=true",
  );

  record(
    "Kitchen rejects unsupported query parameters",
    invalidQuery.status === 400,
    `HTTP ${invalidQuery.status}`,
  );
}

/* =========================================================
   5. ORDER LIST, DETAILS AND TIMELINE
========================================================= */

async function testOrders() {
  log("INFO", "Testing manager order management");

  const result = await getEndpoint(
    "Manager order listing",
    "/manager/orders?page=1&limit=10&scope=all",
    "orders",
  );

  const invalidScope = await apiRequest(
    "/manager/orders?scope=invalid",
  );

  record(
    "Manager rejects invalid order scope",
    invalidScope.status === 400,
    `HTTP ${invalidScope.status}`,
  );

  if (!result) return;

  let orderIdentifier = null;

  if (result.rows.length > 0) {
    const order = result.rows[0];

    orderIdentifier =
      order.orderId ||
      order.id ||
      order.orderNumber;
  }

  if (!orderIdentifier) {
    skip(
      "Order details",
      "No orders exist in this manager's assigned outlet",
    );

    skip(
      "Order timeline",
      "No orders exist in this manager's assigned outlet",
    );

    return;
  }

  const encodedId = encodeURIComponent(orderIdentifier);

  const detail = await getEndpoint(
    "Manager order details",
    `/manager/orders/${encodedId}`,
  );

  if (detail) {
    record(
      "Order details structure",
      Boolean(detail.data.order?.orderId),
    );
  }

  const timeline = await getEndpoint(
    "Manager order timeline",
    `/manager/orders/${encodedId}/timeline`,
  );

  if (timeline) {
    record(
      "Order timeline structure",
      Array.isArray(timeline.data.events) &&
      Array.isArray(timeline.data.etaOverrides),
    );
  }
}

/* =========================================================
   6. MENU AVAILABILITY
========================================================= */

async function testMenuAvailability() {
  log("INFO", "Testing outlet menu availability");

  const result = await getEndpoint(
    "Manager menu availability",
    "/manager/menu-availability?page=1&limit=10",
    "menuItems",
  );

  if (result) {
    record(
      "Menu availability summary",
      Boolean(
        result.data.summary &&
        Number.isFinite(result.data.summary.totalItems) &&
        Number.isFinite(result.data.summary.availableItems) &&
        Number.isFinite(result.data.summary.unavailableItems)
      ),
    );

    if (managerOutletId) {
      record(
        "Menu availability list returned",
        result.data.menuItems.length >= 0,
      );
    }
  }

  const invalidAvailability = await apiRequest(
    "/manager/menu-availability?isAvailable=maybe",
  );

  record(
    "Menu availability rejects invalid boolean filter",
    invalidAvailability.status === 400,
    `HTTP ${invalidAvailability.status}`,
  );

  const invalidFoodType = await apiRequest(
    "/manager/menu-availability?foodType=INVALID",
  );

  record(
    "Menu availability rejects invalid food type",
    invalidFoodType.status === 400,
    `HTTP ${invalidFoodType.status}`,
  );
}

/* =========================================================
   7. PERFORMANCE
========================================================= */

async function testPerformance() {
  log("INFO", "Testing outlet performance");

  const result = await getEndpoint(
    "Manager performance",
    "/manager/performance?range=7d",
  );

  if (result) {
    const data = result.data;

    record(
      "Performance metrics structure",
      [
        "totalOrders",
        "completedOrders",
        "cancelledOrders",
        "activeOrders",
        "revenue",
      ].every((key) => key in data),
      "Checking performance summary",
    );

    record(
      "Performance status distribution",
      Array.isArray(data.statusDistribution),
    );

    record(
      "Performance trend data",
      Array.isArray(data.trend),
    );
  }

  const invalidRange = await apiRequest(
    "/manager/performance?range=invalid",
  );

  record(
    "Performance rejects invalid date range",
    invalidRange.status === 400,
    `HTTP ${invalidRange.status}`,
  );
}

/* =========================================================
   8. MANAGER ACCOUNT
========================================================= */

async function testAccount() {
  log("INFO", "Testing manager account");

  const result = await getEndpoint(
    "Manager account",
    "/manager/account",
  );

  if (!result) return;

  const { manager, outlet } = result.data;

  record(
    "Account manager profile",
    Boolean(
      manager?.id &&
      manager?.name &&
      manager?.phone &&
      manager?.role === "OUTLET_MANAGER"
    ),
  );

  record(
    "Account assigned outlet",
    Boolean(
      outlet?.id &&
      outlet?.name &&
      outlet.id === managerOutletId
    ),
    `Outlet: ${outlet?.name || "missing"}`,
  );
}

/* =========================================================
   9. SAFE PATCH VALIDATION TESTS
   These intentionally do not update real data.
========================================================= */

async function testPatchValidation() {
  log("INFO", "Testing safe PATCH validation");

  const fakeOrderId = "__manager_smoke_test_missing_order__";
  const fakeFoodId = "__manager_smoke_test_missing_food__";

  // Test invalid status before any database update.
  const invalidStatus = await apiRequest(
    `/manager/orders/${fakeOrderId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    },
  );

  record(
    "Order status rejects missing status",
    invalidStatus.status === 400,
    `HTTP ${invalidStatus.status}`,
  );

  // A valid request body with a nonexistent order must return 404.
  // It cannot mutate an existing order.
  const missingOrderEta = await apiRequest(
    `/manager/orders/${fakeOrderId}/eta`,
    {
      method: "PATCH",
      body: JSON.stringify({
        minutes: 30,
        reason: "Non-destructive smoke test",
      }),
    },
  );

  record(
    "ETA override rejects nonexistent order",
    missingOrderEta.status === 404,
    `HTTP ${missingOrderEta.status}`,
  );

  // Missing availability value must be rejected before DB mutation.
  const invalidAvailability = await apiRequest(
    `/manager/menu-availability/${fakeFoodId}`,
    {
      method: "PATCH",
      body: JSON.stringify({}),
    },
  );

  record(
    "Menu availability rejects missing boolean",
    invalidAvailability.status === 400,
    `HTTP ${invalidAvailability.status}`,
  );

  // Unknown fields are rejected before the manager profile is updated.
  const invalidAccount = await apiRequest(
    "/manager/account",
    {
      method: "PATCH",
      body: JSON.stringify({
        outletId: "out-gachibowli",
      }),
    },
  );

  record(
    "Account update rejects unauthorized fields",
    invalidAccount.status === 400,
    `HTTP ${invalidAccount.status}`,
  );
}

/* =========================================================
   10. AUTHORIZATION
========================================================= */

async function testAuthorization() {
  log("INFO", "Testing manager authorization");

  const unauthenticated = await apiRequest(
    "/manager/workspace",
    {},
    null,
  );

  record(
    "Manager API rejects unauthenticated request",
    unauthenticated.status === 401,
    `HTTP ${unauthenticated.status}`,
  );

  const unauthenticatedPatch = await apiRequest(
    "/manager/account",
    {
      method: "PATCH",
      body: JSON.stringify({
        fullName: "Unauthorized Update",
      }),
    },
    null,
  );

  record(
    "Manager PATCH rejects unauthenticated request",
    unauthenticatedPatch.status === 401,
    `HTTP ${unauthenticatedPatch.status}`,
  );
}

/* =========================================================
   MAIN RUNNER
========================================================= */

async function run() {
  console.log("\n======================================");
  console.log(" DASTARKHWAN MANAGER SMOKE TEST");
  console.log("======================================");
  console.log(`API: ${BASE_URL}`);
  console.log(`Manager phone: ${MANAGER_PHONE}`);
  console.log(`Expected outlet: ${EXPECTED_OUTLET_ID}\n`);

  // Health check
  try {
    const response = await fetch(`${API_ROOT}/health`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = await response.json().catch(() => null);

    record(
      "API health",
      response.ok && body?.status === "ok",
      `HTTP ${response.status}`,
    );
  } catch (error) {
    record("API health", false, error.message);

    console.log("\nBackend is not reachable. Start it first.");

    process.exitCode = 1;
    return;
  }

  // Authentication is required before protected tests.
  try {
    await authenticateManager();
  } catch (error) {
    record("Manager authentication", false, error.message);

    console.log("\nManager tests stopped because authentication failed.");
    process.exitCode = 1;
    return;
  }

  const tests = [
    ["Workspace", testWorkspace],
    ["Overview", testOverview],
    ["Kitchen Display", testKitchenOrders],
    ["Orders", testOrders],
    ["Menu Availability", testMenuAvailability],
    ["Performance", testPerformance],
    ["Account", testAccount],
    ["PATCH Validation", testPatchValidation],
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
  console.log(" MANAGER TEST SUMMARY");
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
