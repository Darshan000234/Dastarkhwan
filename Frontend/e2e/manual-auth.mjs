
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const role = process.argv[2]?.toLowerCase();

const roles = {
  customer: {
    label: "Customer",
    expectedPath: "/customer",
  },
  manager: {
    label: "Outlet Manager",
    expectedPath: "/manager",
  },
  admin: {
    label: "Central Admin",
    expectedPath: "/admin",
  },
};

if (!roles[role]) {
  console.error(
    "Usage: node e2e/manual-auth.mjs customer|manager|admin"
  );
  process.exit(1);
}

const currentDirectory = path.dirname(
  fileURLToPath(import.meta.url)
);

const authDirectory = path.join(currentDirectory, ".auth");

const statePath = path.join(
  authDirectory,
  `${role}.json`
);

const baseURL =
  process.env.BASE_URL || "http://localhost:5173";

const browser = await chromium.launch({
  headless: false,
});

const context = await browser.newContext();
const page = await context.newPage();

const terminal = readline.createInterface({
  input: stdin,
  output: stdout,
});

try {
  await mkdir(authDirectory, { recursive: true });

  console.log(`\nPreparing ${roles[role].label} session...`);

  await page.goto(baseURL, {
    waitUntil: "domcontentloaded",
  });

  console.log("\nComplete the following steps in the browser:");
  console.log("1. Open the login page.");
  console.log("2. Enter the appropriate demo mobile number.");
  console.log("3. Request the development OTP.");
  console.log("4. Read the OTP returned by your application.");
  console.log("5. Enter the OTP yourself.");
  console.log("6. Verify that the correct dashboard is open.");
  console.log(`7. Expected dashboard path: ${roles[role].expectedPath}`);

  const answer = await terminal.question(
    "\nAfter successful login, type SAVE and press Enter: "
  );

  if (answer.trim().toUpperCase() !== "SAVE") {
    console.log("Session was not saved.");
    process.exitCode = 1;
  } else {
    const currentUrl = page.url();
    const cookies = await context.cookies();

    const localCookies = cookies.filter(
      (cookie) =>
        cookie.domain === "localhost" ||
        cookie.domain.endsWith(".localhost")
    );

    console.log("\nCurrent browser URL:", currentUrl);

    if (!currentUrl.includes(roles[role].expectedPath)) {
      console.warn(
        "WARNING: The current URL does not match the expected dashboard path."
      );
      console.warn(
        "Verify the correct account is logged in before using this state."
      );
    }

    if (localCookies.length === 0) {
      console.warn(
        "WARNING: No localhost cookies found. Check whether login created the expected authentication cookie."
      );
    } else {
      console.log(
        "Local cookie names:",
        localCookies
          .map((cookie) => `${cookie.name} (HttpOnly: ${cookie.httpOnly})`)
          .join(", ")
      );
    }

    await context.storageState({
      path: statePath,
    });

    console.log("\nAuthentication state saved:");
    console.log(statePath);
  }
} catch (error) {
  console.error("\nUnable to save authentication state:", error);
  process.exitCode = 1;
} finally {
  terminal.close();
  await browser.close();
}
