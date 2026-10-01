/**
 * Step 05: Convex Auth round trip on Next 16 (docs/DECISIONS.md R1) —
 * sign in → session cookie → server render reads the token → Convex `users.viewer`
 * returns the owner → sign out. Also the proxy's UX redirect for account areas.
 * Needs SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (the owner created by `seed:createOwner`).
 */
import { expect, test, type Page } from "@playwright/test";

import { TEST_IDS } from "../../constants/testIds";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

/** Streamed pages can briefly hold a hidden server copy next to the client copy; wait it out. */
async function openSignIn(page: Page) {
  await page.goto("/prijava");
  await expect(page.getByTestId(TEST_IDS.authEmail)).toHaveCount(1, { timeout: 20_000 });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe("auth round trip", () => {
  test.skip(!email || !password, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");

  test("owner signs in, the server render sees the session, then signs out", async ({
    page,
    context,
  }) => {
    const errors = collectErrors(page);
    await openSignIn(page);
    await page.getByTestId(TEST_IDS.authEmail).fill(email!);
    await page.getByTestId(TEST_IDS.authPassword).fill(password!);
    await page.getByTestId(TEST_IDS.authSubmit).click();

    const viewer = page.getByTestId(TEST_IDS.authViewer);
    await expect(viewer).toHaveAttribute("data-role", "owner", { timeout: 30_000 });
    await expect(viewer).toContainText("vlasnik");

    const cookies = await context.cookies();
    const jwt = cookies.find(
      (c) => c.name.endsWith("__convexAuthJWT") || c.name === "__convexAuthJWT",
    );
    const refresh = cookies.find((c) => c.name.includes("convexAuthRefreshToken"));
    expect(jwt, "JWT cookie").toBeDefined();
    expect(refresh?.httpOnly, "refresh token is httpOnly").toBe(true);

    // A fresh server render (no client state) still knows the user: cookie → token → Convex.
    const html = await (await page.request.get("/prijava")).text();
    expect(html).toContain('data-role="owner"');

    // Signed in → the account-area redirect no longer applies.
    const admin = await page.request.get("/admin", { maxRedirects: 0 });
    expect(admin.headers()["location"] ?? "").not.toContain("/prijava");

    await page.getByTestId(TEST_IDS.authSignOut).click();
    await expect(page.getByTestId(TEST_IDS.authSubmit)).toHaveCount(1, { timeout: 30_000 });
    const after = await (await page.request.get("/prijava")).text();
    expect(after).not.toContain('data-role="owner"');
    expect(errors).toEqual([]);
  });

  test("a wrong password shows a Serbian error and keeps the visitor signed out", async ({
    page,
  }) => {
    await openSignIn(page);
    await page.getByTestId(TEST_IDS.authEmail).fill(email!);
    await page.getByTestId(TEST_IDS.authPassword).fill("pogresna-lozinka-123");
    await page.getByTestId(TEST_IDS.authSubmit).click();
    await expect(page.getByTestId(TEST_IDS.authError)).toContainText("Pogrešna adresa e-pošte ili lozinka");
  });
});

test("anonymous visitors are sent from account areas to sign-in with `next`", async ({ page }) => {
  const res = await page.request.get("/nalog/porudzbine?x=1", { maxRedirects: 0 });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
  expect(res.headers()["location"]).toContain("/prijava?next=%2Fnalog%2Fporudzbine%3Fx%3D1");
});
