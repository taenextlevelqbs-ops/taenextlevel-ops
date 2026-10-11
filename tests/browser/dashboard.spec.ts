import { test, expect } from "@playwright/test";
let runtimeErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("hydrated"))
      runtimeErrors.push(message.text());
  });
});
test.afterEach(() => expect(runtimeErrors).toEqual([]));
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password-only");
  await page.getByRole("button", { name: "Enter your workspace" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Everything. In perspective." }),
  ).toBeVisible();
}
test("every dashboard and data endpoint requires authentication", async ({
  page,
  request,
}) => {
  for (const path of ["/", "/sites", "/sites/bellewood", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  expect((await request.get("/api/sites")).status()).toBe(401);
  expect((await request.post("/api/sites", { data: {} })).status()).toBe(401);
  expect((await request.get("/api/cron")).status()).toBe(401);
});
test("login rejects wrong passwords and cross-origin requests without exposing credentials", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page.getByLabel("Password", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Enter your workspace" }).click();
  await expect(page.locator(".form-error")).toContainText(
    "Email or password is incorrect",
  );
  const r = await request.post("/api/auth/login", {
    headers: { Origin: "https://evil.example" },
    data: {
      email: "takwancrews@gmail.com",
      password: "browser-test-password-only",
    },
  });
  expect(r.status()).toBe(403);
});
test("overview shows all eight real repository identities and no invented metrics", async ({
  page,
  context,
}) => {
  await login(page);
  const cookies = await context.cookies();
  const cookie = cookies.find((c) => c.name === "command_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Strict");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await expect(
    page.getByText("Royal Brand Embroidery", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bellewood Pharmacy", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("—");
  await expect(
    page.getByText("No estimated or sample data is shown.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search websites" }).fill("nova");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Open Nova Sports Live dashboard" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nova Sports Live", exact: true }),
  ).toBeVisible();
});
test("site detail periods, privacy and unavailable business connections work", async ({
  page,
}) => {
  await login(page);
  await page.goto("/sites/bellewood?period=week");
  await expect(
    page.getByRole("heading", { name: "Bellewood Pharmacy", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Aggregate counts only. Sensitive customer data stays in its source.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Year", exact: true }).click();
  await expect(page).toHaveURL(/period=year/);
  await expect(
    page.getByRole("heading", { name: "Top pages", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Connect a read-only aggregate view in the existing database",
    ),
  ).toHaveCount(2);
});
test("settings explain credentials and failed registry writes are not reported as persisted", async ({
  page,
}) => {
  await login(page);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Your tools. One perspective." }),
  ).toBeVisible();
  await page
    .getByLabel("Website name", { exact: true })
    .fill("New real website");
  await page.getByLabel("Unique site ID").fill("new-real-website");
  await page.getByLabel("Public HTTPS URL").fill("https://example.com");
  await page.getByRole("button", { name: "Add website", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Provider request failed (HTTP 503)",
  );
});
test("mobile, tablet and desktop layouts avoid page overflow and preserve navigation", async ({
  page,
}) => {
  await login(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const path of ["/", "/sites/nova", "/settings"]) {
      await page.goto(path);
      const size = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(size.content, `${path} at ${width}`).toBeLessThanOrEqual(
        size.viewport + 1,
      );
      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sign out" }),
      ).toBeVisible();
    }
  }
  await page.goto("/");
  await page.getByRole("textbox", { name: "Search websites" }).fill("Nova");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search websites" }).fill("");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.screenshot({
    path: "/tmp/command-center-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/command-center-mobile.png",
    fullPage: true,
  });
});
test("sign-out clears the session and direct access stays protected", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/sites/coach-tae");
  await expect(page).toHaveURL(/\/login$/);
});
