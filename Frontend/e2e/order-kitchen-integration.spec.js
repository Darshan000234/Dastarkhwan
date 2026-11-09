
import path from "node:path";
import { test, expect } from "@playwright/test";

import {
  prepareChicken65Checkout,
  completeMockPayment,
} from "./helpers/customer-flow.js";

test(
  "TC-15 to TC-20: Customer order reaches the assigned kitchen and completes the order lifecycle",
  async ({ browser }) => {
    test.setTimeout(180_000);

    // Reuse manually authenticated sessions.
    const customerContext = await browser.newContext({
      baseURL: "http://localhost:5173",
      storageState: path.resolve("e2e/.auth/customer.json"),
    });

    const managerContext = await browser.newContext({
      baseURL: "http://localhost:5173",
      storageState: path.resolve("e2e/.auth/manager.json"),
    });

    try {
      const customerPage = await customerContext.newPage();
      const managerPage = await managerContext.newPage();

      // STEP 1: Customer prepares the Chicken 65 checkout.
      // This helper must not perform OTP authentication.
      await customerPage.goto("/customer");

      await prepareChicken65Checkout(customerPage);

      // STEP 2: Wait for backend order finalisation.
      const finaliseResponsePromise =
        customerPage.waitForResponse((response) => {
          const request = response.request();

          return (
            request.method() === "POST" &&
            new URL(response.url()).pathname ===
              "/api/v1/customer/orders"
          );
        });

      await completeMockPayment(customerPage, "success");

      const finaliseResponse = await finaliseResponsePromise;

      expect(
        finaliseResponse.ok(),
        "Customer order finalisation should succeed"
      ).toBeTruthy();

      // STEP 3: Verify customer order confirmation.
      await expect(customerPage).toHaveURL(
        /\/customer\/order\/[^/?]+$/,
        { timeout: 45_000 }
      );

      await expect(
        customerPage.getByRole("heading", {
          name: "Kitchen updates",
        })
      ).toBeVisible();

      await expect(
        customerPage.locator(".cu-order-success")
      ).toContainText(/ORDER CONFIRMED/i);

      const orderNumber = (
        await customerPage
          .locator(".cu-order-success p strong")
          .innerText()
      ).trim();

      expect(orderNumber).toMatch(/^WEB-/);

      // STEP 4: Manager opens the assigned outlet's kitchen.
      await managerPage.goto("/manager/kitchen");

      await expect(
        managerPage.getByText("Kondapur · Kitchen Display")
      ).toBeVisible({ timeout: 30_000 });

      const orderCard = managerPage
        .locator(".om-kitchen-card")
        .filter({ hasText: orderNumber });

      await expect(orderCard).toBeVisible({
        timeout: 45_000,
      });

      await expect(orderCard).toContainText("Chicken 65");

      // STEP 5: PLACED -> ACCEPTED.
      await orderCard
        .getByRole("button", {
          name: "Accept Order",
          exact: true,
        })
        .click();

      await expect(
        orderCard.getByRole("button", {
          name: "Start Preparing",
          exact: true,
        })
      ).toBeVisible();

      // STEP 6: ACCEPTED -> PREPARING.
      await orderCard
        .getByRole("button", {
          name: "Start Preparing",
          exact: true,
        })
        .click();

      await expect(
        orderCard.getByRole("button", {
          name: "Mark as Ready",
          exact: true,
        })
      ).toBeVisible();

      // STEP 7: PREPARING -> READY.
      await orderCard
        .getByRole("button", {
          name: "Mark as Ready",
          exact: true,
        })
        .click();

      await expect(
        orderCard.getByRole("button", {
          name: "Mark Handed Off",
          exact: true,
        })
      ).toBeVisible();

      // STEP 8: READY -> HANDED_OFF.
      await orderCard
        .getByRole("button", {
          name: "Mark Handed Off",
          exact: true,
        })
        .click();

      // Handed-off order should leave active kitchen lanes.
      await expect(orderCard).toHaveCount(0, {
        timeout: 30_000,
      });

      // STEP 9: Verify final customer tracking state.
      await expect(
        customerPage.locator(".cu-order-success")
      ).toContainText(/handed off/i, {
        timeout: 25_000,
      });

      // STEP 10: Verify state survives a server refresh.
      await customerPage
        .getByRole("button", {
          name: /Refresh order status/,
        })
        .click();

      await expect(
        customerPage.locator(".cu-order-success")
      ).toContainText(/handed off/i);

    } finally {
      await customerContext.close();
      await managerContext.close();
    }
  }
);
