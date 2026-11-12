# ESPN data coverage and build evidence

Verified without API credentials on 12 November 2026. The normal UI uses live server requests and independent bounded caches; these notes describe observed coverage, not a service-level guarantee. Public endpoint access does not establish commercial rights to data or images.

## Verified catalogue

| Competition | ESPN slug / ID | Observed season | Teams | Standings | Scoring leaders |
|---|---|---|---:|---:|---:|
| English Premier League | `eng.1` / `700` | 2026–27 (`2026`) | 20 | 20 | 50 goals + 50 assists |
| Spanish LALIGA | `esp.1` / `740` | 2026–27 (`2026`) | 20 | 20 | 50 goals + 50 assists |

Available season years come from the public standings response and are validated before requests. Selecting a listed year does not promise every endpoint has coverage for that year; endpoint responses must retain that explicit year. Current biography fields are kept separate from selected-season statistics. Historical roster success was additionally observed for Arsenal in 2024–25 (35 players). A player overview request containing `season=2024` actually returned current 2026–27 splits; the adapter rejects those statistics for a 2024 scope and uses a verified matching-season roster when available.

## Requests actually made

All URLs below were fetched successfully with no developer key, paid subscription or authentication header. The shell investigation used HTTPS requests, followed by a TypeScript run of the finished adapter itself. `tests/football.test.ts` contains isolated test inputs, never production fallback data.

