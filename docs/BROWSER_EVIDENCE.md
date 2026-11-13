# Browser workflow verification

The automated checks are real browser workflows against the running full-stack application. They use the sign-in form, football browser, producer editor, preview, on-air controls and an independent 1920×1080 output browser context. Test values such as edited titles/zero figures are saved editorial changes in verification episodes; provider records come from ESPN.

## Production-mode local server

Target: `http://localhost:3001`, configured with the real cloud PostgreSQL database. Final results on 12 November 2026:

- `node scripts/browser-verify.mjs`: **12 checks passed**, no browser runtime errors. Sign-in took 511ms in the successful run. The English Premier League workflow opened Arsenal → squad → Bukayo Saka (`280555`), and the LALIGA workflow opened Real Madrid → squad → Vinícius Júnior (`252107`), using provider data without manually creating those entities. A second-season comparison selected 2024 independently from the current 2026 scope. Selecting/browsing elsewhere left the broadcast snapshot unchanged. Edited titles, an explicit zero, snapshots and overrides survived episode reload. Episode duplication, a real UI Export download, import of that downloaded JSON and an unauthenticated producer-mutation rejection passed. Prepared output-switch samples: **80.1ms and 36.7ms** in that run.
- `node scripts/browser-match.mjs`: **11 checks passed**, no browser runtime errors. The actual selected fixture exposed both starting lineups and benches. The scoreboard took live in an independent output context. A prepared next graphic left output unchanged until Take Live. Freeze persisted, a simulated ESPN HTTP 503 appeared only to the producer, and the already-prepared scoreboard still took live while ESPN requests failed. Reload and offline→online reconnection restored the persisted snapshot. Revoking the output token cleared the old output session. Recorded output-switch samples: **106.3ms initial**, **28ms warm**, **6.4ms on the freeze-associated frame**, and **15.1ms for the prepared take during provider failure**. These are browser state-receipt-to-render timings, not provider fetch timings or an end-to-end network latency promise.

The first main-suite retry waited on a sign-in request beyond its original 30-second generic team-list timeout. A direct sign-in then completed in 512ms; the successful browser retry completed sign-in in 511ms. The test now waits on the actual sign-in response and records its timing, so a sign-in failure is identified at the correct stage. A later match assertion was corrected to compare the actual current prepared title without CSS uppercase sensitivity. Neither failed assertion is represented as a successful application workflow in the final result files.

Result files: `docs/browser-results.json`, `docs/browser-match-results.json`. Screenshots: `docs/output-profile.png`, `docs/output-comparison.png`, `docs/workspace-populated.png`, `docs/match-lineups.png`, `docs/output-scoreboard.png`, `docs/output-frozen-failure.png`. Historical failure screenshots remain separately labelled and are not the final result.

## Re-running against a deployed target

Both scripts accept:

- `TGIQ_TEST_URL`: target application origin; defaults to `http://localhost:3001`.
- `TGIQ_TEST_ACCESS`: private JSON file containing `producerPassword`; defaults to `.data/local-access.json`.
- `TGIQ_EVIDENCE_PREFIX`: artifact filename prefix such as `live-`; defaults to empty. This preserves local and deployed evidence separately.

Run them **sequentially**, because each rotates read-only output access. A successful deployment is verified separately; local test results do not establish a deployed service is live.

## Public deployment verification

The suites were then run sequentially against **https://tgiq-football-database.vercel.app**, using the private production-access file and `TGIQ_EVIDENCE_PREFIX=live-`. The deployed source at this verification stage was commit `3b09a06`; later deployment changes require their own follow-up check.

- `live-browser-results.json`: **12/12 passed**, no browser errors. Live sign-in: **5,152ms**. Output state-receipt-to-render samples: **116.8ms initial** and **42.2ms prepared switch**.
- `live-browser-match-results.json`: **11/11 passed**, no browser errors. This includes taking the already-prepared graphic live during the simulated ESPN 503, frozen state, independent-session output, reload/reconnect and token revocation. Output samples: **111ms initial**, **13.6ms warm**, **5.6ms prepared take while ESPN failed**.
- `live-uncached-results.json`: **18/18 passed**, no browser errors. This extra workflow inspected the real remote PostgreSQL `provider_cache` with `SELECT` only, without deleting anything. Both roster caches were empty before the team was selected. Each dynamically selected player's profile and overview caches were empty before the player was opened. The browser then received HTTP 200 and populated a reusable profile; the successful ESPN response documents appeared in the cache afterwards.

| Competition / season | First-use team | Dynamically selected player | Squad / metric count | Actual ESPN profile retrieval |
|---|---|---|---|---|
| `eng.1` / 2026 | Fulham `370` | Benjamin Lecomte `149517` | 29 / 15 | `2026-11-12T23:59:31.368Z` |
| `esp.1` / 2026 | Valencia `94` | Cristian Rivero `76884` | 34 / 15 | `2026-11-12T23:59:33.516Z` |

Both players were chosen from the first returned squad button by provider ID. Neither team nor player was manually created. The first-use workflow made no episode, asset or program mutations. ESPN did not supply either portrait; the neutral identity treatment was used. Production provider status confirmed `keyRequired: false` for ESPN and both optional paid providers unconfigured. Full source URLs, team-at-the-time/season scope, retrieval times, before/after cache rows and statuses are retained in the JSON evidence, with screenshots `live-uncached-370.png` and `live-uncached-94.png`.

The first-use test intentionally fails if the selected records are already cached on a later run. It must not clear caches to manufacture first-use evidence. Use genuinely unvisited covered subjects or let the documented cache retention expire naturally when repeating that particular check. The main and match suites remain repeatable independently.
