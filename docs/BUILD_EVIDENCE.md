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
- [x] Repository delivery and deployment status recorded.

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

## Recovery and final source

- Recovery source `dce79d3870d5ec4dc37afd5e14c2c0c620733125` passed all64 tests, type checking, lint and production build. It also captures program intent/version before image preloading so a late older take cannot overwrite a newer producer action, and maps non-JSON platform failures to concise producer notices.
- The intermediate Node24 deployment was READY but its first cold health request timed out at30seconds. This was treated as a failed live check. Same-database comparison isolated the Prisma pooled endpoint returning upstream failures while seven fresh direct connections succeeded (151–255ms). No database was replaced and no saved data was moved.
- The recovery uses the working direct database URL, explicit schema migrations instead of10 setup queries on every cold request, and5/7/5/3second connection/query/statement/lock limits. Actual recovered cold public health was200JSON/readytrue at534ms, then53ms/51ms. The free database and dedicated private Blob store remain configured. `docs/POSTGRES_RECOVERY.json` and `docs/RECOVERY_DEPLOYMENT.json` contain exact checks.
- Source setup/run documentation and `.env.example` were updated for explicit PostgreSQL migration and connection priority. Local SQLite still initializes automatically. API keys remain unnecessary for the verified ESPN workflows.

## Final handover checks

- Recovery commit `dce79d3870d5ec4dc37afd5e14c2c0c620733125`: GitHub CI succeeded, Vercel READY on Node24/fra1, runtime error/fatal/warning scan0 entries in the recorded window. `FINAL_RECOVERY_CHECKS.json` records identifiers and times.
- Final deployed browser follow-up: **17/17 passed**, no runtime errors. Assists leaderboard uses actual50scoped rows; an editorial zero survives explicit uncached refresh while another row updates from source; available player match statistics expand; typing shortcuts do not take live; a broken portrait blocks the take and leaves program unchanged; corrected graphic takes in an independent output session; revocation blanks and stops unauthorized polling. `final-browser-results.json` and final screenshots. Live sign-in227ms; output initial110.1ms and prepared57.9ms.
- Test episodes were archived without deleting them. `TGIQ · Review rundown` contains three unmodified actual ESPN snapshots: two player profiles and a scoreboard. The program was deliberately cleared and data frozen for handover. `REVIEW_RUNDOWN.json` records the exact subjects/scopes.
- Production URL: https://tgiq-football-database.vercel.app . Credentials are stored privately in `.data/production-access.json` on this build computer; no sign-in password is committed or included in browser bundles.
- Remaining limits are data coverage/editorial sourcing and the stated online requirements, not missing paid API credentials or incomplete deployment. Optional keyed providers are unconfigured. No fully offline or universal-history claim is made.

## User-requested password removal — 13 November 2026

The user requested no password. Production now uses `PRODUCER_AUTH_MODE=open`: opening the producer page creates its signed browser session without a password form. Visiting the producer URL grants control in this intentional open mode. The output page does not bootstrap a producer session; its separate token remains read-only and cannot authorize producer mutations. CSRF/origin checks remain in place. Optional password mode is retained for deployments that explicitly enable it.

Five added tests verify password-free session creation without a password hash, session reuse, password-free POST with request protection, cross-origin rejection, and that output tokens do not gain producer sessions or write access. Full checks: type check, lint, 69 tests and production build passed. Existing episode/program data is preserved.

Password-free deployment `2d892f00ec6dd4e515c03b993eb80441fb48b4cb` reached READY. A fresh request without cookies/password created the signed producer session and opened episodes successfully; unauthenticated program access remained401. The user’s existing in-app browser was refreshed and visibly showed the football workspace with no password form or sign-out control. Screenshot: `docs/password-free.png`. No episode or program mutation was performed.
