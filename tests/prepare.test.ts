import { describe, expect, it } from "vitest";
import {
  comparisonMetrics,
  dateName,
  metricOf,
  prepareSelection,
  sourceOf,
  subjectOf,
  retargetGraphicScope,
} from "../src/lib/prepare";
import { graphicSchema } from "../src/lib/graphics/schema";
import {
  normalizeMatch,
  normalizePlayer,
  normalizeTeam,
} from "../src/lib/football/normalize";
import type {
  LeagueData,
  Metric,
  PlayerData,
  Provenance,
} from "../src/lib/football/types";
const provenance: Provenance = {
  provider: "espn",
  sourceUrl: "https://site.api.espn.com/selected-season",
  retrievedAt: "2026-11-12T23:00:00Z",
  competition: "eng.1",
  season: 2024,
  scope: "competition-season",
  teamId: "359",
};
const bio: Provenance = {
  ...provenance,
  sourceUrl: "https://site.web.api.espn.com/current-profile",
  scope: "current-profile",
  season: null,
  teamId: undefined,
};
const metric = (partial: Partial<Metric> = {}): Metric => ({
  key: "totalGoals",
  label: "Goals",
  value: 0,
  displayValue: "0",
  unit: "count",
  provenance,
  ...partial,
});
const team = normalizeTeam({
  id: "359",
  displayName: "Historical club",
  shortDisplayName: "Club",
  logo: "https://source.test/crest.png",
});
function playerData(): PlayerData {
  return {
    player: normalizePlayer(
      {
        id: "280555",
        displayName: "Multilingual Ñáme",
        citizenship: "England",
        displayDOB: "9/5/2001",
        position: { displayName: "Forward" },
        displayHeight: "5ft 10in",
      },
      team,
      bio,
    ),
    currentTeam: normalizeTeam({ id: "999", displayName: "Current club" }),
    statistics: [metric()],
    history: [],
    capabilities: { profile: { available: true } },
    notices: [],
    provenance,
  };
}
describe("data-to-graphics scope and formatting", () => {
  it("retains zero/null and the original metric identity, scope and retrieval time", () => {
    const zero = metricOf(metric()),
      missing = metricOf(metric({ value: null, displayValue: "--" }));
    expect(zero.value).toBe("0");
    expect(zero.rawValue).toBe(0);
    expect(missing.value).toBeNull();
    expect(zero.provenance).toEqual(provenance);
    expect(zero.key).toBe("totalGoals");
    const graphic = prepareSelection(
      { kind: "player", data: playerData() },
      "statistics-player",
    );
    expect(graphicSchema.parse(graphic).metrics[0].provenance).toEqual(
      provenance,
    );
    expect(graphic.source).toMatchObject({
      provider: "ESPN",
      competition: "English Premier League",
      season: "2024/25",
      scope: "competition-season",
      teamId: "359",
    });
  });
  it("converts provider ratios to percent once and preserves raw source units and values", () => {
    const ratio = metricOf(
      metric({
        key: "passPct",
        label: "Pass Completion %",
        value: 0.9,
        displayValue: "0.9",
        unit: "ratio",
      }),
    );
    expect(ratio).toMatchObject({
      value: 90,
      unit: "%",
      rawValue: 0.9,
      rawUnit: "ratio",
    });
    const percent = metricOf(
      metric({
        key: "possessionPct",
        value: 75.3,
        displayValue: "75.3%",
        unit: "%",
      }),
    );
    expect(percent.value).toBe("75.3%");
    expect(percent.unit).toBe("");
  });
  it("compares independent seasons with transformed values and both metric provenances", () => {
    const a = metric({
        key: "passPct",
        value: 0.9,
        displayValue: ".9",
        unit: "ratio",
      }),
      b = metric({
        ...a,
        value: 0.85,
        displayValue: ".85",
        provenance: {
          ...provenance,
          season: 2026,
          teamId: "86",
          competition: "esp.1",
        },
      });
    const paired = comparisonMetrics([a], [b])[0];
    expect(paired.value).toBe(90);
    expect(paired.other).toBe(85);
    expect(paired.otherRawValue).toBe(0.85);
    expect(paired.otherRawUnit).toBe("ratio");
    expect(paired.provenance?.season).toBe(2024);
    expect(paired.otherProvenance?.season).toBe(2026);
    expect(
      comparisonMetrics([a], [{ ...b, unit: "count" }])[0].other,
    ).toBeNull();
    expect(
      comparisonMetrics(
        [a],
        [{ ...b, provenance: { ...b.provenance, provider: "sportmonks" } }],
      )[0].other,
    ).toBeNull();
  });
  it("keeps current biography facts separate from historical statistics and team-at-the-time", () => {
    const selection = { kind: "player" as const, data: playerData() };
    const subject = subjectOf(selection)!;
    expect(subject.season).toBe("2024/25");
    expect(subject.team).toBe("Historical club");
    expect(
      subject.facts?.find((f) => f.key === "position")?.provenance,
    ).toMatchObject({ scope: "current-profile", season: null });
    expect(subject.facts?.find((f) => f.key === "dateOfBirth")?.value).toBe(
      "5 Sept 2001",
    );
    const profile = prepareSelection(selection);
    expect(profile.source.scope).toBe("current-profile");
    expect(profile.source.season).toBeUndefined();
    expect(profile.source.reportingPeriod).toBe("Profile as of 12 Nov 2026");
    expect(profile.subjects[0].team).toBe("Historical club · 2024/25");
    expect(profile.subjects[0].season).toBeUndefined();
    expect(profile.subtitle).toBe("Current profile");
    expect(profile.metrics[0].provenance?.season).toBe(2024);
  });
  it("formats dates without changing date-only values across time zones", () => {
    expect(dateName("2001-09-05T00:00:00Z")).toBe("5 Sept 2001");
    expect(dateName(null)).toBeNull();
    expect(sourceOf(provenance).competition).toBe("English Premier League");
  });
  it("preserves scorer team order/own goals, omits unknown teams and keeps shootout separate", () => {
    const scope = { ...provenance, scope: "match" as const };
    const match = normalizeMatch(
      {
        id: "123",
        season: { year: 2024 },
        competitions: [
          {
            date: "2024-10-01T19:00Z",
            status: {
              type: { state: "post", completed: true, shortDetail: "FT" },
            },
            competitors: [
              {
                homeAway: "away",
                team: {
                  id: "2",
                  displayName: "Away full name",
                  shortDisplayName: "Away",
                },
                score: "1",
                shootoutScore: "3",
              },
              {
                homeAway: "home",
                team: {
                  id: "1",
                  displayName: "Home full name",
                  shortDisplayName: "Home",
                },
                score: "1",
                shootoutScore: "4",
              },
            ],
          },
        ],
      },
      scope,
      {
        keyEvents: [
          {
            id: "1",
            scoringPlay: true,
            ownGoal: true,
            type: { text: "Own Goal" },
            team: { id: "2" },
            clock: { value: 60, displayValue: "1'" },
            athletesInvolved: [{ id: "9", displayName: "Home defender" }],
          },
          {
            id: "2",
            scoringPlay: true,
            type: { text: "Goal" },
            team: { id: "999" },
            clock: { value: 90, displayValue: "2'" },
          },
          {
            id: "3",
            scoringPlay: true,
            shootout: true,
            type: { text: "Goal" },
            team: { id: "1" },
            clock: { value: 5400 },
          },
        ],
      },
    );
    const document = prepareSelection({
      kind: "match",
      data: { match, capabilities: {}, notices: [], provenance: scope },
    });
    expect(document.title).toBe("Home v Away");
    expect(document.match?.home.name).toBe("Home full name");
    expect(document.match?.events).toHaveLength(1);
    expect(document.match?.events[0]).toMatchObject({
      team: "away",
      ownGoal: true,
      name: "Home defender",
      homeScore: 0,
      awayScore: 1,
    });
    expect(document.match?.shootout).toEqual({ home: 4, away: 3 });
    expect(document.match?.homeScore).toBe(1);
  });
  it("builds player leaderboards from one definition and retains deduction notes only where relevant", () => {
    const player = playerData().player;
    const league: LeagueData = {
      competition: {
        id: "700",
        slug: "eng.1",
        name: "English Premier League",
        logo: null,
      },
      season: 2024,
      seasons: [2024],
      teams: [team],
      matches: [],
      standings: [
        {
          rank: 1,
          team,
          played: 38,
          won: 25,
          drawn: 6,
          lost: 7,
          goalsFor: 60,
          goalsAgainst: 25,
          goalDifference: 35,
          points: 78,
          note: "3 points deducted",
          group: null,
          provenance,
        },
      ],
      leaders: [
        {
          category: "totalGoals",
          label: "Goals",
          rank: 1,
          player,
          value: 10,
          displayValue: "10",
          provenance,
        },
        {
          category: "goalAssists",
          label: "Assists",
          rank: 1,
          player: { ...player, id: "other" },
          value: 20,
          displayValue: "20",
          provenance,
        },
      ],
      capabilities: {},
      notices: [],
      provenance,
    };
    const ranking = prepareSelection(
      { kind: "league", data: league },
      "ranking-players",
    );
    expect(ranking.rows).toHaveLength(1);
    expect(ranking.fields.Metric).toBe("Goals");
    expect(ranking.fields.Columns).toBeNull();
    const assists = prepareSelection(
      { kind: "league", data: league },
      "ranking-players",
      undefined,
      "goalAssists",
    );
    expect(assists.fields.Metric).toBe("Assists");
    expect(assists.rows).toHaveLength(1);
    expect(assists.rows[0]).toMatchObject({
      subjectId: "espn:player:other",
      value: 20,
      provenance,
    });
    const table = prepareSelection({ kind: "league", data: league });
    expect(table.fields["Points deduction notes"]).toContain(
      "3 points deducted",
    );
  });
});

