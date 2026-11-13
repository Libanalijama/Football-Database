# Deployment status

The application is deployed at https://tgiq-football-database.vercel.app. Deployment `dpl_DnVgFGxst1RbhLbagAmhso1NKsod` is READY on reviewed source commit `3b09a062dedf1dc9585c60af19a8deca041b2c96`. It built in 25 seconds in the deployment logs and runs in `fra1`. Further live browser evidence and the final verification commit are recorded separately in `BUILD_EVIDENCE.md`.

## Authorized infrastructure

The user first limited provisioning to free resources, then explicitly authorized use of their existing paid Vercel account. A new, separate **tgiq-football-database** project was created in FRMX; no existing show's project, database or plan was reused or changed.

Project `prj_IlbF4JKgrlqqa8CgDmwGhG4jYAGc` is linked to the exact GitHub repository `Libanalijama/Football-Database` (repository ID 1455918392), production branch `main`. Its final runtime is Node 24, Fluid Compute in Frankfurt (`fra1`), with the basic build machine and a 30-second function timeout. The existing paid Vercel plan is now authorized; no new paid plan was purchased.

The dedicated Free Prisma Postgres resource is connected only to TGIQ production. New production-only producer credentials and a session secret were generated and stored in Vercel as Secret variables; local SQLite credentials were preserved. `APP_ORIGIN` is configured for the intended production alias. The local copy of production producer access is `.data/production-access.json`, mode 0600 and ignored by Git. No password or token appears in this document.

A dedicated **private** Blob store `tgiq-football-media` (`store_73R6HR9rQBRdjB7Z`) was created in `fra1` and connected only to TGIQ. The app uploads privately, stores origin/rights metadata in PostgreSQL, and streams images only after producer/output authentication. Five actual authenticated checks passed; see `BLOB_VERIFICATION.json`. Direct public object access was verified to fail.

Vercel CLI 65.15.0 and connected plugin reads verified resource identity, ownership, billing plans and configuration. Actual application deployment readiness and live checks are recorded below and in the linked verification reports.

## Database provisioning investigation

Read-only Marketplace discovery and billing-plan queries were completed. The existing Neon installation is on a paid Launch plan, so it was neither modified nor used for TGIQ. A free Neon plan exists, but its installation-level billing would conflict with the existing paid installation; the build did not downgrade or create resources there.

A new **Prisma Postgres Free** installation is a separate available path. The live Marketplace plan response reports no payment method required, 100K monthly operations, 2GB storage, and at most 50 databases. The free product accepts ordinary PostgreSQL clients, including this application's `pg` adapter; it does not require Prisma ORM. Free-tier limits and backup policy should be checked before filming.

The following explicit free-only installation was attempted:

```sh
npx vercel integration add prisma/prisma-postgres \
  --billing-plan free \
  --name tgiq-football-database \
  --meta region=fra1 \
  --no-connect --no-env-pull --no-claim --scope frmx
```

The first attempt returned `action_required` with reason `integration_terms_acceptance_required`. After explicit user authorization and confirmed browser “Terms Accepted”, the exact free-only command succeeded. A new, separate database `tgiq-football-database` is **available**, **owned**, and on the **Free** plan. Its installation is `icfg_X3YUlPAYgdNxWMe1VKMrVmpd`, resource `store_mz4Z4bH0EByfqCqq`. A fresh connected-plugin read confirmed `billingPlan.id=free`, `cost=Free`, and `paymentMethodRequired=false`. It is not connected to another show's project; the existing paid Neon installation was preserved.

Issued connection settings were saved privately in ignored `.env.production.local` (mode 0600), initially using the pooled URL for `DATABASE_URL`; recovery switched to the verified direct connection, retained as `DATABASE_URL_UNPOOLED`. The local SQLite `.env.local` configuration was preserved. The pool connections use certificate-verifying TLS. No secret value was printed or committed. CLI environment pulling requires a Vercel project, so the provider dashboard's copied snippet was transferred into a private local file instead; no hosting project was created to retrieve credentials.

Authenticated verification succeeded with **14 checks**: the live PostgreSQL connection; schema migration 1; episode snapshots, overrides, null/zero and missing-media reporting; JSON roundtrip; episode duplication; stale episode rejection; program take; concurrent version compare-and-swap; freeze without provider calls; connection reopen; revocable token digests; persistent media bytes/metadata; independent provider cache; and deliberate clear. See `POSTGRES_VERIFICATION.json`. The verification script removes only its test rows; the cloud program is left deliberately blank/frozen. The database is durable/claimed, not an expiring temporary unclaimed database. Free-tier limits and lack of automatic backups still apply.

The dedicated private Blob store is now provisioned and verified. The cloud **application hosting deployment** is READY. Nine actual HTTP checks passed on the public production alias: PostgreSQL/Blob health, production login, producer authorization, two-competition ESPN team/roster/player discovery, deployed private image upload/stream, unauthenticated image denial and program mutation denial. See `LIVE_HTTP_VERIFICATION.json`. The smoke check did not alter program state or rotate output access. The generated `-frmx` and deployment aliases remain protected by Vercel Authentication, while the stable production alias reaches the app own producer/output authentication. No Deployment Protection setting was weakened.

Official product references: [Prisma Postgres](https://www.prisma.io/docs/postgres), [Prisma pricing](https://www.prisma.io/pricing), [Neon plans](https://neon.com/docs/introduction/plans).

## Recreating the deployment

1. Create/link the separate TGIQ Vercel project to `Libanalijama/Football-Database` after its reviewed source is pushed. Do not link another show's project.
2. Connect the already provisioned, separate Free Prisma PostgreSQL database only to TGIQ. Use the verified working direct PostgreSQL URL in `DATABASE_URL` or `DATABASE_URL_UNPOOLED`. The provider pooled endpoint failed during recovery tests, so it must not silently override the working direct URL.
3. Set new production `SESSION_SECRET`, `PRODUCER_PASSWORD_HASH` and `APP_ORIGIN`. Keep these values server-side; do not copy local credentials to a public document or commit.
4. The dedicated private Blob store is already connected through its issued storage environment variable. Keep it private; database media persistence remains a durable fallback when object storage is unconfigured.
5. Schema migration 1 has already been authenticated and verified on the new PostgreSQL database. Run the idempotent migration script explicitly before a new deployment/schema version. Cold request startup performs no PostgreSQL DDL.
6. Build and deploy the reviewed commit, then check `/api/health`, login, two-competition ESPN browsing, save/reload/import, cross-session output, token rotation and provider-failure continuity on that deployment.
7. Record the actual URL, commit, READY status, authenticated database result and post-deployment checks in `BUILD_EVIDENCE.md`. Until those checks are completed, do not describe the cloud deployment as live.

## Cold-start recovery

The intermediate Node24 deployment exposed an intermittent provider pooled-endpoint failure and excessive cold-start setup work. Direct connections to the same dedicated database succeeded while the pooled proxy returned an explicit upstream error. Recovery commit `dce79d3870d5ec4dc37afd5e14c2c0c620733125` honors the working direct URL, removes PostgreSQL DDL from request startup, and bounds connect/query/statement/lock waits. Schema setup is now an explicit migration command; local SQLite retains automatic initialization.

The recovered deployment reached READY on Node24. First public cold health check returned HTTP200/readiness true in534ms; following checks took53ms and51ms. The database and private media store are unchanged. See `POSTGRES_RECOVERY.json` and `RECOVERY_DEPLOYMENT.json` for the isolated failure, actual connection tests and deployed results. Final browser follow-up is recorded in `final-browser-results.json`; initial full browser/uncached proofs remain tied to their recorded commits.
