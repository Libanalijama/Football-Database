export type Patch = { path: (string | number)[]; value: unknown };
export function diffValues(
  source: unknown,
  current: unknown,
  path: (string | number)[] = [],
): Patch[] {
  if (JSON.stringify(source) === JSON.stringify(current)) return [];
  if (
    source &&
    current &&
    typeof source === "object" &&
    typeof current === "object" &&
    !Array.isArray(source) &&
    !Array.isArray(current)
  ) {
    const a = source as Record<string, unknown>,
      b = current as Record<string, unknown>;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      diffValues(a[k], b[k], [...path, k]),
    );
  }
  return [{ path, value: current }];
}
export function applyOverrides<T>(source: T, patches: Patch[]): T {
  const clone = structuredClone(source);
  for (const p of patches) {
    if (!p.path.length) return structuredClone(p.value) as T;
    let target = clone as Record<string | number, unknown>;
    for (const key of p.path.slice(0, -1)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      target = target[key] as Record<string | number, unknown>;
    }
    const last = p.path.at(-1)!;
    if (p.value === undefined) delete target[last];
    else target[last] = structuredClone(p.value);
  }
  return clone;
}
