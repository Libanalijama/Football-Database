import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const BASE = process.env.TGIQ_TEST_URL || "http://localhost:3001";
const access = JSON.parse(await fs.readFile(".data/local-access.json", "utf8"));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1600, height: 1080 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const result = { checks: [], errors };
function check(name, value) {
  result.checks.push({ name, pass: Boolean(value) });
  if (!value) throw Error(name);
}
try {
  await page.goto(BASE);
  await page.getByLabel("Producer password").fill(access.producerPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: /^Arsenal English Premier League/ })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: /^Arsenal English Premier League/ })
    .click();
  await page
    .locator('.browser-column button[data-entity-kind="player"][data-entity-id="280555"]')
    .waitFor({ timeout: 30000 });
  await page.locator('.browser-column button[data-entity-kind="player"][data-entity-id="280555"]').click();
  await page
    .locator(".browser-column")
    .getByRole("heading", { name: "Bukayo Saka", exact: true })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Prepare graphic", exact: true })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Prepare graphic", exact: true })
    .click();
  check(
    "ESPN Premier League team -> squad -> player -> populated profile",
    (await page.getByLabel("Graphic title").inputValue()) === "Bukayo Saka",
  );
  await page
    .getByLabel("New episode name")
    .fill("Build verification · real ESPN");
  await page
    .getByRole("button", { name: "Create episode", exact: true })
    .click();
  await page.getByText("Episode created", { exact: true }).waitFor();
  await page.getByLabel("Graphic title").fill("Bukayo Saka · editorial");
  await page
    .getByRole("button", { name: "Add to rundown", exact: true })
    .first()
    .click();
  await page.getByText("Added to rundown", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByText("Preview ready", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Take Live", exact: true }).click();
  await page.getByText("On air", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Output link", exact: true }).click();
  await page.getByRole("link", { name: "Open broadcast output" }).waitFor();
  const href = await page
    .getByRole("link", { name: "Open broadcast output" })
    .getAttribute("href");
  const outputContext = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1920, height: 1080 },
  });
  const output = await outputContext.newPage();
  await output.goto(href);
  await output
    .locator(".g-profile-name")
    .filter({ hasText: "Bukayo Saka" })
    .waitFor({ timeout: 15000 });
  await output.screenshot({
    path: "docs/output-profile.png",
    omitBackground: true,
  });
  check(
    "Read-only output in independent browser session",
    (await output.locator("main button").count()) === 0,
  );
  await page.locator('select[aria-label="Competition"]').selectOption("esp.1");
  await page
    .getByRole("button", { name: /^Real Madrid Spanish/ })
    .waitFor({ timeout: 30000 });
  check(
    "Browsing leaves on-air snapshot unchanged",
    /BUKAYO SAKA/i.test(await output.locator("body").innerText()),
  );
  await page.getByRole("button", { name: /^Real Madrid Spanish/ }).click();
  await page
    .locator('.browser-column button[data-entity-kind="player"][data-entity-id="252107"]')
    .waitFor({ timeout: 30000 });
  await page.locator('.browser-column button[data-entity-kind="player"][data-entity-id="252107"]').click();
  await page
    .locator(".browser-column")
    .getByRole("heading", { name: "Vinícius Júnior", exact: true })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Prepare graphic", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Prepare graphic", exact: true })
    .click();
  check(
    "ESPN LaLiga unseen team -> squad -> player -> profile",
    (await page.getByLabel("Graphic title").inputValue()) === "Vinícius Júnior",
  );
  await page
    .getByRole("button", { name: "Add to rundown", exact: true })
    .first()
    .click();
  await page.getByText("Added to rundown", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.locator('select[aria-label="Season"]').selectOption("2024");
  await page
    .getByRole("button", { name: /^Real Madrid Spanish/ })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Real Madrid Spanish/ }).click();
  await page
    .locator('.browser-column button[data-entity-kind="player"][data-entity-id="252107"]')
    .waitFor({ timeout: 30000 });
  await page.locator('.browser-column button[data-entity-kind="player"][data-entity-id="252107"]').click();
  await page
    .locator(".browser-column")
    .getByRole("heading", { name: "Vinícius Júnior", exact: true })
    .waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Compare", exact: true }).waitFor();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  check(
    "Independent comparison seasons",
    (await page.getByLabel("Graphic template").inputValue()) ===
      "comparison-player" &&
      (await page.getByLabel("Graphic scope").inputValue()).includes("2024"),
  );
  await page.getByLabel("Metric value 1", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Add to rundown", exact: true })
    .first()
    .click();
  await page.getByText("Added to rundown", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Freeze Data", exact: true })
    .isVisible()
    .then(async (visible) => {
      if (visible) {
        await page
          .getByRole("button", { name: "Freeze Data", exact: true })
          .click();
        await page.getByText("Data frozen", { exact: true }).last().waitFor();
      }
    })
    .catch(() => {});
  await page
    .getByRole("button", { name: "Preflight episode", exact: true })
    .click();
  await page.getByText(/Preflight ready/).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: "Take Live", exact: true }).click();
  await page.getByText("On air", { exact: true }).waitFor();
  await output
    .getByText(/Player comparison/i, { exact: false })
    .first()
    .waitFor({ timeout: 15000 });
  await output.screenshot({
    path: "docs/output-comparison.png",
    omitBackground: true,
  });
  const timing = await output.evaluate(() =>
    performance.getEntriesByName("tgiq-output-switch").map((x) => x.duration),
  );
  result.outputSwitchMs = timing;
  await page.screenshot({
    path: "docs/workspace-populated.png",
    fullPage: true,
  });
  const episodeId = await page.getByLabel("Open episode").inputValue();
  const before = await context.request
    .get(`/api/episodes/${episodeId}`)
    .then((r) => r.json());
  await page.reload();
  await page.getByLabel("Open episode").selectOption(episodeId);
  await page.getByText("Episode opened", { exact: true }).waitFor();
  const after = await context.request
    .get(`/api/episodes/${episodeId}`)
    .then((r) => r.json());
  check(
    "Durable saved snapshots, overrides and zero survive reload",
    JSON.stringify(before.episode.items) ===
      JSON.stringify(after.episode.items),
  );
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.getByText("Episode duplicated", { exact: true }).waitFor();
  check(
    "Episode duplicate retains rundown",
    (await page.locator(".rundown-item").count()) === 3,
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs('.data/verification-export.json');
  const exported = JSON.parse(await fs.readFile('.data/verification-export.json', 'utf8'));
  check('Episode UI exports portable JSON', exported.schemaVersion === before.episode.schemaVersion && exported.items.length === before.episode.items.length);
  const importRes = await context.request.post("/api/episodes", {
    headers: { "x-tgiq-csrf": "1" },
    data: { import: exported },
  });
  const imported = await importRes.json();
  check(
    "Export/import content round trip",
    importRes.ok() &&
      imported.episode.items.length === before.episode.items.length &&
      JSON.stringify(imported.episode.items.map((x) => x.graphic)) ===
        JSON.stringify(before.episode.items.map((x) => x.graphic)),
  );
  const auth = await browser.newContext();
  check(
    "Unauthenticated producer mutation rejected",
    (
      await auth.request.post(BASE + "/api/program", {
        headers: { "x-tgiq-csrf": "1" },
        data: { action: "clear", expectedVersion: 0 },
      })
    ).status() === 401,
  );
  await auth.close();
  await outputContext.close();
  check("No browser runtime errors", errors.length === 0);
} catch (error) {
  result.failure = String(error);
  await page.screenshot({ path: "docs/browser-failure.png", fullPage: true });
  process.exitCode = 1;
}
await fs.writeFile(
  "docs/browser-results.json",
  JSON.stringify(result, null, 2),
);
console.log(result);
await browser.close();
