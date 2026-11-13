"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, ChevronRight, ArrowLeft, Plus, RefreshCw } from "lucide-react";
import type {
  Competition,
  LeagueData,
  TeamData,
  PlayerData,
  MatchData,
  SearchData,
  Team,
  Player,
  Match,
} from "@/lib/football/types";
import {
  metricOf,
  dateName,
  competitionName,
  seasonName,
  type Selection,
} from "@/lib/prepare";
function displayMetric(m: Parameters<typeof metricOf>[0]) {
  const x = metricOf(m);
  return x.value === null
    ? "Unavailable"
    : `${x.value}${x.unit ? ` ${x.unit}` : ""}`;
}
export async function footballRequest<T>(
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") q.set(k, String(v));
  });
  const r = await fetch(`/api/football?${q}`, { signal });
  const body = await r.json();
  if (!r.ok) throw Error(body.error ?? "Data unavailable");
  return body.data as T;
}
function Identity({
  src,
  name,
  avatar = false,
}: {
  src?: string | null;
  name: string;
  avatar?: boolean;
}) {
  return src ? (
    <img
      className={avatar ? "avatar" : ""}
      src={src}
      alt=""
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  ) : (
    <span className="crest" aria-label={name} />
  );
}
export function FootballBrowser({
  onPrepare,
  onCompare,
  onSelect,
  refreshKey,
}: {
  onPrepare: (
    s: Selection,
    templateId?: string,
    leaderCategory?: "totalGoals" | "goalAssists",
  ) => void;
  onCompare: (s: Selection) => void;
  onSelect: (s: Selection) => void;
  refreshKey: number;
}) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competition, setCompetition] = useState("eng.1");
  const [season, setSeason] = useState<number>();
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [tab, setTab] = useState("Teams");
  const [leaderCategory, setLeaderCategory] = useState<
    "totalGoals" | "goalAssists"
  >("totalGoals");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    footballRequest<Competition[]>({ kind: "competitions" })
      .then(setCompetitions)
      .catch((e) => setError(e.message));
  }, []);
  const loadLeague = useCallback(async () => {
    const n = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setLoading(true);
    setError("");
    setSelected(null);
    setTeam(null);
    try {
      const d = await footballRequest<LeagueData>(
        { kind: "league", competition, season },
        controller.current.signal,
      );
      if (n === generation.current) {
        setLeague(d);
        onSelect({ kind: "league", data: d });
      }
    } catch (e) {
      if (
        n === generation.current &&
        e instanceof Error &&
        e.name !== "AbortError"
      )
        setError(e.message);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }, [competition, season, onSelect]);
  useEffect(() => {
    loadLeague();
  }, [loadLeague, refreshKey]);
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearch(null);
      return;
    }
    const c = new AbortController();
    setSearching(true);
    const timer = setTimeout(
      () =>
        footballRequest<SearchData>(
          {
            kind: "search",
            competition,
            season: season ?? league?.season,
            q: query,
            teamId: team?.team.id,
          },
          c.signal,
        )
          .then(setSearch)
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          })
          .finally(() => {
            if (!c.signal.aborted) setSearching(false);
          }),
      350,
    );
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [query, competition, season, league?.season, team?.team.id]);
  async function open(
    kind: "team" | "player" | "match",
    id: string,
    teamId?: string,
  ) {
    const n = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setLoading(true);
    setError("");
    setQuery("");
    try {
      const d = await footballRequest<TeamData | PlayerData | MatchData>(
        { kind, competition, season: season ?? league?.season, id, teamId },
        controller.current.signal,
      );
      if (n === generation.current) {
        const s = { kind, data: d } as Selection;
        setSelected(s);
        onSelect(s);
        if (kind === "team") {
          setTeam(d as TeamData);
          setTab("Squad");
        }
      }
    } catch (e) {
      if (
        n === generation.current &&
        e instanceof Error &&
        e.name !== "AbortError"
      )
        setError(e.message);
    } finally {
      if (n === generation.current) setLoading(false);
    }
  }
  const teamButton = (t: Team) => (
    <button className="entity" key={t.id} onClick={() => open("team", t.id)}>
      <Identity src={t.crest} name={t.name} />
      <span>
        <b>{t.name}</b>
        <small>
          {league?.competition.name} · {league?.season}
        </small>
      </span>
      <ChevronRight size={15} className="chevron" />
    </button>
  );
  const playerButton = (p: Player) => (
    <button
      className="entity"
      data-entity-id={p.id}
      data-entity-kind="player"
      key={p.id}
      onClick={() => open("player", p.id, team?.team.id)}
    >
      <Identity src={p.portrait} name={p.name} avatar />
      <span>
        <b>{p.name}</b>
        <small>
          {[p.position, p.nationality, p.jersey && `#${p.jersey}`]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </span>
      <ChevronRight size={15} className="chevron" />
    </button>
  );
  const matchButton = (m: Match) => (
    <button className="entity" key={m.id} onClick={() => open("match", m.id)}>
      <Identity src={m.home.crest} name={m.home.name} />
      <span>
        <b>
          {m.home.shortName} · {m.away.shortName}
        </b>
        <small>
          {m.status} ·{" "}
          {new Date(m.kickoff).toLocaleDateString("en-GB", {
            timeZone: "Europe/London",
          })}
        </small>
      </span>
      <span className="score-badge">
        {m.state === "pre"
          ? "–"
          : `${m.homeScore ?? "–"} : ${m.awayScore ?? "–"}`}
      </span>
    </button>
  );
  const current =
    selected ?? (league ? { kind: "league" as const, data: league } : null);
  const notices = current?.data.notices ?? [];
  return (
    <>
      <div className="section-heading">
        <h2>Football browser</h2>
        <span className="badge">ESPN</span>
      </div>
      <div className="grid2">
        <label>
          Competition
          <select
            aria-label="Competition"
            value={competition}
            onChange={(e) => {
              setCompetition(e.target.value);
              setSeason(undefined);
              setQuery("");
            }}
          >
            {competitions.length ? (
              competitions.map((c) => (
                <option value={c.slug} key={c.slug}>
                  {c.name}
                </option>
              ))
            ) : (
              <option value="eng.1">Loading</option>
            )}
          </select>
        </label>
        <label>
          Season
          <select
            aria-label="Season"
            value={season ?? league?.season ?? ""}
            onChange={(e) => setSeason(Number(e.target.value))}
          >
            {league?.seasons.map((s) => (
              <option key={s} value={s}>
                {s}/{String(s + 1).slice(-2)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <Search size={17} />
        <input
          aria-label="Search football"
          className="grow"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams, players, matches"
        />
      </div>
      <p className="search-boundary">
        Remote: {league?.competition.name ?? competition},{" "}
        {season ?? league?.season ?? "current season"}
        {team
          ? ` · ${team.team.name} squad`
          : " · team lists and fixtures; select a team to search its squad"}
        . Saved graphics are in the rundown.
      </p>
      {loading && <div className="progress" />}
      {error && (
        <div role="alert" className="notice error">
          {error}
          <button className="subtle" onClick={loadLeague}>
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}
      {query.length >= 2 ? (
        <>
          <div className="section-heading">
            <h3>Remote results</h3>
            {searching && <small>Searching</small>}
          </div>
          <div className="list">
            {search?.results.map((r) => (
              <button
                className="entity"
                key={`${r.kind}:${r.id}`}
                onClick={() => open(r.kind, r.id, r.teamId)}
              >
                <Identity src={r.image} name={r.name} />
                <span>
                  <b>{r.name}</b>
                  <small>{r.detail} · ESPN</small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {search && !search.results.length && (
              <div className="empty">No results in this scope</div>
            )}
          </div>
          {search?.boundary && (
            <p className="search-boundary">{search.boundary}</p>
          )}
        </>
      ) : (
        <>
          {selected && (
            <button
              className="subtle"
              onClick={() => {
                if (selected.kind === "player" && team) {
                  const s = { kind: "team" as const, data: team };
                  setSelected(s);
                  onSelect(s);
                  setTab("Squad");
                } else {
                  setSelected(null);
                  setTeam(null);
                  setTab("Teams");
                  if (league) onSelect({ kind: "league", data: league });
                }
              }}
            >
              <ArrowLeft size={14} />
              {selected.kind === "player" && team
                ? team.team.shortName
                : "Competition"}
            </button>
          )}
          {selected?.kind === "player" && (
            <>
              <div className="detail-head">
                <Identity
                  src={selected.data.player.portrait}
                  name={selected.data.player.name}
                />
                <div>
                  <h2>{selected.data.player.name}</h2>
                  <small>{selected.data.player.team?.name}</small>
                </div>
              </div>
              <div className="facts">
                {[
                  ["Position", selected.data.player.position],
                  ["Nationality", selected.data.player.nationality],
                  ["Date of birth", dateName(selected.data.player.birthDate)],
                  ["Height", selected.data.player.height],
                ].map(([k, v]) => (
                  <div className="fact" key={k}>
                    <small>{k}</small>
                    <strong>{v ?? "Unavailable"}</strong>
                  </div>
                ))}
              </div>
              <div className="toolbar">
                <button
                  className="primary"
                  disabled={loading}
                  onClick={() => onPrepare(selected)}
                >
                  <Plus size={14} />
                  Prepare graphic
                </button>
                <button disabled={loading} onClick={() => onCompare(selected)}>
                  Compare
                </button>
              </div>
              <div className="list">
                {selected.data.statistics.map((m) => (
                  <div className="statline" key={m.key}>
                    <span>{m.label}</span>
                    <b>{displayMetric(m)}</b>
                  </div>
                ))}
              </div>
              <h3>Team history</h3>
              {selected.data.history.length ? (
                selected.data.history.map((h, i) => (
                  <div key={i} className="statline">
                    <span>{h.team.name}</span>
                    <b>{h.season ?? "Current"}</b>
                  </div>
                ))
              ) : (
                <small>Unavailable from this source</small>
              )}
            </>
          )}
          {selected?.kind === "match" && (
            <>
              <div className="eyebrow">{selected.data.match.status}</div>
              <div className="match-score">
                <span>
                  <Identity src={selected.data.match.home.crest} name="" />
                  {selected.data.match.home.name}
                </span>
                <strong>
                  {selected.data.match.homeScore ?? "–"} :{" "}
                  {selected.data.match.awayScore ?? "–"}
                </strong>
                <span>
                  <Identity src={selected.data.match.away.crest} name="" />
                  {selected.data.match.away.name}
                </span>
              </div>
              <small>
                {selected.data.match.venue} ·{" "}
                {new Date(selected.data.match.kickoff).toLocaleString("en-GB", {
                  timeZone: "Europe/London",
                })}
              </small>
              <button
                className="primary"
                disabled={loading}
                onClick={() => onPrepare(selected)}
              >
                <Plus size={14} />
                Prepare scoreboard
              </button>
              <div className="tabs">
                {["Events", "Lineups", "Match stats"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="list">
                {(tab === "Events" ||
                  !["Lineups", "Match stats"].includes(tab)) &&
                  selected.data.match.events.map((e) => (
                    <div className="statline" key={e.id}>
                      <span>
                        {e.minute} {e.text}
                      </span>
                    </div>
                  ))}
                {tab === "Lineups" &&
                  selected.data.match.lineups.map((l) => (
                    <div key={l.teamId}>
                      <h3>
                        {l.teamId === selected.data.match.home.id
                          ? selected.data.match.home.name
                          : selected.data.match.away.name}{" "}
                        · {l.formation ?? "Formation unavailable"}
                      </h3>
                      {["Starting XI", "Bench"].map((group, i) => (
                        <div key={group}>
                          <div className="eyebrow" style={{ marginTop: 12 }}>
                            {group}
                          </div>
                          {l.players
                            .filter((p) =>
                              i === 0 ? p.starter : p.starter === false,
                            )
                            .map((p) => (
                              <details key={p.id} className="lineup-player">
                                <summary className="statline">
                                  <span>
                                    {p.jersey} · {p.name}
                                  </span>
                                  <small>
                                    {p.position}
                                    {p.substituted ? " · Substitution" : ""}
                                  </small>
                                </summary>
                                {p.statistics.length ? (
                                  p.statistics.map((m) => (
                                    <div className="statline" key={m.key}>
                                      <span>{m.label}</span>
                                      <b>{displayMetric(m)}</b>
                                    </div>
                                  ))
                                ) : (
                                  <small>Player statistics unavailable</small>
                                )}
                                <button
                                  disabled={loading}
                                  onClick={() => open("player", p.id, l.teamId)}
                                >
                                  Open player
                                </button>
                              </details>
                            ))}
                        </div>
                      ))}
                    </div>
                  ))}
                {tab === "Match stats" &&
                  selected.data.match.statistics.map((s) => (
                    <div key={s.teamId}>
                      <h3>
                        {s.teamId === selected.data.match.home.id
                          ? selected.data.match.home.name
                          : selected.data.match.away.name}
                      </h3>
                      {s.metrics.map((m) => (
                        <div className="statline" key={m.key}>
                          <span>{m.label}</span>
                          <b>{displayMetric(m)}</b>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </>
          )}
          {selected?.kind === "team" && (
            <>
              <div className="detail-head">
                <Identity
                  src={selected.data.team.crest}
                  name={selected.data.team.name}
                />
                <div>
                  <h2>{selected.data.team.name}</h2>
                  <small>{selected.data.team.venue}</small>
                </div>
              </div>
              <div className="toolbar">
                <button disabled={loading} onClick={() => onPrepare(selected)}>
                  <Plus size={14} />
                  Prepare graphic
                </button>
                <button disabled={loading} onClick={() => onCompare(selected)}>
                  Compare
                </button>
              </div>
              <div className="tabs">
                {["Squad", "Fixtures", "Team stats"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="list">
                {tab === "Squad" && selected.data.squad.map(playerButton)}
                {tab === "Fixtures" && selected.data.matches.map(matchButton)}
                {tab === "Team stats" &&
                  selected.data.statistics.map((m) => (
                    <div className="statline" key={m.key}>
                      <span>{m.label}</span>
                      <b>{displayMetric(m)}</b>
                    </div>
                  ))}
                {tab === "Squad" && !selected.data.squad.length && (
                  <div className="empty">Squad unavailable for this season</div>
                )}
              </div>
            </>
          )}
          {!selected && league && (
            <>
              <div className="tabs">
                {["Teams", "Fixtures", "Standings", "Leaders"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Standings" ? (
                <>
                  <button
                    onClick={() => onPrepare({ kind: "league", data: league })}
                  >
                    <Plus size={14} />
                    Prepare table
                  </button>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Team</th>
                          <th>P</th>
                          <th>GD</th>
                          <th>PTS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {league.standings.map((s) => (
                          <tr key={s.team.id}>
                            <td>{s.rank ?? "–"}</td>
                            <td>
                              <button
                                className="subtle"
                                onClick={() => open("team", s.team.id)}
                              >
                                {s.team.shortName}
                              </button>
                              {s.note && <small>{s.note}</small>}
                            </td>
                            <td>{s.played ?? "–"}</td>
                            <td>{s.goalDifference ?? "–"}</td>
                            <td>{s.points ?? "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="list">
                  {(tab === "Teams" ||
                    !["Fixtures", "Leaders"].includes(tab)) &&
                    league.teams.map(teamButton)}
                  {tab === "Fixtures" && league.matches.map(matchButton)}
                  {tab === "Leaders" && (
                    <div className="toolbar">
                      <label>
                        Metric
                        <select
                          aria-label="Leaderboard metric"
                          value={leaderCategory}
                          onChange={(e) =>
                            setLeaderCategory(
                              e.target.value as "totalGoals" | "goalAssists",
                            )
                          }
                        >
                          <option value="totalGoals">Goals</option>
                          <option value="goalAssists">Assists</option>
                        </select>
                      </label>
                      <button
                        onClick={() =>
                          onPrepare(
                            { kind: "league", data: league },
                            "ranking-players",
                            leaderCategory,
                          )
                        }
                      >
                        Prepare leaderboard
                      </button>
                    </div>
                  )}
                  {tab === "Leaders" &&
                    league.leaders
                      .filter((l) => l.category === leaderCategory)
                      .map((l, i) => (
                        <button
                          className="entity"
                          key={`${l.category}:${l.player.id}:${i}`}
                          onClick={() =>
                            open("player", l.player.id, l.player.team?.id)
                          }
                        >
                          <span className="index">{l.rank}</span>
                          <span>
                            <b>{l.player.name}</b>
                            <small>
                              {l.label} · {l.player.team?.name}
                            </small>
                          </span>
                          <strong className="score-badge">
                            {l.displayValue ?? l.value ?? "–"}
                          </strong>
                        </button>
                      ))}
                  {tab === "Leaders" && !league.leaders.length && (
                    <div className="empty">Leaders unavailable</div>
                  )}
                </div>
              )}
            </>
          )}
          {loading && !league && (
            <div className="loading">Loading competition</div>
          )}
          {notices.map((n, i) => (
            <div className="notice" key={i}>
              {n}
            </div>
          ))}
          {current && (
            <details>
              <summary className="source-note">Coverage & source</summary>
              <p className="source-note">
                ESPN · {competitionName(current.data.provenance.competition)} ·{" "}
                {seasonName(current.data.provenance.season) ??
                  "Current profile"}{" "}
                · Retrieved{" "}
                {new Date(current.data.provenance.retrievedAt).toLocaleString(
                  "en-GB",
                  { timeZone: "Europe/London" },
                )}
              </p>
              {Object.entries(current.data.capabilities).map(([k, v]) => (
                <p key={k} className="source-note">
                  {k
                    .replace(/([a-z])([A-Z])/g, "$1 $2")
                    .replace(/^./, (c) => c.toUpperCase())}
                  : {v.available ? "Available" : (v.reason ?? "Unavailable")}
                </p>
              ))}
              <a
                className="source-note"
                href={current.data.provenance.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Source
              </a>
            </details>
          )}
        </>
      )}
    </>
  );
}
