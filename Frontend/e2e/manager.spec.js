import { test, expect } from "@playwright/test";
import { signInWithDemoAccount } from "./helpers/auth.js";
import path from "node:path";

 test.describe("Outlet Manager workspace", () => {
  test("TC-21: Manager dashboard shows data for the manager's assigned outlet", async ({ page }) => {
    await signInWithDemoAccount(page, "manager");
    await expect(page.getByRole("heading", { name: "Good shift, good service." })).toBeVisible();
    await expect(page.locator(".om-outlet-banner")).toContainText("Kondapur");
    await expect(page.locator(".om-metric-grid")).toBeVisible();
  });

  test("TC-22: Manager can open the kitchen display and view all order lanes", async ({ page }) => {
    await signInWithDemoAccount(page, "manager");
    await page.getByRole("link", { name: "Kitchen Display" }).click();

    await expect(page).toHaveURL(/\/manager\/kitchen$/);
    await expect(page.getByRole("heading", { name: "NEW", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "PREPARING", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "READY FOR HANDOFF", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh data" })).toBeVisible();
  });

  test("TC-23: Manager can navigate to the order register, menu availability, performance and account pages", async ({ page }) => {
    await signInWithDemoAccount(page, "manager");

    await page.getByRole("link", { name: "Orders", exact: true }).click();
    await expect(page).toHaveURL(/\/manager\/orders$/);
    await expect(page.locator(".om-content")).toBeVisible();

    await page.getByRole("link", { name: "Menu Availability", exact: true }).click();
    await expect(page).toHaveURL(/\/manager\/menu-availability$/);
    await expect(page.getByRole("heading", { name: "Menu availability" })).toBeVisible();
    await expect(page.getByPlaceholder("Search dishes")).toBeVisible();

    await page.getByRole("link", { name: "Performance", exact: true }).click();
    await expect(page).toHaveURL(/\/manager\/performance$/);
    await expect(page.locator(".om-content")).toBeVisible();

    await page.getByRole("link", { name: "My Account", exact: true }).click();
    await expect(page).toHaveURL(/\/manager\/account$/);
    await expect(page.locator(".om-content")).toBeVisible();
  });

  test("TC-24: A manager signed in for Gachibowli sees the Gachibowli workspace rather than the Kondapur workspace", async ({ page }) => {
    await signInWithDemoAccount(page, "managerGachibowli");

    await expect(page.locator(".om-outlet-banner")).toContainText("Gachibowli Cloud Kitchen");
    await expect(page.locator(".om-outlet-banner")).not.toContainText("Kondapur");
  });
});


test.use({
  storageState: path.resolve("e2e/.auth/manager.json"),
});