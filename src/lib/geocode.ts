import type { Place } from "./types";

export function normalizePlaces(data: unknown): Place[] {
  if (!data || typeof data !== "object" || !("features" in data) || !Array.isArray(data.features)) throw new Error("Invalid geocoder response");
  return data.features.flatMap((feature): Place[] => {
    const p = feature?.properties;
    const c = feature?.geometry?.coordinates;
    if (!p || !Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number"
      || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90
      || typeof p.name !== "string") return [];
    return [{ id: String(p.gid ?? p.id ?? `${c[0]},${c[1]}`), name: p.name,
      label: typeof p.label === "string" ? p.label : p.name, lon: c[0], lat: c[1],
      state: typeof p.region_a === "string" ? p.region_a : typeof p.region === "string" ? p.region : "" }];
  });
}