- [Premier League scoreboard](https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard): HTTP 200, league identity, season 2026, five latest match-day events.
- [Premier League teams](https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams?limit=100): HTTP 200, 20 provider team identities.
- [Premier League standings](https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings): HTTP 200, season catalogue, ranks, points, deductions field and 20 teams.
- [Arsenal roster](https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/359/roster?season=2026): HTTP 200, 31 players with source IDs and competition-season statistics. Bukayo Saka is provider athlete `280555`; 15 statistics were mapped, including 7 appearances and 3 goals as retrieved.
- [Arsenal results](https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/359/schedule?season=2026&fixture=false) and [fixtures](https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/359/schedule?season=2026&fixture=true): HTTP 200, 10 results and 28 fixtures, combined without duplicates into 38 selected-season matches. Fixtures retain null scores until play starts.
- [Saka profile](https://site.web.api.espn.com/apis/common/v3/sports/soccer/eng.1/athletes/280555): HTTP 200, current profile and explicit team identity. [Overview](https://site.web.api.espn.com/apis/common/v3/sports/soccer/eng.1/athletes/280555/overview?season=2026): HTTP 200, splits carrying explicit league slug and team ID.
- [Brighton–Brentford summary, 401879244](https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=401879244): HTTP 200, home/away 2–0, 33 key events, 20 roster entries per side, 4-2-3-1 and 4-4-2 formations, starters, bench, substitution indicators, team and player match statistics.
- [LALIGA scoreboard](https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard), [teams](https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams?limit=100), [standings](https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings): HTTP 200, independent second competition, 20 teams and 20 standings.
- [Real Madrid roster](https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/teams/86/roster?season=2026): HTTP 200, 36 players. Vinícius Júnior is athlete `252107`; 15 mapped season statistics, including 8 appearances, 1 goal and 3 assists as retrieved. [Profile](https://site.web.api.espn.com/apis/common/v3/sports/soccer/esp.1/athletes/252107) and [overview](https://site.web.api.espn.com/apis/common/v3/sports/soccer/esp.1/athletes/252107/overview?season=2026) also succeeded. Real Madrid schedule combined 12 results and 26 fixtures into 38 matches.
- [LALIGA Elche–Real Betis summary, 401882814](https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/summary?event=401882814): HTTP 200, home/away 0–2, 30 key events, 23 roster entries per team, 4-3-3 and 4-2-3-1 formations, starters and bench, team and player match statistics. 
- Public [Premier League scoring page](https://www.espn.com/soccer/stats/_/league/eng.1/season/2026) and [LALIGA scoring page](https://www.espn.com/soccer/stats/_/league/esp.1/season/2026): HTTP 200. Structured JSON inside the exact `window['__espnfitt__']` assignment supplies scoring/assist tables. This is an isolated non-executing JSON parser, not a collection of HTML selectors. It validates table structure, explicit ESPN athlete/club IDs and requested season. Numerical equal values share ranks (1, 1, 3), independently of the page's ordinal ordering.

The tested current profiles and rosters did not supply Saka or Vinícius portrait URLs. They remain `null`. Crests are supplied by ESPN with explicit team IDs. No guessed headshot or unrelated photograph is substituted.

## Limitations and failure behavior

- Only the two catalogue competitions above are enabled. An unknown slug returns `UNKNOWN_COMPETITION`; an unavailable year returns `SEASON_UNAVAILABLE`. A discovered season is an opportunity to check coverage, not a guarantee of archival completeness.
- Current league fixture view shows ESPN's latest match day. Open a team for its full available selected-season fixtures/results. Historical league fixtures use ESPN calendar-year scoreboard responses, then explicitly filter the football season; calendar-year totals are not combined with season statistics.
- ESPN rejected attempted date-range scoreboard queries with HTTP 400. `season=2024` on scoreboard alone still returned current matches; the adapter does not trust that parameter. Year queries `dates=2024` and `dates=2026` succeeded.
- Public JSON `/leaders`, player `/stats`, and `/splits` candidates tested returned HTTP 404. The team `/statistics` endpoint returned an empty results payload. Team statistics currently use sourced standings values; scorer and assist tables use the narrow structured-page parser described above.
- The Arsenal 2026 roster coach array still names Arsène Wenger (`id: 5`). That manager record is not verified for the selected season and is deliberately excluded instead of producing an inaccurate manager card.
- Full transfer/contract terms, finances, ownership/executive data, complete career history, xG and provider ratings are unavailable in these mapped feeds. The adapter reports explicit capabilities. Production may enter sourced editorial content separately.
- Search is remote but bounded: competition team names, loaded fixtures and (after selecting a team) that team's selected-season squad. It is not worldwide player search. Search does not fetch every player at startup.
- Every metric retains provider, URL, retrieval time, competition, season, team-at-the-time where available, scope and unit. Missing is null; zero is retained only when supplied. ESPN possession percentages and 0–1 passing/shot ratios keep different units.
- Separate source mappings are required for optional providers. `supplement.ts` rejects missing ID mappings, differing definitions, seasons, units or scope, and preserves conflicting records for explicit selection. No name-only entity merge exists. No optional keyed adapter was present in the originally empty repository. `API_FOOTBALL_KEY` and `SPORTMONKS_API_TOKEN` are detected only as optional configuration, not invoked or silently substituted.
- Server requests use an 8-second timeout, per-instance 250-ms request spacing, bounded 250-entry memory cache, request coalescing, explicit protected `refresh=1` source refresh that bypasses caches without touching snapshots, 429 backoff and one 5xx retry. A durable independent database cache uses the same finite TTL. This is conservative per-instance limiting, not a provider-wide distributed quota guarantee. Cache database failure does not turn a successful ESPN response into a failure. Saved episode/on-air snapshots are separate from this cache.
- Source requests never follow ESPN private `$ref` values. Only allowlisted HTTPS public hosts are used. Source errors return producer-facing states, never runtime fixtures or sample data.

## Verification commands and results

- `npm test -- tests/football.test.ts`: 19 tests passed. Covers missing/zero, cancellation/pre-match scores, separate shootout/aggregate, chronological/reversed goal order, own-goal credited side, in-match penalty, missing roster/photo, deductions, tied leaders, page parser malformed data, coalescing, caching, timeout/schema errors, rate-limit backoff, unknown competition, unavailable historical year, selected-season preservation and supplemental-source provenance/conflicts.
- `npm test -- tests/football-http.test.ts`: one real localhost HTTP integration test passed. Mounts the actual football/program handlers with a separate temporary durable database, injects only ESPN request timeouts, verifies provider HTTP 503 leaves the frozen program unchanged, switches to another prepared snapshot, reopens storage/reconnects read-only output, rejects stale writes and read-only-token mutations. This is isolated from the normal development server and its cache.
- `npm test -- tests/prepare.test.ts`: 11 tests passed for saved offline template-scope restoration, raw ratio retention/conversion, null/zero, both comparison source records, current biography versus historical club/statistics, readable date/competition labels, own-goal/unknown-team filtering and one-category leaderboards.
- `npx tsx tests/football-live.mts` writes `docs/ESPN_LIVE_VERIFICATION.json` with the successful live adapter results.
- Finished adapter live run (two leagues → unsaved team/roster → player → summary → bounded search): succeeded for both catalogue competitions without paid keys. The live run imports `src/lib/football/espn.ts`; it does not use test fixtures.
- Football source TypeScript check had no errors; initial whole-repository check was waiting for the producer component being written concurrently. Final whole-product checks are recorded in `BUILD_EVIDENCE.md`.
- `npx eslint src/lib/football src/app/api/football tests/football*.ts`: passed after the shared TypeScript compatibility correction.
- Initial lint invocation was blocked by the repository's TypeScript 7 / typescript-eslint incompatibility; root build is resolving the shared dependency version and records final results separately.

## Optional scraper reference assessment

[tarun7r/Premier-League-API](https://github.com/tarun7r/Premier-League-API) was inspected as reference only. Its default branch is `main`; repository metadata reported no detected licence. The README describes an unofficial Flask scraper and limits its intended use to education. `main.py` discovers player pages with Google search and parses Premier League HTML classes; the broader app also uses OneFootball. This is narrow, selector-dependent, uncontracted coverage rather than a multi-league production data foundation. No code was copied, no repair work was attempted, and the application has no dependency on that project. Missing detected licensing does not grant copying or commercial data rights.
