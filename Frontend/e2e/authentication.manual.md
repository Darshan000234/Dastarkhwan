import { test, expect } from "@playwright/test";
import { signInWithDemoAccount, expectAuthenticatedSession } from "./helpers/auth.js";

 test.describe("Authentication and role-based navigation", () => {
  test("TC-01: Guest users are redirected when they open protected workspaces", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/staff-login/);

    await page.goto("/manager");
    await expect(page).toHaveURL(/\/staff-login/);

    await page.goto("/customer/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("TC-02: Customer can sign in with the development OTP and retain the session after refresh", async ({ page }) => {
    await signInWithDemoAccount(page, "customer");
    await expectAuthenticatedSession(page, "customer");

    await page.reload();
    await expect(page).toHaveURL(/\/customer(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Explore the menu" })).toBeVisible({ timeout: 30_000 });
    await expectAuthenticatedSession(page, "customer");
  });

  test("TC-03: Central Admin can sign in and open the central operations dashboard", async ({ page }) => {
    await signInWithDemoAccount(page, "admin");
    await expectAuthenticatedSession(page, "central_admin");
    await expect(page.locator(".ad-app-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Good afternoon, Mihir" })).toBeVisible();
  });

  test("TC-04: Outlet Manager can sign in and is routed to the manager workspace", async ({ page }) => {
    await signInWithDemoAccount(page, "manager");
    await expectAuthenticatedSession(page, "outlet_manager");
    await expect(page.locator(".om-app-shell")).toBeVisible();
    await expect(page.getByText("Kondapur", { exact: true }).first()).toBeVisible();
  });

  test("TC-05: A signed-in customer cannot open Central Admin or Manager routes", async ({ page }) => {
    await signInWithDemoAccount(page, "customer");

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/customer(?:\?.*)?$/);

    await page.goto("/manager");
    await expect(page).toHaveURL(/\/customer(?:\?.*)?$/);
  });

  test("TC-06: Customer can sign out and the backend session is cleared", async ({ page }) => {
    await signInWithDemoAccount(page, "customer");
    await page.getByRole("button", { name: "Open profile menu" }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();

    await expect(page).toHaveURL(/\/login/);
    const response = await page.context().request.get("http://localhost:5000/api/v1/auth/session");
    expect(response.status()).toBe(401);
  });

  test("TC-07: Customer sign-up form displays validation messages for missing or invalid details", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(page.getByText("Enter your full name.")).toBeVisible();
    await expect(page.getByText("Enter a valid 6-digit Indian delivery pincode.")).toBeVisible();
    await expect(page.getByText("Enter a valid 10-digit Indian mobile number.")).toBeVisible();
    await expect(page.getByText("Accept the Terms and Privacy Policy to create an account.")).toBeVisible();
  });
});
