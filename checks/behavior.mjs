// Every retained feature's main path, through the packaged release.
import { generateKeyPairSync, createVerify } from "node:crypto";
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { addLocation, createProgram, join, passCode, pickLocation, lookup, isoDate, localDateTime, walletsOff } from "./lib.mjs";

// A throwaway key for the optional Google Wallet feature; Apple stays off.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const serviceAccount = JSON.stringify({
  client_email: "passes@example-project.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
});
const runtime = await startRuntime({
  bindings: {
    ...walletsOff,
    GOOGLE_WALLET_SERVICE_ACCOUNT: { type: "text", value: serviceAccount },
    GOOGLE_WALLET_ISSUER_ID: { type: "text", value: "3388000000012345678" },
  },
});
try {
  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();
  const visitor = await (await runtime.context(null)).newPage();

  // F005 locations: add, rename, archive.
  await addLocation(owner, "Harbour Street");
  await addLocation(owner, "Mill Lane");
  await addLocation(owner, "Station Kiosk");
  const mill = owner.getByTestId("location-row").filter({ hasText: "Mill Lane" });
  await mill.getByTestId("location-rename").click();
  await owner.getByTestId("location-rename-input").fill("Mill Lane Market");
  await owner.getByTestId("location-rename-save").click();
  await expect(owner.getByTestId("location-row").filter({ hasText: "Mill Lane Market" })).toBeVisible();
  await owner.getByTestId("location-row").filter({ hasText: "Station Kiosk" }).getByTestId("location-archive").click();
  await owner.getByTestId("confirm-archive").click();
  await expect(owner.getByTestId("location-row").filter({ hasText: "Station Kiosk" })).toContainText("Archived");

  // F001 programs of each type.
  const coffee = await createProgram(owner, { type: "stamp", name: "Coffee Card", reward: "A free drink of your choice", stampGoal: 5, bg: "#1f3a5f", fg: "#ffffff" });
  await runtime.assertBackLink(owner);
  await expect(owner.getByTestId("program-status")).toHaveText("Active");
  await expect(owner.getByTestId("program-summary")).toContainText("5 stamps");
  expect(new URL(coffee.link).hostname).toBe(runtime.hostname);
  await expect(owner.getByTestId("install-qr").locator("svg")).toBeVisible();
  const bakery = await createProgram(owner, { type: "points", name: "Bakery Points", reward: "Treats for regulars", pointsPerVisit: 10, pointsPerAmount: 1, rewardName: "Butter croissant", rewardCost: 30 });
  const classes = await createProgram(owner, { type: "multivisit", name: "Two Class Pass", reward: "Two yoga classes", visitLimit: 2 });
  const club = await createProgram(owner, { type: "membership", name: "Monthly Club", reward: "Members get 10% off", validDays: 30 });
  const coupon = await createProgram(owner, { type: "coupon", name: "Opening Week Treat", reward: "One free pastry", expires: isoDate(14) });

  // Edit a program.
  await owner.goto(`/programs/${bakery.id}`);
  await owner.getByTestId("program-edit").click();
  await owner.getByTestId("program-reward").fill("Treats for our regulars");
  await Promise.all([owner.waitForURL(`**/programs/${bakery.id}`), owner.getByTestId("program-save").click()]);
  await expect(owner.getByTestId("program-reward-text")).toHaveText("Treats for our regulars");

  // Members can view programs.
  await member.goto("/programs");
  await expect(member.getByTestId("program-row").filter({ hasText: "Coffee Card" })).toBeVisible();
  await expect(member.getByTestId("program-row")).toHaveCount(5);

  // F002 join page, pass page, no duplicates.
  await visitor.goto(`/j/${coffee.slug}`);
  await expect(visitor.getByTestId("join-program")).toHaveText("Coffee Card");
  await visitor.getByTestId("join-name").fill("Maya Chen");
  await visitor.getByTestId("join-email").fill("maya.chen@example.com");
  await Promise.all([visitor.waitForURL(/\/p\/[A-Za-z0-9_-]{40,}$/), visitor.getByTestId("join-submit").click()]);
  const mayaCoffee = new URL(visitor.url()).pathname;
  await expect(visitor.getByTestId("pass-program")).toHaveText("Coffee Card");
  await expect(visitor.getByTestId("pass-customer")).toHaveText("Maya Chen");
  await expect(visitor.getByTestId("pass-balance")).toHaveText("0 / 5 stamps");
  await expect(visitor.getByTestId("pass-qr").locator("svg")).toBeVisible();
  expect(await join(runtime, coffee.slug, { name: "Maya C", email: "Maya.Chen@example.com" })).toBe(mayaCoffee);
  const mayaPoints = await join(runtime, bakery.slug, { name: "Maya Chen", email: "maya.chen@example.com", phone: "+44 7700 900123" });
  expect(await join(runtime, bakery.slug, { name: "Maya", phone: "+447700900123" })).toBe(mayaPoints);
  const tomClasses = await join(runtime, classes.slug, { name: "Tom Okafor", email: "tom@example.com" });
  const tomClub = await join(runtime, club.slug, { name: "Tom Okafor", email: "tom@example.com" });
  const priyaCoupon = await join(runtime, coupon.slug, { name: "Priya Shah", email: "priya@example.com" });
  await visitor.goto(tomClub);
  await expect(visitor.getByTestId("pass-balance")).toContainText("Valid until");
  await visitor.goto(tomClasses);
  await expect(visitor.getByTestId("pass-balance")).toHaveText("2 uses left");

  // F004 offers: active for all programs, scheduled, ended early.
  await owner.goto("/offers");
  await owner.getByTestId("offer-new").click();
  await owner.getByTestId("offer-title").fill("Double stamps on Fridays");
  await owner.getByTestId("offer-body").fill("Every Friday this month, each visit counts twice.");
  await owner.getByTestId("offer-save").click();
  await expect(owner.getByTestId("offer-row").filter({ hasText: "Double stamps on Fridays" }).getByTestId("offer-status")).toHaveText("Active");
  await owner.getByTestId("offer-new").click();
  await owner.getByTestId("offer-title").fill("Summer menu preview");
  await owner.getByTestId("offer-body").fill("Try the new iced drinks first.");
  await owner.getByTestId("offer-starts").fill(localDateTime(48));
  await owner.getByTestId("offer-save").click();
  await expect(owner.getByTestId("offer-row").filter({ hasText: "Summer menu preview" }).getByTestId("offer-status")).toHaveText("Scheduled");
  await owner.getByTestId("offer-new").click();
  await owner.getByTestId("offer-title").fill("Rainy day discount");
  await owner.getByTestId("offer-body").fill("Show this pass for a warm welcome.");
  await owner.getByTestId("offer-save").click();
  const rainy = owner.getByTestId("offer-row").filter({ hasText: "Rainy day discount" });
  await rainy.getByTestId("offer-end").click();
  await owner.getByTestId("confirm-end").click();
  await expect(rainy.getByTestId("offer-status")).toHaveText("Ended");
  await visitor.goto(mayaCoffee);
  await expect(visitor.getByTestId("pass-offer")).toHaveCount(1);
  await expect(visitor.getByTestId("pass-offer")).toContainText("Double stamps on Fridays");
  await member.goto("/offers");
  await expect(member.getByTestId("offer-row")).toHaveCount(3);

  // F003 scanning as a member.
  const coffeeCode = await passCode(visitor, mayaCoffee);
  await member.goto("/scan");
  await pickLocation(member, "Harbour Street");
  await lookup(member, coffeeCode.toLowerCase());
  await expect(member.getByTestId("scan-customer")).toHaveText("Maya Chen");
  await member.getByTestId("stamp-count").fill("3");
  await member.getByTestId("action-stamp").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("3 / 5 stamps");
  await member.getByTestId("action-redeem").click();
  await expect(member.getByTestId("scan-error")).toContainText("No reward");
  await member.getByTestId("stamp-count").fill("2");
  await member.getByTestId("action-stamp").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("5 / 5 stamps");
  await expect(member.getByTestId("scan-rewards")).toContainText("1 reward ready");
  await member.getByTestId("action-redeem").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("0 / 5 stamps");
  await member.getByTestId("action-undo").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("5 / 5 stamps");
  await member.getByTestId("action-redeem").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("0 / 5 stamps");
  await visitor.goto(mayaCoffee);
  await expect(visitor.getByTestId("pass-balance")).toHaveText("0 / 5 stamps");

  // Points: by visit and by amount, redeem, refused when short.
  await lookup(member, await passCode(visitor, mayaPoints));
  await member.getByTestId("action-points-visit").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("10 points");
  await member.getByTestId("points-amount").fill("25");
  await member.getByTestId("action-points-amount").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("35 points");
  await member.getByTestId("redeem-reward-0").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("5 points");
  await member.getByTestId("redeem-reward-0").click();
  await expect(member.getByTestId("scan-error")).toContainText("Not enough points");
  await expect(member.getByTestId("scan-balance")).toHaveText("5 points");

  // Multi-visit: refused once used up. Membership check-in. Coupon: once.
  await lookup(member, await passCode(visitor, tomClasses));
  await member.getByTestId("action-checkin").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("1 use left");
  await member.getByTestId("action-checkin").click();
  await expect(member.getByTestId("scan-state")).toHaveText("Used up");
  await lookup(member, await passCode(visitor, tomClub));
  await member.getByTestId("action-checkin").click();
  await expect(member.getByTestId("scan-message")).toContainText("Checked in");
  await lookup(member, await passCode(visitor, priyaCoupon));
  await expect(member.getByTestId("scan-balance")).toHaveText("Ready to use");
  await member.getByTestId("action-redeem").click();
  await expect(member.getByTestId("scan-state")).toHaveText("Used");
  await member.getByTestId("scan-code").fill("ZZZZ9999");
  await member.getByTestId("scan-lookup").click();
  await expect(member.getByTestId("scan-error")).toContainText("No pass");

  // F006 customers: list, search, detail, revoke, export.
  await member.goto("/customers?q=maya");
  await expect(member.getByTestId("customer-row")).toHaveCount(1);
  const mayaRow = member.getByTestId("customer-row").filter({ hasText: "Maya Chen" });
  await expect(mayaRow).toContainText("Coffee Card");
  await expect(mayaRow.getByTestId("customer-visits")).toHaveText("6");
  await member.goto("/customers?sort=name&dir=asc");
  await expect(member.getByTestId("customer-row").first()).toContainText("Maya Chen");
  await mayaRow.getByRole("link", { name: "Maya Chen" }).click();
  await expect(member.getByTestId("customer-name")).toHaveText("Maya Chen");
  await expect(member.getByTestId("customer-pass")).toHaveCount(2);
  await expect(member.getByTestId("history-row").filter({ hasText: "Undone" })).toHaveCount(1);
  await expect(member.getByTestId("history-row").first()).toContainText("Harbour Street");
  await owner.goto("/customers?q=priya");
  await owner.getByTestId("customer-row").getByRole("link", { name: "Priya Shah" }).click();
  await owner.getByTestId("pass-revoke").click();
  await owner.getByTestId("confirm-revoke").click();
  await expect(owner.getByTestId("customer-pass")).toContainText("Cancelled");
  await visitor.goto(priyaCoupon);
  await expect(visitor.getByTestId("pass-state")).toHaveText("Cancelled");
  for (const [kind, needle] of [["customers", "Maya Chen"], ["passes", "Coffee Card"], ["visits", "Harbour Street"]]) {
    const res = await runtime.fetch(`/api/export/${kind}.csv`, { role: "owner" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toContain(needle);
  }
  await owner.goto("/customers");
  await expect(owner.getByTestId("export-customers")).toBeVisible();

  // F007 analytics with range, program and location filters.
  await owner.goto("/?range=30");
  await expect(owner.getByTestId("stat-passes")).toHaveText("5");
  await expect(owner.getByTestId("stat-visits")).toHaveText("10");
  await expect(owner.getByTestId("stat-earned")).toHaveText("3");
  await expect(owner.getByTestId("stat-redeemed")).toHaveText("3");
  await expect(owner.getByTestId("stat-repeat")).toHaveText("67%");
  await owner.goto(`/?range=7&program=${bakery.id}`);
  await expect(owner.getByTestId("stat-visits")).toHaveText("3");
  await owner.goto("/locations");
  const millId = await owner.getByTestId("location-row").filter({ hasText: "Mill Lane Market" }).getAttribute("data-id");
  await owner.goto(`/?range=90&location=${millId}`);
  await expect(owner.getByTestId("stat-visits")).toHaveText("0");

  // F001 archive: no new joins, existing passes stay viewable.
  await owner.goto(`/programs/${classes.id}`);
  await owner.getByTestId("program-archive").click();
  await owner.getByTestId("confirm-archive").click();
  await expect(owner.getByTestId("program-status")).toHaveText("Archived");
  expect((await runtime.fetch(`/j/${classes.slug}`)).status).toBe(404);
  await visitor.goto(tomClasses);
  await expect(visitor.getByTestId("pass-program")).toHaveText("Two Class Pass");

  // F008 wallets: Google configured, Apple not.
  await visitor.goto(mayaCoffee);
  await expect(visitor.getByTestId("wallet-google")).toBeVisible();
  await expect(visitor.getByTestId("wallet-apple")).toHaveCount(0);
  const token = mayaCoffee.split("/").pop();
  expect((await runtime.fetch(`/wallet/apple/${token}`)).status).toBe(404);
  const google = await runtime.fetch(`/wallet/google/${token}`);
  expect(google.status).toBe(302);
  const target = new URL(google.headers.get("location"));
  expect(target.origin + target.pathname.split("/").slice(0, -1).join("/")).toBe("https://pay.google.com/gp/v/save");
  const jwt = target.pathname.split("/").pop();
  const [h, p, s] = jwt.split(".");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${h}.${p}`);
  expect(verifier.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  expect(claims.typ).toBe("savetowallet");
  const body = JSON.stringify(claims.payload);
  expect(body).toContain("Coffee Card");
  expect(body).toContain(coffeeCode);
  expect(body).toContain("3388000000012345678");

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/scan");
  await expect(phone.getByTestId("scan-code")).toBeVisible();
  await expect(phone.getByTestId("scan-lookup")).toBeVisible();

  // The primary workflow's result: a stamp recorded at the counter.
  const sam = await join(runtime, coffee.slug, { name: "Sam Rivera", email: "sam.rivera@example.com" });
  const samCode = await passCode(visitor, sam);
  await member.goto("/scan");
  await pickLocation(member, "Mill Lane Market");
  await lookup(member, samCode);
  await member.getByTestId("stamp-count").fill("4");
  await member.getByTestId("action-stamp").click();
  await expect(member.getByTestId("scan-balance")).toHaveText("4 / 5 stamps");
  await runtime.assertBackLink(member);
  await runtime.screenshot(member);
} finally {
  await runtime.close();
}
console.log("behavior: ok");
