import type { Stop, Trip } from './types';

export interface TripRow {
  id: string; owner_id: string; name: string; start_date: string | null; end_date: string | null;
  budget_total: number; travelers: number; vehicle_mpg: number; cold_threshold_f: number;
  default_nightly_rate: number; manual_order: boolean;
}
export interface StopRow {
  id: string; trip_id: string; name: string; lat: number; lon: number; state: string;
  arrive_date: string; depart_date: string; nightly_rate: number | null; weather: Stop['weather'] | null; position: number;
}
export function fromRows(row: TripRow, stops: StopRow[]): Trip {
  const result: Trip = {
    id: row.id, name: row.name, startDate: row.start_date || '', endDate: row.end_date || '',
    budgetTotal: row.budget_total, travelers: row.travelers, vehicleMpg: row.vehicle_mpg,
    coldThresholdF: row.cold_threshold_f, defaultNightlyRate: row.default_nightly_rate,
    stops: stops.map(s => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, state: s.state,
      arriveDate: s.arrive_date, departDate: s.depart_date, nightlyRate: s.nightly_rate ?? undefined, weather: s.weather ?? undefined })),
  };
  if (!row.manual_order) result.stops.sort((a, b) => a.arriveDate.localeCompare(b.arriveDate) || a.departDate.localeCompare(b.departDate));
  return result;
}
export function settingsRow(trip: Trip) {
  return { name: trip.name, start_date: trip.startDate || null, end_date: trip.endDate || null,
    budget_total: trip.budgetTotal, travelers: trip.travelers, vehicle_mpg: trip.vehicleMpg,
    cold_threshold_f: trip.coldThresholdF, default_nightly_rate: trip.defaultNightlyRate };
}
export function stopRow(stop: Stop, tripId: string, position: number) {
  return { id: stop.id, trip_id: tripId, name: stop.name, lat: stop.lat, lon: stop.lon, state: stop.state,
    arrive_date: stop.arriveDate, depart_date: stop.departDate, nightly_rate: stop.nightlyRate ?? null,
    weather: stop.weather ?? null, position };
}
