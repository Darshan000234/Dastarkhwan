import { test, expect } from "@playwright/test";
import { signInWithDemoAccount } from "./helpers/auth.js";
import { watchRuntimeErrors } from "./helpers/runtime.js";

 test.describe("Failure handling and application stability", () => {
  test("TC-30: Admin layout remains usable when the overview API request fails", async ({ page }) => {
    await signInWithDemoAccount(page, "admin");
    const assertNoRuntimeErrors = await watchRuntimeErrors(page);

    await page.route("**/api/v1/admin/overview", (route) => route.abort());
    await page.goto("/admin/orders");

    await expect(page.locator(".ad-app-shell")).toBeVisible();
    await expect(page.getByRole("link", { name: "Orders", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();

    await assertNoRuntimeErrors();
  });

  test("TC-31: Admin layout remains visible when an outlet details API request fails", async ({ page }) => {
    await signInWithDemoAccount(page, "admin");
    const assertNoRuntimeErrors = await watchRuntimeErrors(page);

    await page.route("**/api/v1/admin/outlets/out-kondapur", (route) => route.abort());
    await page.goto("/admin/outlets/out-kondapur");

    await expect(page.locator(".ad-app-shell")).toBeVisible();
    await expect(page.getByRole("link", { name: "Outlets", exact: true })).toBeVisible();
    await expect(page.locator(".ad-content")).toBeVisible();

    await assertNoRuntimeErrors();
  });

  test("TC-32: Customer menu displays an error state instead of crashing when menu API requests fail", async ({ page }) => {
    await signInWithDemoAccount(page, "customer");

    await page.route("**/api/v1/customer/menu**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "Test service unavailable" }),
      }),
    );

    await page.goto("/customer");
    await expect(page.locator(".cu-inline-warning")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".cu-page").first()).toBeVisible();
  });
});
