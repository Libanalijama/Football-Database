import {
  createGraphic,
  type GraphicDocument,
  type GraphicSubject,
  type GraphicMetric,
} from "@/lib/graphics";
import type {
  PlayerData,
  TeamData,
  MatchData,
  LeagueData,
  Metric,
  Provenance,
} from "@/lib/football/types";
export type Selection =
  | { kind: "player"; data: PlayerData }
  | { kind: "team"; data: TeamData }
  | { kind: "match"; data: MatchData }
  | { kind: "league"; data: LeagueData };
const competitionNames: Record<string, string> = {
  "eng.1": "English Premier League",
  "esp.1": "Spanish LALIGA",
};
export function competitionName(slug: string) {
  return competitionNames[slug] ?? slug;
}
export function seasonName(season: number | null) {
  return season === null
    ? undefined
    : `${season}/${String(season + 1).slice(-2)}`;
}
export function dateName(input: string | null) {
  if (!input) return null;
  const numeric = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = new Date(
    numeric
      ? `${numeric[3]}-${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}T12:00:00Z`
      : input,
  );
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : input;
}
export function sourceOf(p: Provenance) {
  return {
    provider: p.provider === "espn" ? "ESPN" : p.provider,
    url: p.sourceUrl,
    attribution: p.provider === "espn" ? "ESPN" : p.provider,
    retrievedAt: p.retrievedAt,
    season: seasonName(p.season),
    competition: competitionName(p.competition),
    scope: p.scope,
    teamId: p.teamId,
    reportingPeriod:
      p.scope === "current-profile"
        ? `Profile as of ${dateName(p.retrievedAt)}`
        : seasonName(p.season),
  };
}
export function metricOf(m: Metric): GraphicMetric {
  const ratio = m.unit === "ratio";
  const value =
    m.value === null
      ? null
      : ratio
        ? Math.round(m.value * 1000) / 10
        : (m.displayValue ?? m.value);
  const unit = ratio
    ? "%"
    : m.unit === "count" ||
        (value !== null && m.unit && String(value).trim().endsWith(m.unit))
      ? ""
      : m.unit;
  return {
    key: m.key,
    label: m.label,
    value,
    unit,
    rawValue: m.value,
    rawUnit: m.unit,
    provenance: structuredClone(m.provenance),
    source: m.provenance.sourceUrl,
  };
}
/** Pair only equal provider metric definitions/units; the two independent scopes remain attached. */
export function comparisonMetrics(
  left: Metric[],
  right: Metric[],
): GraphicMetric[] {
  return left.map((metric) => {
    const other = right.find(
      (candidate) =>
        candidate.key === metric.key &&
        candidate.unit === metric.unit &&
        candidate.provenance.provider === metric.provenance.provider &&
        candidate.provenance.scope === metric.provenance.scope,
    );
    const prepared = metricOf(metric),
      second = other ? metricOf(other) : null;
    return {
      ...prepared,
      other: second?.value ?? null,
      otherProvenance: other ? structuredClone(other.provenance) : undefined,
      otherRawValue: other?.value,
      otherRawUnit: other?.unit,
    };
  });
}
export function subjectOf(selection: Selection): GraphicSubject | null {
  if (selection.kind === "player") {
    const { player: p, provenance: statisticsScope } = selection.data;
    const bioScope = p.scope ?? {
      ...statisticsScope,
      scope: "current-profile" as const,
      season: null,
      teamId: undefined,
    };
    const season = seasonName(statisticsScope.season);
    const fact = (
      label: string,
      value: string | null,
      key: string,
    ): GraphicMetric => ({
      key,
      label,
      value,
      source: bioScope.sourceUrl,
      provenance: structuredClone(bioScope),
    });
    return {
      id: `espn:player:${p.id}`,
      provider: "espn",
      sourceIds: {
        "espn:player": p.id,
        ...(p.team ? { "espn:team": p.team.id } : {}),
      },
      teamId: p.team?.id,
      provenance: structuredClone(statisticsScope),
      name: p.name,
      team: p.team?.name,
      image: p.portrait ?? undefined,
      crest: p.team?.crest ?? undefined,
      role: p.position ?? undefined,
      season,
      competition: competitionName(statisticsScope.competition),
      facts: [
        fact("Nationality", p.nationality, "nationality"),
        fact("Position", p.position, "position"),
        fact("Date of birth", dateName(p.birthDate), "dateOfBirth"),
        fact("Height", p.height, "height"),
      ],
    };
  }
  if (selection.kind === "team") {
    const t = selection.data.team;
    return {
      id: `espn:team:${t.id}`,
      provider: "espn",
      sourceIds: { "espn:team": t.id },
      teamId: t.id,
      provenance: structuredClone(selection.data.provenance),
      name: t.name,
      crest: t.crest ?? undefined,
      season: seasonName(selection.data.provenance.season),
      competition: competitionName(selection.data.provenance.competition),
    };
  }
  return null;
}
export function prepareSelection(
  selection: Selection,
  templateId?: string,
  existing?: GraphicDocument,
): GraphicDocument {
  const defaultId = {
    player: "profile-player",
    team: "statistics-player",
    match: "scoreboard-result",
    league: "table-league",
  }[selection.kind];
  const d = createGraphic(templateId ?? defaultId);
  d.source = sourceOf(selection.data.provenance);
  d.subtitle = [d.source.competition, d.source.season]
    .filter(Boolean)
    .join(" · ");
  const subject = subjectOf(selection);
  if (subject) {
    d.subjects = [subject];
    d.title = subject.name;
    for (const fact of subject.facts ?? [])
      if (fact.label in d.fields) d.fields[fact.label] = fact.value;
  }
  if (selection.kind === "player" || selection.kind === "team")
    d.metrics = selection.data.statistics.map(metricOf);
  if (selection.kind === "player" && d.templateId === "profile-player") {
    const bioScope = selection.data.player.scope ?? {
      ...selection.data.provenance,
      scope: "current-profile" as const,
      season: null,
      teamId: undefined,
    };
    d.source = sourceOf({
      ...bioScope,
      season: null,
      scope: "current-profile",
    });
    d.subtitle = "Current profile";
    const s = d.subjects[0];
    if (s) {
      s.provenance = structuredClone({
        ...bioScope,
        season: null,
        scope: "current-profile",
      });
      s.competition = undefined;
      s.season = undefined;
      if (s.team && selection.data.provenance.season !== null)
        s.team = `${s.team} · ${seasonName(selection.data.provenance.season)}`;
    }
  }
  if (selection.kind === "league") {
    const league = selection.data;
    d.title = league.competition.name;
    d.fields.Columns = "P,W,D,L,GD,PTS";
    d.rows = league.standings.map((s) => ({
      label: s.team.name,
      rank: s.rank,
      image: s.team.crest ?? undefined,
      columns: [s.played, s.won, s.drawn, s.lost, s.goalDifference, s.points],
      value: s.points,
      note: s.note ?? undefined,
    }));
    d.fields["Points deduction notes"] = league.standings
      .flatMap((s) =>
        s.note && /deduct|penalt|adjust/i.test(s.note)
          ? [`${s.team.name}: ${s.note}`]
          : [],
      )
      .join(" · ");
    if (d.templateId === "ranking-players") {
      d.title = `${league.competition.name} · Goals`;
      d.fields.Columns = null;
      d.fields.Metric = "Goals";
      d.fields.Units = null;
      d.fields.Ties = "Shared ranks for equal goals";
      d.rows = league.leaders
        .filter((l) => l.category === "totalGoals")
        .map((l) => ({
          label: l.player.name,
          rank: l.rank,
          value: l.value,
          note: l.player.team?.name,
          image: l.player.portrait ?? undefined,
        }));
    }
  }
  if (selection.kind === "match") {
    const m = selection.data.match;
    d.title = `${m.home.shortName} v ${m.away.shortName}`;
    d.match = {
      home: {
        id: `espn:team:${m.home.id}`,
        provider: "espn",
        sourceIds: { "espn:team": m.home.id },
        teamId: m.home.id,
        provenance: { ...m.provenance, teamId: m.home.id },
        name: m.home.name,
        crest: m.home.crest ?? undefined,
      },
      away: {
        id: `espn:team:${m.away.id}`,
        provider: "espn",
        sourceIds: { "espn:team": m.away.id },
        teamId: m.away.id,
        provenance: { ...m.provenance, teamId: m.away.id },
        name: m.away.name,
        crest: m.away.crest ?? undefined,
      },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
      events: m.events
        .filter(
          (e) =>
            e.kind === "goal" &&
            !e.shootout &&
            (e.teamId === m.home.id || e.teamId === m.away.id),
        )
        .map((e) => ({
          team: e.teamId === m.home.id ? "home" : "away",
          name: e.player ?? e.text,
          minute: e.minute ?? "",
          ownGoal: e.ownGoal,
          penalty: e.penalty,
          homeScore: e.homeScore ?? undefined,
          awayScore: e.awayScore ?? undefined,
        })),
      aggregate:
        m.homeAggregate !== null && m.awayAggregate !== null
          ? { home: m.homeAggregate, away: m.awayAggregate }
          : undefined,
      shootout:
        m.homeShootout !== null && m.awayShootout !== null
          ? { home: m.homeShootout, away: m.awayShootout }
          : undefined,
    };
    d.fields.Venue = m.venue;
    d.fields["Match date"] = dateName(m.kickoff);
    d.fields["Kick-off"] = m.kickoff
      ? new Date(m.kickoff).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/London",
        })
      : null;
    d.fields.Attendance = m.attendance;
    const home =
        m.statistics.find((x) => x.teamId === m.home.id)?.metrics ?? [],
      away = m.statistics.find((x) => x.teamId === m.away.id)?.metrics ?? [];
    d.metrics = comparisonMetrics(home, away);
    d.subjects = [d.match.home, d.match.away];
  }
  if (existing) {
    d.id = existing.id;
    d.title = existing.title;
    d.placement = existing.placement;
    d.background = existing.background;
  }
  return d;
}

