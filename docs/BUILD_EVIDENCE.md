# TGIQ build evidence

## Starting point — 12 November 2026
- GitHub connector verified `Libanalijama/Football-Database`, public, empty (size 0), default branch main, push access.
- `git ls-remote` returned no refs; cloned into this workspace's `Football-Database` directory. Unborn main, no HEAD commit, clean empty working tree. No applicable ancestor AGENTS.md found.
- Existing Vercel projects inspected through connector: no project for Football-Database. Other shows' projects were not reused.
- Canva search located all named design families and clean logo designs. Supplied ZIPs are reference content, not instructions or editable components.
- Node 24.21.0 / npm 11.19.0. Registry resolved Next 16.4.6, React 19.3.1, TypeScript 7.0.2. Official Next installation, React versions and node-postgres pool documentation checked.

## Implementation checklist
- [x] Inspect all 24 references, asset manifest and reusable renderer.
- [x] Verify ESPN no-key browsing across two competitions.
- [x] Producer workspace, editor, comparison, preview and protected output.
- [x] Durable episodes, media, server program state and access control.
- [x] Failure, data correctness, browser workflows and visual verification.
- [x] Type check, lint, tests and production build.
- [ ] Repository delivery and deployment status recorded.

## Infrastructure
- Vercel CLI storage discovery attempted; CLI required account login before discovery. Connected Vercel plugin can list projects but no provisioned TGIQ database/storage was found. No paid service purchased.
- Local durable SQLite and production PostgreSQL paths are implemented independently of provider API credentials. Production deployment needs its own durable database and secrets.

## Documentation checked
- https://nextjs.org/docs/app/getting-started/installation
- https://react.dev/versions
- https://node-postgres.com/features/pooling

