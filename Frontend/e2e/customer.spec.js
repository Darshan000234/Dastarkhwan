import { test, expect } from "@playwright/test";
import { signInWithDemoAccount } from "./helpers/auth.js";
import path from "node:path";
import { signInAndPrepareChicken65Checkout, completeMockPayment } from "./helpers/customer-flow.js";

 test.describe("Customer ordering journey", () => {
  test("TC-08: Guest can check delivery serviceability and load the menu for the seeded Kondapur pincode", async ({ page }) => {
    await page.goto("/customer");

    const serviceabilityResponse = page.waitForResponse((response) =>
      response.url().includes("/api/v1/customer/serviceability/500084"),
    );

    await page.getByLabel("Delivery pincode").fill("500084");
    await page.getByRole("button", { name: "Check availability" }).click();

    const response = await serviceabilityResponse;
    expect(response.status()).toBe(200);
    await expect(page.locator(".cu-outlet-strip h1")).toHaveText("Kondapur", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Explore the menu" })).toBeVisible();
  });

  test("TC-09: Guest receives a clear message when the pincode is not serviceable", async ({ page }) => {
    await page.goto("/customer");
    await page.getByLabel("Delivery pincode").fill("999999");
    await page.getByRole("button", { name: "Check availability" }).click();

    await expect(page.locator(".cu-form-error")).toBeVisible();
    await expect(page.locator(".cu-outlet-strip")).toHaveCount(0);
  });

  test("TC-10: Customer can open the menu, search for a dish and view its customisation options", async ({ page }) => {
    await signInWithDemoAccount(page, "customer");
    await page.goto("/customer");

    await expect(page.getByRole("heading", { name: "Explore the menu" })).toBeVisible({ timeout: 30_000 });
    await page.getByPlaceholder("Search biryani, starters, desserts…").fill("Chicken 65");

    const card = page.locator(".cu-food-card").filter({ hasText: "Chicken 65" }).first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Customise", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Chicken 65 details" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Chicken 65", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Add ·/ })).toBeVisible();
  });

  test("TC-11: An item marked unavailable by the selected outlet cannot be added to the cart", async ({ page }) => {
    await signInWithDemoAccount(page, "customer");
    await page.goto("/customer");
    await expect(page.getByRole("heading", { name: "Explore the menu" })).toBeVisible({ timeout: 30_000 });

    await page.getByPlaceholder("Search biryani, starters, desserts…").fill("Double Meetha");
    const card = page.locator(".cu-food-card").filter({ hasText: "Double Meetha" }).first();
    await expect(card).toBeVisible();
    await expect(card.locator(".cu-unavailable-label")).toBeVisible();
    await expect(card.getByRole("button", { name: "Customise", exact: true })).toHaveCount(0);
  });

  test("TC-12: A failed mock payment does not finalise an order and keeps the customer on the payment screen", async ({ page }) => {
    await signInAndPrepareChicken65Checkout(page);

    let finaliseOrderCalls = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/customer/orders")
      ) {
        finaliseOrderCalls += 1;
      }
    });

    await completeMockPayment(page, "failed");
    await expect(page.getByText(/demo payment failed/i)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/customer\/payment$/);
    expect(finaliseOrderCalls).toBe(0);
  });

  test("TC-13: A cancelled mock payment does not finalise an order", async ({ page }) => {
    await signInAndPrepareChicken65Checkout(page);

    let finaliseOrderCalls = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/customer/orders")
      ) {
        finaliseOrderCalls += 1;
      }
    });

    await completeMockPayment(page, "cancelled");
    await expect(page.getByText(/Payment was cancelled/i)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/customer\/payment$/);
    expect(finaliseOrderCalls).toBe(0);
  });

  test("TC-14: Customer can open My Orders and the rewards section after signing in", async ({ page }) => {
    await signInWithDemoAccount(page, "customer");
    await page.goto("/customer/orders");
    await expect(page.locator(".cu-page").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /orders/i }).first()).toBeVisible();

    await page.goto("/customer/rewards");
    await expect(page.locator(".cu-page").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.use({
  storageState: path.resolve("e2e/.auth/customer.json"),
});
