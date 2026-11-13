"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Play,
  Square,
  Eye,
  RefreshCw,
  Snowflake,
  ExternalLink,
  Download,
  Upload,
  Check,
  LogOut,
  Keyboard,
  Clapperboard,
  Undo2,
  Archive,
} from "lucide-react";
import {
  GraphicStage,
  createGraphic,
  templates,
  templateRegistry,
  graphicSchema,
  type GraphicDocument,
} from "@/lib/graphics";
import { FootballBrowser, footballRequest } from "./FootballBrowser";
import { GraphicEditor } from "./GraphicEditor";
import {
  prepareSelection,
  subjectOf,
  comparisonMetrics,
  retargetGraphicScope,
  type Selection,
} from "@/lib/prepare";
import { preloadGraphic } from "@/lib/playout";
import { diffValues, mergeGraphicRefresh } from "@/lib/overrides";
import type { Episode, EpisodeItem, ProgramState } from "@/lib/server/models";
async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json", "x-tgiq-csrf": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => {
    throw Error("Server unavailable. Saved output remains on air.");
  });
  if (!r.ok) throw Error(d.error ?? "Request unavailable");
  return d;
}
const blankProgram: ProgramState = {
  version: 0,
  graphic: null,
  frozen: false,
  updatedAt: "",
};
function selectionScope(s: Selection): Record<string, unknown> {
  return {
    kind: s.kind,
    competition: s.data.provenance.competition,
    season: s.data.provenance.season,
    id:
      s.kind === "player"
        ? s.data.player.id
        : s.kind === "team"
          ? s.data.team.id
          : s.kind === "match"
            ? s.data.match.id
            : undefined,
    teamId: s.kind === "player" ? s.data.player.team?.id : undefined,
  };
}
function comparisonGraphic(a: Selection, b: Selection) {
  const g = prepareSelection(a, "comparison-player");
  g.subjects = [subjectOf(a)!, subjectOf(b)!];
  g.title = a.kind === "team" ? "Team comparison" : "Player comparison";
  g.subtitle = g.subjects
    .map((x) => [x.competition, x.season].filter(Boolean).join(" · "))
    .join(" / ");
  g.metrics = comparisonMetrics(
    a.kind === "player" || a.kind === "team" ? a.data.statistics : [],
    b.kind === "player" || b.kind === "team" ? b.data.statistics : [],
  );
  g.source.attribution = "ESPN";
  return g;
}
async function readScope(
  scope: Record<string, unknown>,
  refresh = false,
): Promise<Selection> {
  const data = await footballRequest({
    kind: String(scope.kind),
    competition: String(scope.competition),
    season: scope.season as number,
    id: scope.id as string | undefined,
    teamId: scope.teamId as string | undefined,
    refresh: refresh ? "1" : undefined,
  });
  return { kind: scope.kind, data } as Selection;
}
export function Producer() {
  const [session, setSession] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<GraphicDocument | null>(null);
  const [source, setSource] = useState<GraphicDocument | null>(null);
  const [preview, setPreview] = useState<GraphicDocument | null>(null);
  const [program, setProgram] = useState<ProgramState>(blankProgram);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [draftScope, setDraftScope] = useState<Record<string, unknown>>({});
  const [, setSelection] = useState<Selection | null>(null);
  const [comparisons, setComparisons] = useState<Selection[]>([]);
  const [outputUrl, setOutputUrl] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [undo, setUndo] = useState<EpisodeItem[] | null>(null);
  const [savedQuery, setSavedQuery] = useState("");
  const [archiveView, setArchiveView] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const programIntent = useRef(0);
  const latest = useRef({ draft, program });
  useEffect(() => {
    latest.current = { draft, program };
  }, [draft, program]);
  const loadEpisodes = useCallback(async () => {
    const d = await api<{ episodes: Episode[] }>("/api/episodes?archived=1");
    setEpisodes(d.episodes);
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    api<{ authenticated: boolean; configured: boolean }>("/api/session")
      .then((d) => {
        setSession(d.authenticated);
        setConfigured(d.configured);
      })
      .catch((e) => {
        setSession(false);
        setError(e.message);
      });
  }, []);
  useEffect(() => {
    if (!session) return;
    loadEpisodes().catch((e) => setError(e.message));
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const p = await api<ProgramState>("/api/program");
        if (active)
          setProgram((current) =>
            p.version > current.version || p.frozen !== current.frozen
              ? p
              : current,
          );
      } catch {
      } finally {
        if (active) timer = setTimeout(poll, 700);
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session, loadEpisodes]);
  const onSelect = useCallback((s: Selection) => setSelection(s), []);
  const report = (e: unknown) =>
    setError(e instanceof Error ? e.message : "Unavailable");
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/session", "POST", { password });
      setSession(true);
      setPassword("");
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  function prepare(
    s: Selection,
    templateId?: string,
    leaderCategory?: "totalGoals" | "goalAssists",
  ) {
    const g = prepareSelection(s, templateId, undefined, leaderCategory);
    setDraftScope({
      ...selectionScope(s),
      ...(leaderCategory ? { leaderCategory } : {}),
    });
    setDraft(g);
    setSource(structuredClone(g));
    setSelectedItem(null);
    setPreview(null);
    setNotice("Prepared for editing");
    setError("");
  }
  function compare(s: Selection) {
    if (!subjectOf(s)) {
      setError("Choose a player or team for comparison");
      return;
    }
    setComparisons((c) => {
      const n = c.length >= 2 ? [s] : [...c, s];
      if (n.length === 2) {
        const a = comparisonGraphic(n[0], n[1]);
        setDraftScope({ kind: "comparison", subjects: n.map(selectionScope) });
        setDraft(a);
        setSource(structuredClone(a));
        setSelectedItem(null);
        setPreview(null);
        setNotice("Comparison prepared · check each subject scope");
      } else setNotice("First subject selected · choose a second subject");
      return n;
    });
  }
  async function changeTemplate(id: string) {
    if (id === "ranking-players" && draftScope.kind === "league") {
      try {
        const current = await readScope(draftScope);
        const fresh = prepareSelection(
          current,
          id,
          undefined,
          draftScope.leaderCategory as "totalGoals" | "goalAssists" | undefined,
        );
        setDraft(fresh);
        setSource(structuredClone(fresh));
        return;
      } catch (e) {
        report(e);
        return;
      }
    }
    if (!draft) {
      const g = createGraphic(id);
      setDraft(g);
      setSource(structuredClone(g));
      return;
    }
    const g = createGraphic(id, {
      ...draft,
      templateId: id as GraphicDocument["templateId"],
      kicker: templateRegistry[id].label,
      fields: {
        ...Object.fromEntries(
          templateRegistry[id].fields.map((f) => [f, null]),
        ),
        ...draft.fields,
      },
      background:
        templateRegistry[id].orientation === "sidebar" ? "transparent" : "navy",
      page: 0,
    });
    setDraft(retargetGraphicScope(g, id));
    if (source) setSource(retargetGraphicScope(source, id));
  }
  async function previewDraft() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      graphicSchema.parse(draft);
      await preloadGraphic(draft);
      setPreview(structuredClone(draft));
      setNotice("Preview ready");
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  const mutateProgram = useCallback(
    async (
      action: "take" | "clear" | "freeze" | "unfreeze",
      g?: GraphicDocument,
    ) => {
      const intent = ++programIntent.current;
      const expectedVersion = latest.current.program.version;
      setBusy(true);
      setError("");
      try {
        if (action === "take") {
          if (!g) return;
          graphicSchema.parse(g);
          await preloadGraphic(g);
        }
        if (intent !== programIntent.current) return;
        const p = await api<ProgramState>("/api/program", "POST", {
          action,
          expectedVersion,
          ...(g ? { graphic: g } : {}),
        });
        setProgram((current) => (p.version > current.version ? p : current));
        if (intent !== programIntent.current) return;
        setNotice(
          action === "take"
            ? "On air"
            : action === "clear"
              ? "Output cleared"
              : p.frozen
                ? "Data frozen"
                : "Data unfrozen",
        );
      } catch (e) {
        report(e);
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.matches("input,textarea,select") ||
          e.target.isContentEditable)
      )
        return;
      if (!e.altKey) return;
      if (e.code === "Enter") {
        e.preventDefault();
        const g = latest.current.draft;
        if (g) mutateProgram("take", g);
      }
      if (e.code === "KeyP") {
        e.preventDefault();
        const g = latest.current.draft;
        if (g)
          preloadGraphic(g)
            .then(() => setPreview(structuredClone(g)))
            .catch(report);
      }
      if (e.code === "KeyC") {
        e.preventDefault();
        mutateProgram("clear");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mutateProgram]); // handlers read current draft and version through refs
  async function createEpisode() {
    setBusy(true);
    try {
      const d = await api<{ episode: Episode }>("/api/episodes", "POST", {
        name:
          newName.trim() ||
          `TGIQ · ${new Date().toLocaleDateString("en-GB", { timeZone: "Europe/London" })}`,
      });
      setEpisode(d.episode);
      setNewName("");
      setSelectedItem(null);
      await loadEpisodes();
      setNotice("Episode created");
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function openEpisode(id: string) {
    try {
      const d = await api<{ episode: Episode; missingMedia?: string[] }>(
        `/api/episodes/${id}`,
      );
      setEpisode(d.episode);
      setSelectedItem(null);
      if (d.missingMedia?.length)
        setError(`Missing media: ${d.missingMedia.join(", ")}`);
      else setNotice("Episode opened");
    } catch (e) {
      report(e);
    }
  }
  async function saveItems(
    items: EpisodeItem[],
    name?: string,
    archived?: boolean,
  ) {
    if (!episode) throw Error("Create or open an episode");
    const d = await api<{ episode: Episode }>(
      `/api/episodes/${episode.id}`,
      "PUT",
      {
        expectedVersion: episode.version,
        items,
        ...(name ? { name } : {}),
        ...(archived !== undefined ? { archived } : {}),
      },
    );
    setEpisode(d.episode);
    await loadEpisodes();
    return d.episode;
  }
  async function saveGraphic(update = false) {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      graphicSchema.parse(draft);
      if (!episode) throw Error("Create or open an episode first");
      const item: EpisodeItem = {
        id: update && selectedItem ? selectedItem : crypto.randomUUID(),
        title: draft.title || templateRegistry[draft.templateId].label,
        graphic: structuredClone(draft),
        subjectIds: draft.subjects.map((s) => s.id),
        sourceScope: draftScope,
        sourceSnapshot: { graphic: source ?? draft },
        overrides: { patches: diffValues(source ?? draft, draft) },
        mediaIds:
          JSON.stringify(draft)
            .match(/\/api\/assets\/([a-zA-Z0-9_-]+)/g)
            ?.map((s) => s.split("/").at(-1)!) ?? [],
      };
      const items =
        update && selectedItem
          ? episode.items.map((i) => (i.id === selectedItem ? item : i))
          : [...episode.items, item];
      await saveItems(items);
      setSelectedItem(item.id);
      setNotice(update ? "Saved item updated" : "Added to rundown");
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  function loadItem(item: EpisodeItem) {
    setDraft(structuredClone(item.graphic));
    setSource(
      graphicSchema.safeParse(item.sourceSnapshot.graphic).success
        ? graphicSchema.parse(item.sourceSnapshot.graphic)
        : structuredClone(item.graphic),
    );
    setSelectedItem(item.id);
    setDraftScope(item.sourceScope);
    setSelection(null);
    setNotice("Saved snapshot loaded");
  }
  async function refreshData() {
    setBusy(true);
    setError("");
    try {
      if (draft && draftScope.kind) {
        let fresh: GraphicDocument;
        if (draftScope.kind === "comparison") {
          const scopes = draftScope.subjects as Record<string, unknown>[];
          const subjects = await Promise.all(
            scopes.map((s) => readScope(s, true)),
          );
          fresh = comparisonGraphic(subjects[0], subjects[1]);
          fresh.templateId = draft.templateId;
        } else {
          const current = await readScope(draftScope, true);
          fresh = prepareSelection(
            current,
            draft.templateId,
            undefined,
            draftScope.leaderCategory as
              "totalGoals" | "goalAssists" | undefined,
          );
        }
        fresh.id = draft.id;
        setSource(fresh);
        setDraft(mergeGraphicRefresh(source ?? draft, draft, fresh));
        setPreview(null);
        setNotice("Source refreshed · editorial overrides retained");
      } else {
        setRefreshKey((k) => k + 1);
        setNotice("Browser source refreshing");
      }
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function outputAccess() {
    try {
      const d = await api<{ token: string; path: string }>(
        "/api/program/access",
        "POST",
        {},
      );
      const url = new URL(d.path, location.origin).href;
      setOutputUrl(url);
      await navigator.clipboard?.writeText(url).catch(() => {});
      setNotice("New output link copied · previous link revoked");
    } catch (e) {
      report(e);
    }
  }
  async function preflight() {
    if (!episode?.items.length) {
      setError("Add graphics to the episode first");
      return;
    }
    setBusy(true);
    setError("");
    const failed: string[] = [];
    for (const item of episode.items) {
      try {
        graphicSchema.parse(item.graphic);
        await preloadGraphic(item.graphic);
      } catch {
        failed.push(item.title);
      }
    }
    setBusy(false);
    if (failed.length) setError(`Preflight unavailable: ${failed.join(", ")}`);
    else
      setNotice(
        `Preflight ready · ${episode.items.length} graphics · images and fonts loaded`,
      );
  }
  async function duplicateEpisode() {
    if (!episode) return;
    try {
      const d = await api<{ episode: Episode }>(
        `/api/episodes/${episode.id}`,
        "POST",
        { action: "duplicate" },
      );
      setEpisode(d.episode);
      await loadEpisodes();
      setNotice("Episode duplicated");
    } catch (e) {
      report(e);
    }
  }
  async function archiveEpisode() {
    if (!episode) return;
    try {
      await saveItems(episode.items, undefined, !episode.archived);
      setNotice(episode.archived ? "Episode reopened" : "Episode archived");
    } catch (e) {
      report(e);
    }
  }
  async function importEpisode(file: File) {
    try {
      if (file.size > 4_000_000) throw Error("Episode file exceeds 4 MB");
      const data = JSON.parse(await file.text());
      const d = await api<{ episode: Episode; missingMedia?: string[] }>(
        "/api/episodes",
        "POST",
        { import: data },
      );
      setEpisode(d.episode);
      await loadEpisodes();
      setNotice("Episode imported");
      if (d.missingMedia?.length)
        setError(`Missing media: ${d.missingMedia.join(", ")}`);
    } catch (e) {
      report(e);
    }
  }
  function exportEpisode() {
    if (!episode) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(episode, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${episode.name.replace(/[^a-z0-9_-]/gi, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  if (session === null)
    return (
      <main className="login">
        <span className="wordmark">TGIQ</span>
        <p className="muted">Loading production</p>
      </main>
    );
  if (!session)
    return (
      <main className="login">
        <img className="brand-logo" src="/brand/tgiq-logo.png" alt="TGIQ" />
        <h1>Production sign-in</h1>
        {!configured ? (
          <div className="notice">
            Producer access is not configured. Complete the setup instructions
            to connect this workspace.
          </div>
        ) : (
          <form onSubmit={login}>
            <label>
              Producer password
              <input
                aria-label="Producer password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button
              className="primary"
              style={{ marginTop: 15, width: "100%" }}
              disabled={busy}
            >
              Sign in
            </button>
          </form>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  const patches = source && draft ? diffValues(source, draft) : [];
  return (
    <>
      <header className="topbar">
        <img className="brand-logo" src="/brand/tgiq-logo.png" alt="TGIQ" />
        <span className="divider" />
        <h1>Football production</h1>
        <div className="right">
          <span className="badge">
            {program.frozen ? "Data frozen" : "Connected"}
          </span>
          <button
            className="subtle"
            title="Alt+P Preview · Alt+Enter Take Live · Alt+C Clear"
            onClick={() =>
              setNotice(
                "Shortcuts: Alt+P Preview · Alt+Enter Take Live · Alt+C Clear. Disabled while typing.",
              )
            }
          >
            <Keyboard size={16} />
          </button>
          <button onClick={outputAccess}>
            <ExternalLink size={14} />
            Output link
          </button>
          <button
            className="subtle"
            title="Sign out"
            onClick={() =>
              api("/api/session", "DELETE")
                .then(() => setSession(false))
                .catch(report)
            }
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <div className="status-strip">
        <span>{episode?.name ?? "No episode selected"}</span>
        <span>·</span>
        <strong>
          {program.graphic
            ? `ON AIR · ${program.graphic.title || templateRegistry[program.graphic.templateId]?.label}`
            : "OUTPUT CLEAR"}
        </strong>
        <span style={{ marginLeft: "auto" }}>
          v{program.version}
          {program.frozen ? " · FROZEN" : ""}
        </span>
      </div>
      {error && (
        <div
          className="notice error"
          role="alert"
          style={{ margin: "10px 20px" }}
        >
          {error}
          <button
            className="subtle mini-btn"
            onClick={() => setError("")}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="status-strip">
          {notice}
        </div>
      )}
      <main className="workspace">
        <section className="column browser-column">
          <FootballBrowser
            onPrepare={prepare}
            onCompare={compare}
            onSelect={onSelect}
            refreshKey={refreshKey}
          />
          {comparisons.length > 0 && (
            <div className="panel">
              <div className="section-heading">
                <h3>Comparison selection</h3>
                <button className="mini-btn" onClick={() => setComparisons([])}>
                  ×
                </button>
              </div>
              {comparisons.map((s, i) => (
                <div className="comparison-slot" key={i}>
                  <span>
                    {subjectOf(s)?.name}
                    <small style={{ display: "block" }}>
                      {s.data.provenance.competition} ·{" "}
                      {s.data.provenance.season}
                    </small>
                  </span>
                  <b>{i === 0 ? "A" : "B"}</b>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="column prepared-column">
          <div>
            <div className="preview-head">
              <span>
                <Eye size={12} /> PREPARED
              </span>
              <span>
                {draft
                  ? templateRegistry[draft.templateId]?.label
                  : "No selection"}
              </span>
            </div>
            <div className="preview-wrap">
              <GraphicStage graphic={preview ?? draft} />
            </div>
          </div>
          <div className="transport">
            <button
              onClick={previewDraft}
              disabled={!draft || busy}
              title="Alt+P"
            >
              <Eye size={15} />
              Preview
            </button>
            <button
              className="live"
              onClick={() => draft && mutateProgram("take", draft)}
              disabled={!draft || busy}
              title="Alt+Enter"
            >
              <Play size={15} fill="currentColor" />
              Take Live
            </button>
            <button
              onClick={() => mutateProgram("clear")}
              disabled={busy}
              title="Alt+C"
            >
              <Square size={13} />
              Clear
            </button>
          </div>
          <div className="toolbar">
            <button
              className="subtle"
              onClick={refreshData}
              disabled={busy || program.frozen}
            >
              <RefreshCw size={14} />
              Refresh Data
            </button>
            <button
              className={program.frozen ? "active" : "subtle"}
              onClick={() =>
                mutateProgram(program.frozen ? "unfreeze" : "freeze")
              }
              disabled={busy}
            >
              <Snowflake size={14} />
              {program.frozen ? "Unfreeze Data" : "Freeze Data"}
            </button>
            <small>
              {patches.length
                ? `${patches.length} editorial changes`
                : draft
                  ? "Source values"
                  : ""}
            </small>
          </div>
          <div className="section-heading">
            <h2>Graphic editor</h2>
            {draft && (
              <button
                className="primary"
                disabled={busy || !episode}
                onClick={() => saveGraphic(Boolean(selectedItem))}
              >
                <Save size={13} />
                {selectedItem ? "Update saved" : "Add to rundown"}
              </button>
            )}
            <button
              className="subtle"
              onClick={() => {
                const g = createGraphic("profile-player");
                setDraft(g);
                setSource(structuredClone(g));
                setDraftScope({});
                setSelectedItem(null);
                setPreview(null);
              }}
            >
              <Plus size={13} />
              New
            </button>
          </div>
          {draft ? (
            <>
              <GraphicEditor
                graphic={draft}
                onChange={(g) => {
                  setDraft(g);
                  setPreview(null);
                }}
                onTemplate={(id) => {
                  changeTemplate(id);
                  setPreview(null);
                }}
                onRevert={() => {
                  if (source) {
                    setDraft(structuredClone(source));
                    setPreview(null);
                    setNotice("Source values restored");
                  }
                }}
              />
              <div className="toolbar">
                <button
                  className="primary"
                  disabled={busy || !episode}
                  onClick={() => saveGraphic(false)}
                >
                  <Plus size={14} />
                  Add to rundown
                </button>
                {selectedItem && (
                  <button disabled={busy} onClick={() => saveGraphic(true)}>
                    <Save size={14} />
                    Update saved
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="empty">
              Select football content or create a graphic.
              <div style={{ marginTop: 12 }}>
                <select
                  aria-label="New graphic template"
                  defaultValue=""
                  onChange={(e) => changeTemplate(e.target.value)}
                >
                  <option value="" disabled>
                    Choose template
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>
        <aside className="column rundown-column">
          <div>
            <div className="preview-head">
              <span className="live-dot">ON AIR</span>
              <span>{program.frozen ? "FROZEN" : `v${program.version}`}</span>
            </div>
            <div className="preview-wrap">
              <GraphicStage graphic={program.graphic} />
            </div>
            {outputUrl && (
              <a
                className="output-link"
                href={outputUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open broadcast output
              </a>
            )}
          </div>
          <div className="section-heading">
            <h2>
              <Clapperboard size={15} /> Episode
            </h2>
            <button
              className="subtle mini-btn"
              title="Show archived episodes"
              onClick={() => setArchiveView((v) => !v)}
            >
              <Archive size={14} />
            </button>
          </div>
          <label>
            Open episode
            <select
              aria-label="Open episode"
              value={episode?.id ?? ""}
              onChange={(e) => openEpisode(e.target.value)}
            >
              <option value="">Select episode</option>
              {episodes
                .filter((e) => archiveView || !e.archived)
                .map((e) => (
                  <option value={e.id} key={e.id}>
                    {e.name}
                    {e.archived ? " · Archived" : ""}
                  </option>
                ))}
            </select>
          </label>
          <div className="row">
            <input
              className="grow"
              aria-label="New episode name"
              placeholder="New episode name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              title="Create episode"
              onClick={createEpisode}
              disabled={busy}
            >
              <Plus size={16} />
            </button>
          </div>
          {episode && (
            <>
              <label>
                Episode title
                <input
                  aria-label="Episode title"
                  value={episode.name}
                  onChange={(e) =>
                    setEpisode({ ...episode, name: e.target.value })
                  }
                  onBlur={() =>
                    saveItems(episode.items, episode.name).catch(report)
                  }
                />
              </label>
              <div className="toolbar">
                <button className="subtle" onClick={duplicateEpisode}>
                  <Copy size={12} />
                  Duplicate
                </button>
                <button className="subtle" onClick={archiveEpisode}>
                  <Archive size={12} />
                  {episode.archived ? "Reopen" : "Archive"}
                </button>
              </div>
              <div className="row">
                <button className="grow" onClick={preflight} disabled={busy}>
                  <Check size={14} />
                  Preflight episode
                </button>
              </div>
              <div className="section-heading">
                <h3>Rundown · {episode.items.length}</h3>
                {undo && (
                  <button
                    className="subtle"
                    onClick={() =>
                      saveItems(undo)
                        .then(() => setUndo(null))
                        .catch(report)
                    }
                  >
                    <Undo2 size={12} />
                    Undo
                  </button>
                )}
              </div>
              <input
                aria-label="Search saved graphics"
                placeholder="Search saved graphics"
                value={savedQuery}
                onChange={(e) => setSavedQuery(e.target.value)}
              />
              <div className="rundown">
                {episode.items.map(
                  (item, i) =>
                    item.title
                      .toLowerCase()
                      .includes(savedQuery.toLowerCase()) && (
                      <div
                        className={`rundown-item ${selectedItem === item.id ? "selected" : ""}`}
                        key={item.id}
                      >
                        <span className="index">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <button
                          className="item-title"
                          onClick={() => {
                            loadItem(item);
                            setPreview(null);
                          }}
                        >
                          <span>{item.title || "Untitled"}</span>
                          <small>
                            {templateRegistry[item.graphic.templateId]?.label}
                          </small>
                        </button>
                        <div>
                          <button
                            className="mini-btn subtle"
                            title="Move up"
                            disabled={i === 0}
                            onClick={() => {
                              const items = [...episode.items];
                              [items[i - 1], items[i]] = [
                                items[i],
                                items[i - 1],
                              ];
                              saveItems(items).catch(report);
                            }}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            className="mini-btn subtle"
                            title="Move down"
                            disabled={i === episode.items.length - 1}
                            onClick={() => {
                              const items = [...episode.items];
                              [items[i + 1], items[i]] = [
                                items[i],
                                items[i + 1],
                              ];
                              saveItems(items).catch(report);
                            }}
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            className="mini-btn subtle"
                            title="Duplicate graphic"
                            onClick={() => {
                              const copy = structuredClone(item);
                              copy.id = crypto.randomUUID();
                              copy.title += " · Copy";
                              const items = [...episode.items];
                              items.splice(i + 1, 0, copy);
                              saveItems(items).catch(report);
                            }}
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            className="mini-btn subtle danger"
                            title="Remove graphic"
                            onClick={() => {
                              setUndo(episode.items);
                              saveItems(
                                episode.items.filter((s) => s.id !== item.id),
                              ).catch(report);
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ),
                )}
              </div>
              {!episode.items.length && (
                <div className="empty">No saved graphics</div>
              )}
            </>
          )}
          <div className="toolbar">
            <button onClick={exportEpisode} disabled={!episode}>
              <Download size={13} />
              Export
            </button>
            <button onClick={() => fileRef.current?.click()}>
              <Upload size={13} />
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="application/json,.json"
              onChange={(e) => {
                if (e.target.files?.[0]) importEpisode(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </div>
          <p className="source-note">
            Saved material remains stable until deliberately refreshed.
            Preflight loads images and fonts for this browser.
          </p>
        </aside>
      </main>
    </>
  );
}
