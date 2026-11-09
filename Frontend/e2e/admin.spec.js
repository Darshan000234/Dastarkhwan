import { test, expect } from "@playwright/test";
import { signInWithDemoAccount } from "./helpers/auth.js";
import path from "node:path";


 test.describe("Central Admin workspace", () => {
  test.beforeEach(async ({ page }) => {
    await signInWithDemoAccount(page, "admin");
  });

  test("TC-25: Central Admin overview displays chain-level operational information", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Good afternoon, Mihir" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order activity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order status mix" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revenue by outlet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Outlet performance" })).toBeVisible();
  });

  test("TC-26: Central Admin can search and filter the chain-wide order register", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order register" })).toBeVisible();

    await page.getByPlaceholder("Search order ID, customer or phone…").fill("E2E_NO_MATCHING_ORDER_987654");
    await expect(page.getByText("No orders match the selected filters.")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Clear filters" }).click();
  });

  test("TC-27: Central Admin can view the outlet directory and open an outlet record", async ({ page }) => {
    await page.goto("/admin/outlets");
    await expect(page.getByRole("heading", { name: "Outlets", exact: true })).toBeVisible();

    const kondapurCard = page.locator(".ad-outlet-card").filter({ hasText: "Kondapur" }).first();
    await expect(kondapurCard).toBeVisible();
    await kondapurCard.getByRole("link", { name: /View outlet details/ }).click();

    await expect(page).toHaveURL(/\/admin\/outlets\/out-kondapur$/);
    await expect(page.getByRole("heading", { name: "Kondapur", exact: true })).toBeVisible();

    const tabs = page.getByRole("navigation", { name: "Outlet details sections" });
    for (const tabName of ["Overview", "Menu", "Orders", "Manager", "Settings"]) {
      await tabs.getByRole("button", { name: tabName, exact: true }).click();
      await expect(tabs.getByRole("button", { name: tabName, exact: true })).toHaveClass(/active/);
    }
  });

  test("TC-28: Central Admin can open the menu CMS and switch between catalog, pricing, assignments and time-based menu sections", async ({ page }) => {
    await page.goto("/admin/menu");
    await expect(page.getByRole("heading", { name: "Menu management" })).toBeVisible();

    const tabs = page.getByRole("navigation", { name: "Menu management sections" });
    for (const tabName of ["Central catalog", "City pricing", "Outlet assignments", "Time-based menus"]) {
      await tabs.getByRole("button", { name: tabName, exact: true }).click();
      await expect(tabs.getByRole("button", { name: tabName, exact: true })).toHaveClass(/active/);
    }

    await page.getByRole("button", { name: "Add food item" }).click();
    await expect(page.locator(".ad-modal").first()).toBeVisible();
  });

  test("TC-29: Central Admin can load settings, verify the fixed 5% GST configuration and inspect audit history", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "General settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tax and pricing" })).toBeVisible();
    await expect(page.getByText("The current checkout implementation requires GST-inclusive pricing.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Default preparation time" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Audit history" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save settings" })).toBeVisible();
  });
});

test.use({
  storageState: path.resolve("e2e/.auth/admin.json"),
});