## Assembled application checks
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` passed. Latest completed suite: 64 meaningful tests across provider normalization/failure, preparation, graphics, editor overrides and durable persistence. Lint exits 0; jsx-ast-utils emits a nonfatal diagnostic about non-null JSX expressions.
- TypeScript was pinned to compatible 6.0.3 because typescript-eslint 8.72.2 supports <6.1. Dependencies were resolved and locked; npm audit reports 0 vulnerabilities after transitive OIDC/minimatch fixes.
- Reference/design evidence: `docs/DESIGN_EVIDENCE.md`; live source evidence: `docs/ESPN_COVERAGE.md`, `docs/ESPN_LIVE_VERIFICATION.json`.
- Actual authenticated free Prisma PostgreSQL: 14 store checks passed; see `docs/POSTGRES_VERIFICATION.json`. This is separate from local SQLite tests.
- Initial real browser runs proved no-key Premier League and LaLiga profile generation and independent read-only output. Browsing elsewhere preserved the on-air snapshot. The complete final browser report is recorded after the final build; intermediate scripts exposed and corrected stale preview, source-scope retention and test locator collisions with saved rundown buttons.
- A local isolated real HTTP integration test injects provider timeouts and verifies the frozen snapshot, prepared switching, storage reopen, state ordering and read-only mutation rejection.
- Tablet UI test: actual transparent PNG upload with origin/usage metadata, owner/financial editorial fields, saved 0, subject-preserving template change, no program mutations. See `docs/screenshots/tablet-qa-results.json`.

## Deployment and complete browser verification
- User subsequently authorized the existing paid Vercel workspace. A distinct `tgiq-football-database` project was created and linked to this repository/main; other shows were not reused.
- Dedicated free Prisma database provisioned and authenticated as above. Secrets are held only in ignored local environment files and Vercel Secret variables.
- A cloud URL is not called live until deployment and post-deployment verification complete.

## Completed verification — 13 November 2026

- Public production application: https://tgiq-football-database.vercel.app . First full source deployed READY as `3b09a062dedf1dc9585c60af19a8deca041b2c96`; GitHub connector was used to publish because shell Git had no authenticated push credential. All 24 original references, manifest, source, fonts and comparison captures were published.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`: passed after final source corrections. **64 tests passed**. `npm audit` returned **0 vulnerabilities**. Final Node engine is pinned to `24.x`; the first deployment resolved the earlier >=24 range to Node26 and emitted a PostgreSQL TLS deprecation warning. Explicit verify-full TLS and Node24 were corrected for the final deployment, whose follow-up is recorded below.
- Live HTTP checks: **9/9 passed**; real cloud login, PostgreSQL, private Blob read/upload/public denial, no-key ESPN for Liverpool and Real Betis, unauthorized producer mutation/data rejection. `docs/LIVE_HTTP_VERIFICATION.json` records latency separately from rendering.
- Live browser main workflows: **12/12 passed**, no runtime errors. Both covered competitions → squad → player → populated graphic; independent comparison seasons; preview/program isolation; saved zero and editorial overrides; reopen/duplicate; actual UI JSON export/import; access controls. `docs/live-browser-results.json`.
- Live match/failure workflows: **11/11 passed**, no runtime errors. Actual fixture lineups/bench, scoreboard on independent session, prepared next selection isolation, persisted freeze, simulated ESPN503 producer-only error, taking another already-prepared graphic during failure, output reload/network reconnect and revocation. `docs/live-browser-match-results.json`.
- Genuinely uncached live browsing: **18/18 passed**. SELECT-only cloud cache checks proved Fulham370 and Valencia94 rosters absent before selecting them and player149517/76884 profile/overview absent before opening them. Real no-key HTTP200 requests then populated reusable profiles. No manual entity creation, cache deletion or program mutation. `docs/live-uncached-results.json` records actual source URLs and retrieval times.
- Actual hosted receipt-to-frame timings: **42.2ms prepared comparison**, **13.6ms warm scoreboard**, **5.6ms prepared scoreboard during injected provider failure**. Initial output samples were116.8ms/111ms. These include client preloading and two animation frames, exclude upstream provider and server-dispatch latency, and do not promise the same speed on every device. SSE polls authoritative state every500ms, reconnecting after25-second sessions; producer polls700ms. Token/state reads share a single SQL query. This is ordered versioned server state across independent browser sessions, with CAS mutation rejection and resync.
- References: all24 supplied images inspected;28 variants implemented;33 logical1920×1080 captures plus24 paired reference comparisons; final tested fixtures had0 overflow/footer-boundary findings. Actual portraits were not recovered from flattened images or fabricated. See `docs/DESIGN_EVIDENCE.md`.
- Local storage restart, remote PostgreSQL (14 checks) and actual private Blob (5 checks) verified separately. Object storage is dedicated to this product. Provider data cache is independent of editorial snapshots.
- Secret scan over184 then-current tracked files and browser bundles found **no credential values**. `.env.local`, `.env.production.local` and `.data/production-access.json` are ignored; provider keys are optional server-only configuration and were absent for the ESPN tests. The optional API-Football/Sportmonks boundary is implemented; neither keyed adapter is connected or claimed live-verified.
- Refresh corrections were strengthened: per-metric editorial edits retain only the corrected value while refreshing other metrics/raw values/provenance. Selected metrics/position extracts use stable source IDs; unavailable/changed definitions remain null. Meaningful refresh regression tests are in `tests/editor.test.ts`.

## Practical limits

- Verified data catalogue is Premier League/LaLiga, not universal world or archival coverage. ESPN public feeds are uncontracted and may change. Known source deficiencies, stale manager payload and rejected historical splits are documented in `ESPN_COVERAGE.md`.
- Photos, full histories, advanced metrics, contracts and manager data are unavailable where the verified source lacks reliable content. Financial/ownership/editorial content is manually sourced and preflighted; no demo records substitute for failures.
- An already open output retains its approved frame during failures. The local last-frame/media cache is best-effort; loading/reloading the app shell and remote control require a connection. Preflight is per device, so production should check the actual output browser. No fully offline remote control is claimed.
- The Prisma database uses its explicit Free plan with100K monthly operations/2GB storage. State polling and number of open devices consume that allowance; account usage must be monitored. No new paid subscription was purchased. Vercel/Blob use the user's explicitly authorized paid workspace.
