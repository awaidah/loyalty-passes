// Written data survives a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addLocation, createProgram, join, passCode, pickLocation, lookup, walletsOff } from "./lib.mjs";

const runtime = await startRuntime({ bindings: walletsOff });
try {
  let owner = await (await runtime.context("owner")).newPage();
  await addLocation(owner, "Riverside");
  const program = await createProgram(owner, { type: "points", name: "Book Nook Points", reward: "Books for readers", pointsPerVisit: 5, rewardName: "Free paperback", rewardCost: 50 });
  const pass = await join(runtime, program.slug, { name: "Lena Novak", email: "lena@example.com" });
  const visitor = await (await runtime.context(null)).newPage();
  const code = await passCode(visitor, pass);
  await owner.goto("/scan");
  await pickLocation(owner, "Riverside");
  await lookup(owner, code);
  await owner.getByTestId("action-points-visit").click();
  await expect(owner.getByTestId("scan-balance")).toHaveText("5 points");
  await owner.goto("/offers");
  await owner.getByTestId("offer-new").click();
  await owner.getByTestId("offer-title").fill("Author signing Saturday");
  await owner.getByTestId("offer-body").fill("Meet the author from 2pm.");
  await owner.getByTestId("offer-save").click();
  await expect(owner.getByTestId("offer-row")).toHaveCount(1);

  await runtime.restart();

  owner = await (await runtime.context("owner")).newPage();
  await owner.goto("/locations");
  await expect(owner.getByTestId("location-row").filter({ hasText: "Riverside" })).toBeVisible();
  await owner.goto(`/programs/${program.id}`);
  await expect(owner.getByRole("heading", { level: 1 })).toHaveText("Book Nook Points");
  await owner.goto("/customers");
  await expect(owner.getByTestId("customer-row").filter({ hasText: "Lena Novak" })).toBeVisible();
  const page = await (await runtime.context(null)).newPage();
  await page.goto(pass);
  await expect(page.getByTestId("pass-balance")).toHaveText("5 points");
  await expect(page.getByTestId("pass-offer")).toContainText("Author signing Saturday");
  expect(await join(runtime, program.slug, { name: "Lena", email: "lena@example.com" })).toBe(pass);
} finally {
  await runtime.close();
}
console.log("persistence: ok");