/** Restore display scope from the saved provenance, without consulting a provider.
 * Values, source IDs, fields and editorial content remain in the same snapshot. */
export function retargetGraphicScope(
  graphic: GraphicDocument,
  templateId: string,
): GraphicDocument {
  // createGraphic validates the requested registry ID. Work on a deep copy so the
  // previous source snapshot stays available for override comparison and undo.
  const target = createGraphic(templateId, {
    ...structuredClone(graphic),
    templateId: templateId as GraphicDocument['templateId'],
  });
  const isProfile = templateId.startsWith('profile-');
  const wasProfile = graphic.templateId.startsWith('profile-');
  const statistical = (scope: Provenance | undefined) =>
    scope && scope.scope !== 'current-profile' ? scope : undefined;
  const statsScope = statistical(graphic.metrics.find(m => statistical(m.provenance))?.provenance)
    ?? statistical(graphic.subjects[0]?.provenance);
  const bioScope = graphic.subjects[0]?.facts?.find(f => f.provenance?.scope === 'current-profile')?.provenance
    ?? (graphic.subjects[0]?.provenance?.scope === 'current-profile' ? graphic.subjects[0].provenance : undefined);
  const nextScope = isProfile ? bioScope : statsScope;
  const oldScope = wasProfile ? bioScope : statsScope;
  if (nextScope) {
    const oldBase = oldScope ? sourceOf(oldScope) : null;
    const nextBase = sourceOf(isProfile ? { ...nextScope, season: null, scope: 'current-profile' } : nextScope);
    target.source = { ...target.source, ...nextBase };
    // Source attribution/URL/reporting-period edits are independent editorial
    // overrides. Changing the layout must not silently erase them.
    for (const key of ['url', 'attribution', 'reportingPeriod', 'provider'] as const) {
      const current = graphic.source[key];
      if (current !== undefined && oldBase && current !== oldBase[key]) target.source[key] = current;
    }
    const oldCaption = wasProfile && bioScope
      ? 'Current profile'
      : [graphic.source.competition, graphic.source.season].filter(Boolean).join(' · ');
    if (graphic.subtitle === oldCaption || graphic.subtitle === '') {
      target.subtitle = isProfile ? 'Current profile' : [nextBase.competition, nextBase.season].filter(Boolean).join(' · ');
    }
  }
  target.subjects = target.subjects.map((subject, index) => {
    const subjectStats = statistical(index === 0 ? statsScope : graphic.metrics.find(m => statistical(m.otherProvenance))?.otherProvenance)
      ?? statistical(subject.provenance);
    const subjectBio = subject.facts?.find(f => f.provenance?.scope === 'current-profile')?.provenance
      ?? (subject.provenance?.scope === 'current-profile' ? subject.provenance : undefined);
    if (isProfile && subjectBio) {
      subject.provenance = structuredClone({ ...subjectBio, season: null, scope: 'current-profile' });
      subject.competition = undefined;
      subject.season = undefined;
      const period = subjectStats ? seasonName(subjectStats.season) : undefined;
      if (subject.team && period && !subject.team.endsWith(` · ${period}`)) subject.team = `${subject.team} · ${period}`;
    } else if (!isProfile && subjectStats) {
      subject.provenance = structuredClone(subjectStats);
      subject.competition = competitionName(subjectStats.competition);
      subject.season = seasonName(subjectStats.season);
      const suffix = subject.season ? ` · ${subject.season}` : null;
      if (subject.team && suffix && subject.team.endsWith(suffix)) subject.team = subject.team.slice(0, -suffix.length);
    }
    return subject;
  });
  return target;
}
