import type {
  GraphicDocument,
  GraphicMetric,
  GraphicRow,
  GraphicSubject,
} from "./graphics/schema";
export type Patch = { path: (string | number)[]; value: unknown };
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const record = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
function scopeIdentity(value: unknown) {
  const p = record(value);
  return p
    ? [p.provider, p.competition, p.season, p.scope, p.teamId ?? null]
    : null;
}
function identity(value: unknown): string | null {
  const v = record(value);
  if (!v) return null;
  if (typeof v.subjectId === "string")
    return JSON.stringify(["row", v.subjectId, scopeIdentity(v.provenance)]);
  if (typeof v.id === "string")
    return JSON.stringify(["subject", v.provider ?? null, v.id]);
  if (typeof v.key === "string")
    return JSON.stringify([
      "metric",
      v.key,
      v.rawUnit ?? v.unit ?? null,
      scopeIdentity(v.provenance),
    ]);
  return null;
}
function sameSequence(a: unknown[], b: unknown[]) {
  return (
    a.length === b.length &&
    a.every((v, i) => {
      const key = identity(v);
      return key !== null && key === identity(b[i]);
    })
  );
}
export function diffValues(
  source: unknown,
  current: unknown,
  path: (string | number)[] = [],
): Patch[] {
  if (equal(source, current)) return [];
  if (
    Array.isArray(source) &&
    Array.isArray(current) &&
    source.length === current.length
  ) {
    const scalarTuple = [...source, ...current].every(
      (v) => v === null || typeof v !== "object",
    );
    if (scalarTuple || sameSequence(source, current))
      return source.flatMap((v, i) => diffValues(v, current[i], [...path, i]));
  }
  const a = record(source),
    b = record(current);
  if (a && b)
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      diffValues(a[k], b[k], [...path, k]),
    );
  return [{ path, value: current }];
}
export function applyOverrides<T>(source: T, patches: Patch[]): T {
  const clone = structuredClone(source);
  for (const p of patches) {
    if (
      p.path.some(
        (key) =>
          key === "__proto__" || key === "constructor" || key === "prototype",
      )
    )
      continue;
    if (!p.path.length) return structuredClone(p.value) as T;
    let target = clone as Record<string | number, unknown>;
    for (const [index, key] of p.path.slice(0, -1).entries()) {
      if (
        !Object.hasOwn(target, key) ||
        !target[key] ||
        typeof target[key] !== "object"
      )
        target[key] = typeof p.path[index + 1] === "number" ? [] : {};
      target = target[key] as Record<string | number, unknown>;
    }
    const last = p.path.at(-1)!;
    if (p.value === undefined) delete target[last];
    else target[last] = structuredClone(p.value);
  }
  return clone;
}
const sourceFields = new Set([
  "provenance",
  "otherProvenance",
  "source",
  "rawValue",
  "rawUnit",
  "otherRawValue",
  "otherRawUnit",
  "key",
  "id",
  "subjectId",
  "provider",
  "sourceIds",
  "teamId",
]);
function mergeRecord<T>(original: T, edited: T, fresh: T): T {
  return applyOverrides(
    fresh,
    diffValues(original, edited).filter(
      (p) => !sourceFields.has(String(p.path[0])),
    ),
  );
}
function indexed<T>(items: T[]) {
  const map = new Map<string, T>();
  // Ambiguous duplicate identities are deliberately not reconciled.
  const repeated = new Set<string>();
  for (const item of items) {
    const key = identity(item);
    if (key) {
      if (map.has(key)) repeated.add(key);
      else map.set(key, item);
    }
  }
  for (const key of repeated) map.delete(key);
  return map;
}
function missingMetric(
  metric: GraphicMetric,
  retrievedAt?: string,
): GraphicMetric {
  return {
    ...structuredClone(metric),
    value: null,
    other: metric.other === undefined ? undefined : null,
    rawValue: null,
    otherRawValue: metric.otherRawValue === undefined ? undefined : null,
    provenance: metric.provenance
      ? {
          ...metric.provenance,
          ...(retrievedAt ? { retrievedAt } : {}),
          note: "Unavailable in refreshed source.",
        }
      : undefined,
  };
}
function mergeMetrics(
  original: GraphicMetric[],
  edited: GraphicMetric[],
  fresh: GraphicMetric[],
  retrievedAt?: string,
): GraphicMetric[] {
  const oldById = indexed(original),
    freshById = indexed(fresh);
  return edited.map((item) => {
    const key = identity(item),
      old = key ? oldById.get(key) : undefined;
    if (!old) return structuredClone(item); // A deliberately added editorial metric.
    const next = key ? freshById.get(key) : undefined;
    let base = next ? structuredClone(next) : missingMetric(old, retrievedAt);
    if (
      next &&
      old.otherProvenance &&
      (!next.otherProvenance ||
        !equal(
          scopeIdentity(old.otherProvenance),
          scopeIdentity(next.otherProvenance),
        ) ||
        old.otherRawUnit !== next.otherRawUnit)
    ) {
      base = {
        ...base,
        other: null,
        otherRawValue: null,
        otherRawUnit: old.otherRawUnit,
        otherProvenance: {
          ...old.otherProvenance,
          ...(retrievedAt ? { retrievedAt } : {}),
          note: "Unavailable in refreshed source.",
        },
      };
    }
    return mergeRecord(old, item, base);
  });
}
function missingRow(row: GraphicRow, retrievedAt?: string): GraphicRow {
  return {
    ...structuredClone(row),
    value: row.value === undefined ? undefined : null,
    other: row.other === undefined ? undefined : null,
    rank: null,
    columns: row.columns?.map(() => null),
    provenance: row.provenance
      ? {
          ...row.provenance,
          ...(retrievedAt ? { retrievedAt } : {}),
          note: "Unavailable in refreshed source.",
        }
      : undefined,
  };
}
function mergeRows(
  original: GraphicRow[],
  edited: GraphicRow[],
  fresh: GraphicRow[],
  selected: boolean,
  retrievedAt?: string,
): GraphicRow[] {
  if (equal(original, edited) && !selected) return structuredClone(fresh);
  const oldById = indexed(original),
    editById = indexed(edited),
    freshById = indexed(fresh);
  const preserveSelection = selected || !sameSequence(original, edited);
  const ordered = preserveSelection ? edited : fresh;
  return ordered.map((item) => {
    const key = identity(item),
      old = key ? oldById.get(key) : undefined,
      edit = key ? editById.get(key) : undefined;
    if (!old || !edit) return structuredClone(item);
    return mergeRecord(
      old,
      edit,
      freshById.get(key!) ?? missingRow(old, retrievedAt),
    );
  });
}
function mergeSubjects(
  original: GraphicSubject[],
  edited: GraphicSubject[],
  fresh: GraphicSubject[],
  retrievedAt?: string,
): GraphicSubject[] {
  const oldById = indexed(original),
    freshById = indexed(fresh);
  return edited.map((subject) => {
    const key = identity(subject),
      old = key ? oldById.get(key) : undefined,
      next = key ? freshById.get(key) : undefined;
    if (!old) return structuredClone(subject);
    const base = next ?? {
      ...structuredClone(old),
      facts: (old.facts ?? []).map((f) => missingMetric(f, retrievedAt)),
      provenance: old.provenance
        ? { ...old.provenance, note: "Unavailable in refreshed source." }
        : undefined,
    };
    const merged = applyOverrides(
      base,
      diffValues(old, subject).filter(
        (p) => p.path[0] !== "facts" && !sourceFields.has(String(p.path[0])),
      ),
    );
    merged.facts = mergeMetrics(
      old.facts ?? [],
      subject.facts ?? [],
      next?.facts ?? [],
      retrievedAt,
    );
    return merged;
  });
}
/** Refresh provider values without replacing selection or unrelated editorial corrections.
 * Entity names are display fields, never reconciliation keys. */
export function mergeGraphicRefresh(
  source: GraphicDocument,
  draft: GraphicDocument,
  fresh: GraphicDocument,
): GraphicDocument {
  const excluded = new Set(["metrics", "rows", "subjects"]);
  const result = applyOverrides(
    fresh,
    diffValues(source, draft).filter((p) => !excluded.has(String(p.path[0]))),
  );
  result.metrics = mergeMetrics(
    source.metrics,
    draft.metrics,
    fresh.metrics,
    fresh.source.retrievedAt,
  );
  result.rows = mergeRows(
    source.rows,
    draft.rows,
    fresh.rows,
    draft.templateId === "table-extract",
    fresh.source.retrievedAt,
  );
  result.subjects = mergeSubjects(
    source.subjects,
    draft.subjects,
    fresh.subjects,
    fresh.source.retrievedAt,
  );
  return result;
}
