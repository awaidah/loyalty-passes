// Helpers the suites share. Selectors are the app's test IDs.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export async function addLocation(page, name) {
  await page.goto("/locations");
  await page.getByTestId("location-name").fill(name);
  await page.getByTestId("location-add").click();
  await expect(page.getByTestId("location-row").filter({ hasText: name })).toBeVisible();
}

/** Creates a program as an admin and returns { id, slug } from its page. */
export async function createProgram(page, p) {
  await page.goto("/programs/new");
  await page.getByTestId(`type-${p.type}`).click();
  await page.getByTestId("program-name").fill(p.name);
  await page.getByTestId("program-reward").fill(p.reward);
  if (p.stampGoal) await page.getByTestId("program-stamp-goal").fill(String(p.stampGoal));
  if (p.pointsPerVisit) await page.getByTestId("program-points-per-visit").fill(String(p.pointsPerVisit));
  if (p.pointsPerAmount) await page.getByTestId("program-points-per-amount").fill(String(p.pointsPerAmount));
  if (p.rewardName) {
    await page.getByTestId("reward-name-0").fill(p.rewardName);
    await page.getByTestId("reward-cost-0").fill(String(p.rewardCost));
  }
  if (p.visitLimit) await page.getByTestId("program-visit-limit").fill(String(p.visitLimit));
  if (p.validDays) await page.getByTestId("program-valid-days").fill(String(p.validDays));
  if (p.expires) await page.getByTestId("program-expires").fill(p.expires);
  if (p.bg) await page.getByTestId("program-bg").fill(p.bg);
  if (p.fg) await page.getByTestId("program-fg").fill(p.fg);
  await Promise.all([
    page.waitForURL(/\/programs\/[^/]+$/),
    page.getByTestId("program-save").click(),
  ]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.name);
  const link = await page.getByTestId("install-link").textContent();
  const slug = new URL(link.trim()).pathname.split("/").pop();
  const id = new URL(page.url()).pathname.split("/").pop();
  return { id, slug, link: link.trim() };
}

/** Joins a program the way a customer's form does; returns the pass path. */
export async function join(runtime, slug, fields) {
  const res = await runtime.fetch(`/join/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  expect(res.status).toBe(303);
  const location = res.headers.get("location");
  expect(location).toMatch(/^\/p\/[A-Za-z0-9_-]{40,}$/);
  return location;
}

export async function passCode(page, passPath) {
  await page.goto(passPath);
  return (await page.getByTestId("pass-code").textContent()).trim();
}

export async function pickLocation(page, name) {
  await page.getByTestId("scan-location").click();
  await page.getByRole("option", { name }).click();
  await expect(page.getByTestId("scan-location")).toContainText(name);
}

export async function lookup(page, code) {
  await page.getByTestId("scan-code").fill(code);
  await page.getByTestId("scan-lookup").click();
  await expect(page.getByTestId("scan-result")).toBeVisible();
}

export function isoDate(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);
}

export function localDateTime(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3600000).toISOString().slice(0, 16);
}

/** Empty values: the wallet features are off. */
export const walletsOff = Object.fromEntries(
  ["APPLE_PASS_CERTIFICATE", "APPLE_PASS_PRIVATE_KEY", "APPLE_WWDR_CERTIFICATE", "APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID",
   "GOOGLE_WALLET_SERVICE_ACCOUNT", "GOOGLE_WALLET_ISSUER_ID"].map((name) => [name, { type: "text", value: "" }]),
);
