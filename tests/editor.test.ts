import { describe, it, expect } from "vitest";
import { diffValues, applyOverrides } from "@/lib/overrides";
import { createGraphic } from "@/lib/graphics/registry";
import { shouldApplyVersion } from "@/lib/playout";
describe("editor snapshots", () => {
  it("keeps source separate and applies only deliberate field corrections after refresh", () => {
    const source = createGraphic("profile-player", {
      title: "Source",
      fields: { Nationality: "England", Height: null },
    });
    const edit = structuredClone(source);
    edit.fields.Nationality = "Editorial correction";
    const patch = diffValues(source, edit);
    const refreshed = structuredClone(source);
    refreshed.fields.Height = "180 cm";
    const merged = applyOverrides(refreshed, patch);
    expect(merged.fields).toEqual({
      Nationality: "Editorial correction",
      Height: "180 cm",
    });
    expect(source.fields.Nationality).toBe("England");
  });
  it("preserves zero and null distinctly through a JSON portable override", () => {
    const source = { metric: null, other: 5 };
    const edited = { metric: 0, other: null };
    const patches = JSON.parse(JSON.stringify(diffValues(source, edited)));
    expect(applyOverrides(source, patches)).toEqual(edited);
  });
  it("rejects stale and duplicate output versions", () => {
    expect(shouldApplyVersion(4, 3)).toBe(false);
    expect(shouldApplyVersion(4, 4)).toBe(false);
    expect(shouldApplyVersion(4, 5)).toBe(true);
  });
});

describe("selective graphic refresh", () => {
  const provenance = {
    provider: "espn" as const,
    sourceUrl: "https://source.test/stats",
    retrievedAt: "2026-11-12T20:00:00Z",
    competition: "eng.1",
    season: 2026,
    scope: "competition-season" as const,
    teamId: "359",
  };
  const metric = (key: string, value: number) => ({
    key,
    label: key,
    value,
    unit: "",
    rawUnit: "count",
    rawValue: value,
    provenance,
  });
  it("keeps one edited metric while unrelated values, raw figures and provenance refresh", async () => {
    const { mergeGraphicRefresh } = await import("@/lib/overrides");
    const source = createGraphic("statistics-player", {
      metrics: [metric("goals", 1), metric("assists", 2)],
      subjects: [
        { id: "espn:player:1", name: "Same name", image: "old-image" },
      ],
    });
    const draft = structuredClone(source);
    draft.metrics[0].value = 0;
    draft.subjects[0].name = "Editorial name";
    const fresh = structuredClone(source);
    fresh.metrics = [metric("goals", 3), metric("assists", 4)].map((m) => ({
      ...m,
      provenance: { ...provenance, retrievedAt: "2026-11-13T01:00:00Z" },
    }));
    fresh.subjects[0].image = "new-image";
    const result = mergeGraphicRefresh(source, draft, fresh);
    expect(result.metrics.map((m) => m.value)).toEqual([0, 4]);
    expect(result.metrics.map((m) => m.rawValue)).toEqual([3, 4]);
    expect(result.metrics[0].provenance?.retrievedAt).toBe(
      "2026-11-13T01:00:00Z",
    );
    expect(result.subjects[0]).toMatchObject({
      id: "espn:player:1",
      name: "Editorial name",
      image: "new-image",
    });
    expect(source.metrics[0].value).toBe(1);
    expect(fresh.metrics[0].value).toBe(3);
    expect(
      diffValues(source, draft).some(
        (p) => JSON.stringify(p.path) === '["metrics",0,"value"]',
      ),
    ).toBe(true);
  });
  it("retains metric deletion/order, updates selected metrics and marks unavailable definitions null", async () => {
    const { mergeGraphicRefresh } = await import("@/lib/overrides");
    const source = createGraphic("statistics-player", {
      metrics: [metric("goals", 1), metric("assists", 2), metric("shots", 3)],
    });
    const draft = structuredClone(source);
    draft.metrics = [draft.metrics[2], draft.metrics[0]];
    const fresh = structuredClone(source);
    fresh.metrics = [
      metric("goals", 4),
      metric("assists", 5),
      { ...metric("shots", 7), rawUnit: "per 90", unit: "per 90" },
    ];
    const result = mergeGraphicRefresh(source, draft, fresh);
    expect(result.metrics.map((m) => m.key)).toEqual(["shots", "goals"]);
    expect(result.metrics.map((m) => m.value)).toEqual([null, 4]);
    expect(result.metrics[0].rawUnit).toBe("count");
    expect(result.metrics[0].provenance?.note).toContain("Unavailable");
    draft.metrics[0].value = 0;
    expect(mergeGraphicRefresh(source, draft, fresh).metrics[0].value).toBe(0);
  });
  it("refreshes selected rows by provider subject ID while full tables adopt new source ordering", async () => {
    const { mergeGraphicRefresh } = await import("@/lib/overrides");
    const row = (id: string, value: number, rank: number) => ({
      subjectId: `espn:team:${id}`,
      provenance,
      label: "Identical display name",
      value,
      rank,
      columns: [value, null],
    });
    const source = createGraphic("table-league", {
      rows: [row("1", 10, 1), row("2", 9, 2)],
    });
    const fresh = createGraphic("table-league", {
      rows: [row("2", 12, 1), row("1", 11, 2), row("3", 7, 3)],
    });
    const selected = structuredClone(source);
    selected.templateId = "table-extract";
    selected.rows = [selected.rows[0]];
    expect(mergeGraphicRefresh(source, selected, fresh).rows).toEqual([
      row("1", 11, 2),
    ]);
    expect(mergeGraphicRefresh(source, source, fresh).rows).toEqual(fresh.rows);
    const fullEdit = structuredClone(source);
    fullEdit.rows[0].label = "Editorial label";
    const full = mergeGraphicRefresh(source, fullEdit, fresh);
    expect(full.rows.map((r) => r.subjectId)).toEqual([
      "espn:team:2",
      "espn:team:1",
      "espn:team:3",
    ]);
    expect(full.rows[1]).toMatchObject({
      label: "Editorial label",
      value: 11,
      rank: 2,
    });
  });
});

it("refreshes the available comparison side without substituting a missing secondary scope", async () => {
  const { mergeGraphicRefresh } = await import("@/lib/overrides");
  const provenance = {
    provider: "espn" as const,
    sourceUrl: "https://source.test",
    retrievedAt: "2026-11-12T20:00:00Z",
    competition: "eng.1",
    season: 2026,
    scope: "competition-season" as const,
  };
  const source = createGraphic("comparison-player", {
    metrics: [
      {
        key: "goals",
        label: "Goals",
        value: 1,
        other: 2,
        rawUnit: "count",
        rawValue: 1,
        otherRawValue: 2,
        otherRawUnit: "count",
        provenance,
        otherProvenance: { ...provenance, competition: "esp.1" },
      },
    ],
  });
  const fresh = structuredClone(source);
  fresh.metrics[0] = {
    ...fresh.metrics[0],
    value: 3,
    rawValue: 3,
    other: null,
    otherRawValue: undefined,
    otherProvenance: undefined,
  };
  const result = mergeGraphicRefresh(source, source, fresh);
  expect(result.metrics[0].value).toBe(3);
  expect(result.metrics[0].other).toBeNull();
  expect(result.metrics[0].otherProvenance).toMatchObject({
    competition: "esp.1",
    note: "Unavailable in refreshed source.",
  });
  const protectedResult = applyOverrides({}, [
    { path: ["__proto__", "polluted"], value: true },
  ]);
  expect(protectedResult).toEqual({});
  expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
});
