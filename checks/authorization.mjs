// Who may do what: private paths, public pages, ownership, admin-only actions.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addLocation, createProgram, join, passCode, pickLocation, lookup, walletsOff } from "./lib.mjs";

const runtime = await startRuntime({ bindings: walletsOff });
try {
  await runtime.assertPrivateAccess(["/", "/programs", "/scan", "/customers", "/offers", "/locations"]);

  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();
  const visitor = await (await runtime.context(null)).newPage();

  await addLocation(owner, "Front Desk");
  const open = await createProgram(owner, { type: "stamp", name: "Lunch Card", reward: "Free lunch", stampGoal: 8 });
  const closed = await createProgram(owner, { type: "coupon", name: "Spring Voucher", reward: "Free dessert" });
  await owner.getByTestId("program-archive").click();
  await owner.getByTestId("confirm-archive").click();
  await expect(owner.getByTestId("program-status")).toHaveText("Archived");

  const ana = await join(runtime, open.slug, { name: "Ana Lopez", email: "ana@example.com" });
  await join(runtime, open.slug, { name: "Ben Hughes", email: "ben@example.com" });

  // Public routes show one pass and nothing else.
  const page = await runtime.fetch(ana);
  expect(page.status).toBe(200);
  const html = await page.text();
  expect(html).toContain("Ana Lopez");
  expect(html).not.toContain("Ben Hughes");
  expect(html).not.toContain("ben@example.com");
  expect(html).not.toContain("ana@example.com");
  expect((await runtime.fetch("/p/" + "x".repeat(43))).status).toBe(404);
  expect((await runtime.fetch(`/j/${open.slug}`)).status).toBe(200);
  expect((await runtime.fetch("/j/nosuchprogram")).status).toBe(404);
  expect((await runtime.fetch(`/j/${closed.slug}`)).status).toBe(404);
  const refused = await runtime.fetch(`/join/${closed.slug}`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "Late Comer" }).toString(),
  });
  expect(refused.status).toBe(404);
  expect((await runtime.fetch("/img/programs/does-not-exist")).status).toBe(404);
  const token = ana.split("/").pop();
  expect((await runtime.fetch(`/wallet/apple/${token}`)).status).toBe(404);
  expect((await runtime.fetch(`/wallet/google/${token}`)).status).toBe(404);
  await visitor.goto(ana);
  await expect(visitor.getByTestId("wallet-google")).toHaveCount(0);
  await expect(visitor.getByTestId("wallet-apple")).toHaveCount(0);

  // Exports: admins only; never anonymous or another organization.
  for (const kind of ["customers", "passes", "visits"]) {
    const path = `/api/export/${kind}.csv`;
    expect((await runtime.fetch(path, { role: "owner" })).status).toBe(200);
    expect((await runtime.fetch(path, { role: "member" })).status).toBe(403);
    expect([401, 403]).toContain((await runtime.fetch(path)).status);
    expect([401, 403]).toContain((await runtime.fetch(path, { role: "outsider" })).status);
  }

  // Admin-only screens refuse members.
  await member.goto("/programs/new");
  await expect(member.getByTestId("admin-only")).toBeVisible();
  await expect(member.getByTestId("program-save")).toHaveCount(0);
  await member.goto(`/programs/${open.id}`);
  await expect(member.getByTestId("program-edit")).toHaveCount(0);
  await expect(member.getByTestId("program-archive")).toHaveCount(0);
  await member.goto("/locations");
  await expect(member.getByTestId("location-row")).toHaveCount(1);
  await expect(member.getByTestId("location-add")).toHaveCount(0);
  await expect(member.getByTestId("location-archive")).toHaveCount(0);
  await member.goto("/offers");
  await expect(member.getByTestId("offer-new")).toHaveCount(0);
  await member.goto("/customers");
  await expect(member.getByTestId("export-customers")).toHaveCount(0);

  // Undo: a member undoes only their own action within 10 minutes; admins any.
  const code = await passCode(visitor, ana);
  for (const page of [owner, member]) {
    await page.goto("/scan");
    await pickLocation(page, "Front Desk");
    await lookup(page, code);
    await page.getByTestId("action-stamp").click();
    await expect(page.getByTestId("scan-message")).toBeVisible();
  }
  const db = await runtime.database();
  const { results } = await db.prepare("SELECT id, staff_user_id FROM visits ORDER BY created_at").all();
  expect(results.length).toBe(2);
  const [ownerVisit, memberVisit] = results;
  const undo = (id, role) => runtime.fetch(`/api/visits/${id}/undo`, { role, method: "POST" });
  expect((await undo(ownerVisit.id)).status).not.toBe(200);
  expect((await undo(ownerVisit.id, "outsider")).status).not.toBe(200);
  expect((await undo(ownerVisit.id, "member")).status).toBe(403);
  await db.prepare("UPDATE visits SET created_at = ? WHERE id = ?").bind(new Date(Date.now() - 11 * 60000).toISOString(), memberVisit.id).run();
  expect((await undo(memberVisit.id, "member")).status).toBe(403);
  const stamps = async () => (await db.prepare("SELECT stamps FROM passes WHERE token = ?").bind(token).first()).stamps;
  expect(await stamps()).toBe(2);
  expect((await undo(memberVisit.id, "owner")).status).toBe(200);
  expect((await undo(ownerVisit.id, "owner")).status).toBe(200);
  expect((await undo(ownerVisit.id, "owner")).status).toBe(409);
  expect(await stamps()).toBe(0);
  await member.getByTestId("action-stamp").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("1 / 8 stamps");
  await member.getByTestId("action-undo").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("0 / 8 stamps");

  // Revoking a pass is admin-only, and a revoked pass takes no visits.
  await member.goto("/customers?q=ana");
  await member.getByTestId("customer-row").getByRole("link", { name: "Ana Lopez" }).click();
  await expect(member.getByTestId("customer-pass")).toBeVisible();
  await expect(member.getByTestId("pass-revoke")).toHaveCount(0);
  await owner.goto("/customers?q=ana");
  await owner.getByTestId("customer-row").getByRole("link", { name: "Ana Lopez" }).click();
  await owner.getByTestId("pass-revoke").click();
  await owner.getByTestId("confirm-revoke").click();
  await expect(owner.getByTestId("customer-pass")).toContainText("Cancelled");
  await member.goto("/scan");
  await lookup(member, code);
  await expect(member.getByTestId("scan-state")).toHaveText("Cancelled");
  await expect(member.getByTestId("action-stamp")).toHaveCount(0);

  // No sign-in of its own (X001).
  for (const path of ["/login", "/signin", "/signup", "/register", "/logout"]) {
    const res = await runtime.fetch(path, { role: "owner" });
    expect(res.status).toBe(404);
    expect(await res.text()).not.toMatch(/type="password"/);
  }
  const join404 = await runtime.fetch(`/j/${open.slug}`);
  expect(await join404.text()).not.toMatch(/type="password"/);
} finally {
  await runtime.close();
}
console.log("authorization: ok");