describe("saved snapshot template changes", () => {
  it("restores historical statistic captions offline and keeps identities, values and overrides", () => {
    const profile = graphicSchema.parse(
      JSON.parse(
        JSON.stringify(
          prepareSelection({ kind: "player", data: playerData() }),
        ),
      ),
    );
    profile.fields["Editorial note"] = "Keep this correction";
    profile.metrics[0].value = 12;
    profile.title = "Editorial title";
    const statistics = retargetGraphicScope(profile, "statistics-player");
    expect(statistics.templateId).toBe("statistics-player");
    expect(statistics.source).toMatchObject({
      scope: "competition-season",
      season: "2024/25",
      competition: "English Premier League",
      teamId: "359",
      url: provenance.sourceUrl,
    });
    expect(statistics.subtitle).toBe("English Premier League · 2024/25");
    expect(statistics.subjects[0]).toMatchObject({
      id: "espn:player:280555",
      team: "Historical club",
      season: "2024/25",
      competition: "English Premier League",
      sourceIds: { "espn:player": "280555", "espn:team": "359" },
    });
    expect(
      statistics.subjects[0].facts?.find((f) => f.key === "position")
        ?.provenance,
    ).toEqual(bio);
    expect(statistics.title).toBe("Editorial title");
    expect(statistics.fields["Editorial note"]).toBe("Keep this correction");
    expect(statistics.metrics[0].value).toBe(12);
    expect(statistics.metrics[0].rawValue).toBe(0);
    expect(statistics.metrics[0].provenance).toEqual(provenance);
    expect(profile.subjects[0].team).toBe("Historical club · 2024/25");
  });
  it("restores current profile provenance from saved facts without relabelling biography as historical", () => {
    const statistics = graphicSchema.parse(
      JSON.parse(
        JSON.stringify(
          prepareSelection(
            { kind: "player", data: playerData() },
            "statistics-player",
          ),
        ),
      ),
    );
    const profile = retargetGraphicScope(statistics, "profile-player");
    expect(profile.source).toMatchObject({
      scope: "current-profile",
      url: bio.sourceUrl,
      reportingPeriod: "Profile as of 12 Nov 2026",
    });
    expect(profile.source.season).toBeUndefined();
    expect(profile.subtitle).toBe("Current profile");
    expect(profile.subjects[0].season).toBeUndefined();
    expect(profile.subjects[0].team).toBe("Historical club · 2024/25");
    expect(profile.metrics).toEqual(statistics.metrics);
    const again = retargetGraphicScope(
      retargetGraphicScope(profile, "statistics-player"),
      "profile-player",
    );
    expect(again.subjects[0].team).toBe("Historical club · 2024/25");
    expect(again.metrics).toEqual(profile.metrics);
  });
  it("keeps explicit editorial attribution and custom captions during a layout change", () => {
    const profile = prepareSelection({ kind: "player", data: playerData() });
    profile.source.attribution = "Production correction";
    profile.source.url = "https://editorial.test/report";
    profile.subtitle = "Editorial caption";
    const statistics = retargetGraphicScope(profile, "statistics-player");
    expect(statistics.source.attribution).toBe("Production correction");
    expect(statistics.source.url).toBe("https://editorial.test/report");
    expect(statistics.subtitle).toBe("Editorial caption");
    expect(statistics.source.scope).toBe("competition-season");
  });
  it("retains independent comparison seasons on both subjects and never invents a missing scope", () => {
    const first = prepareSelection(
      { kind: "player", data: playerData() },
      "comparison-player",
    );
    const second = playerData();
    second.provenance = {
      ...provenance,
      season: 2026,
      competition: "esp.1",
      teamId: "86",
    };
    second.player = {
      ...second.player,
      id: "252107",
      name: "Second subject",
      team: { ...team, id: "86", name: "Other club" },
    };
    second.statistics = [metric({ provenance: second.provenance })];
    first.subjects.push(subjectOf({ kind: "player", data: second })!);
    first.metrics = comparisonMetrics(
      playerData().statistics,
      second.statistics,
    );
    const restored = retargetGraphicScope(first, "comparison-season");
    expect(restored.subjects.map((s) => [s.competition, s.season])).toEqual([
      ["English Premier League", "2024/25"],
      ["Spanish LALIGA", "2026/27"],
    ]);
    const noData = {
      ...first,
      metrics: [],
      subjects: first.subjects.map((s) => ({
        ...s,
        provenance: undefined,
        facts: [],
      })),
      source: {},
    };
    expect(retargetGraphicScope(noData, "statistics-player").source).toEqual(
      {},
    );
    expect(() => retargetGraphicScope(first, "unknown")).toThrow(
      "Unknown graphic template",
    );
  });
});
