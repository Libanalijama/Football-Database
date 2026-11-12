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
