import { expect } from "@playwright/test";
import { signInWithDemoAccount } from "./auth.js";

/**
 * Uses the seeded customer and seeded Kondapur menu item Chicken 65.
 * Leaves the browser on the checkout payment screen.
 */
export async function signInAndPrepareChicken65Checkout(page) {
  await signInWithDemoAccount(page, "customer");
  await page.goto("/customer");

  await expect(
    page.getByRole("heading", { name: "Explore the menu" }),
  ).toBeVisible({ timeout: 30_000 });

  const search = page.getByPlaceholder("Search biryani, starters, desserts…");
  await search.fill("Chicken 65");

  const foodCard = page.locator(".cu-food-card").filter({ hasText: "Chicken 65" }).first();
  await expect(foodCard).toBeVisible();
  await foodCard.getByRole("button", { name: "Customise", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Chicken 65 details" });
  await expect(dialog).toBeVisible();

  // Select the minimum number of options in every required add-on group.
  const requiredGroups = dialog
    .locator(".cu-customise-section")
    .filter({ hasText: /Choose at least \d+/ });

  for (let groupIndex = 0; groupIndex < await requiredGroups.count(); groupIndex += 1) {
    const group = requiredGroups.nth(groupIndex);
    const heading = await group.locator("strong small").innerText();
    const minimum = Number(heading.match(/Choose at least (\d+)/)?.[1] || 1);
    const options = group.locator('input[type="checkbox"]');

    expect(
      await options.count(),
      "Every required add-on group should contain enough selectable options",
    ).toBeGreaterThanOrEqual(minimum);

    for (let optionIndex = 0; optionIndex < minimum; optionIndex += 1) {
      await options.nth(optionIndex).check();
    }
  }

  const addButton = dialog.getByRole("button", { name: /^Add ·/ });
  await expect(addButton).toBeEnabled();
  await addButton.click();

  await page.locator('button[aria-label^="Cart with"]').click();
  const cart = page.getByRole("complementary", { name: "Your cart" });
  await expect(cart).toBeVisible();
  await expect(cart).toContainText("Chicken 65");
  await expect(cart).toContainText("Prices inclusive of GST");

  await cart.getByRole("button", { name: "Continue to checkout" }).click();

  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  const savedAddress = page.locator(".cu-address-choice").first();
  await expect(savedAddress).toBeVisible();

  const addressClass = (await savedAddress.getAttribute("class")) || "";
  if (!addressClass.includes("is-selected")) {
    await savedAddress.click();
  }

  await expect(
    page.getByRole("button", { name: "Continue to payment" }),
  ).toBeEnabled({ timeout: 30_000 });

  await expect(page.locator(".cu-gst-note")).toContainText(/GST/i);
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page).toHaveURL(/\/customer\/payment$/);
  await expect(
    page.getByRole("heading", { name: "Choose how to pay." }),
  ).toBeVisible();
}

export async function completeMockPayment(page, outcome = "success") {
  if (outcome !== "success") {
    const outcomeLabel = outcome === "failed" ? "Failure" : "Cancel";
    await page.getByRole("button", { name: outcomeLabel, exact: true }).click();
  }

  const payButton = page.getByRole("button", { name: /^Pay / });
  await expect(payButton).toBeEnabled();
  await payButton.click();
}
