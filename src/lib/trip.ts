import type { Stop, Trip } from "./types";

export const STORAGE_KEY = "loose-girl-trip:v1";
export const EMPTY_TRIP: Trip = {
  id: "my-road-trip", name: "The long way around", startDate: "", endDate: "",
  budgetTotal: 20000, travelers: 2, vehicleMpg: 28, coldThresholdF: 45,
  defaultNightlyRate: 90, stops: [],
};

export function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value + "T00:00:00Z"))
    && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
}

export function stayError(arrive: string, depart: string, trip: Pick<Trip, "startDate" | "endDate">): string | null {
  if (!validDate(arrive) || !validDate(depart)) return "Choose an arrival and departure date.";
  if (depart < arrive) return "Departure must be on or after arrival.";
  if (trip.startDate && arrive < trip.startDate) return "Arrival must be within your trip dates.";
  if (trip.endDate && depart > trip.endDate) return "Departure must be within your trip dates.";
  return null;
}

export function nights(stop: Pick<Stop, "arriveDate" | "departDate">): number {
  return Math.round((Date.parse(stop.departDate + "T00:00:00Z") - Date.parse(stop.arriveDate + "T00:00:00Z")) / 86400000);
}

export function sortStops(stops: Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.arriveDate.localeCompare(b.arriveDate) || a.departDate.localeCompare(b.departDate));
}

export function reorderStops(stops: Stop[], fromId: string, toId: string): Stop[] {
  const from = stops.findIndex(s => s.id === fromId);
  const to = stops.findIndex(s => s.id === toId);
  if (from < 0 || to < 0 || from === to) return stops;
  const result = [...stops];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}

export function parseTrip(raw: string): Trip {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Invalid trip");
  const t = value as Trip;
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const text = (s: unknown) => typeof s === "string";
  if (!text(t.id) || !text(t.name) || !(t.startDate === "" || validDate(t.startDate))
    || !(t.endDate === "" || validDate(t.endDate)) || (t.startDate && t.endDate && t.endDate < t.startDate)
    || !finite(t.budgetTotal) || t.budgetTotal < 0 || !Number.isInteger(t.travelers) || t.travelers < 1
    || !finite(t.vehicleMpg) || t.vehicleMpg <= 0 || !finite(t.coldThresholdF)
    || !finite(t.defaultNightlyRate) || t.defaultNightlyRate < 0 || !Array.isArray(t.stops)) throw new Error("Invalid trip settings");
  const ids = new Set<string>();
  for (const s of t.stops) {
    if (!s || !text(s.id) || ids.has(s.id) || !text(s.name) || !text(s.state)
      || !finite(s.lat) || Math.abs(s.lat) > 90 || !finite(s.lon) || Math.abs(s.lon) > 180
      || stayError(s.arriveDate, s.departDate, t)
      || (s.nightlyRate !== undefined && (!finite(s.nightlyRate) || s.nightlyRate < 0))) throw new Error("Invalid saved stop");
    ids.add(s.id);
  }
  return t;
}
