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
- [ ] Failure, data correctness, browser workflows and visual verification.
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
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` passed. Latest completed suite: 60 meaningful tests across provider normalization/failure, preparation, graphics, editor overrides and durable persistence. Lint exits 0; jsx-ast-utils emits a nonfatal diagnostic about non-null JSX expressions.
- TypeScript was pinned to compatible6.0.3 because typescript-eslint8.72.2 supports<6.1. Dependencies were resolved and locked; npm audit reports0 vulnerabilities after transitive OIDC/minimatch fixes.
- Reference/design evidence: `docs/DESIGN_EVIDENCE.md`; live source evidence: `docs/ESPN_COVERAGE.md`, `docs/ESPN_LIVE_VERIFICATION.json`.
- Actual authenticated free Prisma PostgreSQL:14 store checks passed; see `docs/POSTGRES_VERIFICATION.json`. This is separate from local SQLite tests.
- Initial real browser runs proved no-key Premier League and LaLiga profile generation and independent read-only output. Browsing elsewhere preserved the on-air snapshot. The complete final browser report is recorded after the final build; intermediate scripts exposed and corrected stale preview, source-scope retention and test locator collisions with saved rundown buttons.
- A local isolated real HTTP integration test injects provider timeouts and verifies the frozen snapshot, prepared switching, storage reopen, state ordering and read-only mutation rejection.
- Tablet UI test: actual transparentPNG upload with origin/usage metadata, owner/financial editorial fields, saved0, subject-preserving template change, no program mutations. See `docs/screenshots/tablet-qa-results.json`.

## Deployment in progress
- User subsequently authorized the existing paid Vercel workspace. A distinct `tgiq-football-database` project was created and linked to this repository/main; other shows were not reused.
- Dedicated free Prisma database provisioned and authenticated as above. Secrets are held only in ignored local environment files and Vercel Secret variables.
- A cloud URL is not called live until deployment and post-deployment verification complete.
