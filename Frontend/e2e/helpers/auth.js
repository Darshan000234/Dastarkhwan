import { expect } from "@playwright/test";

const DEMO_ACCOUNTS = {
  customer: {
    path: "/login",
    button: "Customer",
    destination: /\/customer(?:\?.*)?$/,
  },
  manager: {
    path: "/staff-login",
    button: "Rahul · Kondapur",
    destination: /\/manager(?:\?.*)?$/,
  },
  managerGachibowli: {
    path: "/staff-login",
    button: "Amit · Gachibowli",
    destination: /\/manager(?:\?.*)?$/,
  },
  admin: {
    path: "/staff-login",
    button: "Central Admin",
    destination: /\/admin(?:\?.*)?$/,
  },
};

/**
 * Signs in through the real Dastarkhwan development OTP screen.
 * The OTP is read from the backend's development-only response banner.
 * No authentication token is written to localStorage or sessionStorage.
 */
export async function signInWithDemoAccount(page, role) {
  const account = DEMO_ACCOUNTS[role];

  if (!account) {
    throw new Error(`Unsupported seeded demo role: ${role}`);
  }

  await page.goto(account.path);
  await page.locator(".sl-demo summary").click();
  await page.getByRole("button", { name: account.button, exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Verify your number." }),
  ).toBeVisible();

  const otpBanner = page
    .getByRole("status")
    .filter({ hasText: "Development OTP returned by backend:" });

  await expect(otpBanner).toBeVisible();

  const otpText = await otpBanner.innerText();
  const otp = otpText.match(/\b\d{6}\b/)?.[0];

  expect(otp, "The development backend must return a six-digit OTP").toBeTruthy();

  const digits = page.locator('.sl-otp input[aria-label^="Digit "]');
  await expect(digits).toHaveCount(6);

  for (let index = 0; index < 6; index += 1) {
    await digits.nth(index).fill(otp[index]);
  }

  await page
    .getByRole("button", { name: "Verify and continue", exact: true })
    .click();

  await expect(page).toHaveURL(account.destination, { timeout: 25_000 });
}

export async function expectAuthenticatedSession(page, expectedRole) {
  const response = await page.context().request.get(
    "http://localhost:5000/api/v1/auth/session",
  );

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.user?.role).toBe(expectedRole);
}
