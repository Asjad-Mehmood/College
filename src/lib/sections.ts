/** Natural order for section names, so "CD2" comes before "CD10". */
export function compareSections(a: string, b: string) {
  // Spaces are ignored so "CD 54" sorts with "CD54", after "CD10".
  const strip = (x: string) => x.replace(/\s+/g, "");
  return strip(a).localeCompare(strip(b), "en", { numeric: true, sensitivity: "base" }) || a.localeCompare(b);
}

/** Groups rows by section, sections in natural order. */
export function groupBySection<T>(rows: T[], sectionOf: (row: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = sectionOf(r) || "—";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return [...map.entries()].sort(([a], [b]) => compareSections(a, b));
}
