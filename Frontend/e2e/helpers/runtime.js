import { expect } from "@playwright/test";

/** Start collecting uncaught browser errors before the application loads. */
export async function watchRuntimeErrors(page) {
  const pageErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.addInitScript(() => {
    window.__e2eUnhandledRejections = [];

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      window.__e2eUnhandledRejections.push(
        reason instanceof Error ? reason.message : String(reason),
      );
    });
  });

  return async function assertNoRuntimeErrors() {
    const unhandledRejections = await page
      .evaluate(() => window.__e2eUnhandledRejections || [])
      .catch(() => []);

    expect(
      pageErrors,
      `Unexpected uncaught browser errors:\n${pageErrors.join("\n")}`,
    ).toEqual([]);

    expect(
      unhandledRejections,
      `Unexpected unhandled promise rejections:\n${unhandledRejections.join("\n")}`,
    ).toEqual([]);
  };
}
