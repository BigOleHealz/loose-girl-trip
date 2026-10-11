import { nights, parseTrip } from './trip';
import type { Trip } from './types';

export const MAX_TRIP_FILE_BYTES = 1024 * 1024;

/** Select only the plan's fields; never import account IDs, cached routes or credentials. */
export function tripForFile(trip: Trip): Trip {
  return {
    id: trip.id, name: trip.name, startDate: trip.startDate, endDate: trip.endDate,
    budgetTotal: trip.budgetTotal, travelers: trip.travelers, vehicleMpg: trip.vehicleMpg,
    coldThresholdF: trip.coldThresholdF, defaultNightlyRate: trip.defaultNightlyRate,
    stops: trip.stops.map(s => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, state: s.state,
      arriveDate: s.arriveDate, departDate: s.departDate,
      ...(s.nightlyRate === undefined ? {} : { nightlyRate: s.nightlyRate }),
    })),
  };
}

export function readTripFile(raw: string): Trip {
  if (new TextEncoder().encode(raw).length > MAX_TRIP_FILE_BYTES) throw new Error('Choose a JSON file smaller than 1 MB.');
  let trip: Trip;
  try { trip = parseTrip(raw); } catch { throw new Error('This JSON does not contain a valid trip. Check its settings, coordinates and stop dates.'); }
  if (!trip.name.trim() || trip.name.length > 160 || !trip.id || trip.id.length > 200
    || trip.travelers > 2147483647 || trip.stops.length > 200
    || trip.stops.some(s => !s.id || s.id.length > 200 || !s.name.trim() || s.name.length > 160 || s.state.length > 160 || nights(s) > 3660)) {
    throw new Error('Use a named trip with up to 200 stops, names under 160 characters and stays under 10 years.');
  }
  return tripForFile(trip);
}

export function downloadTrip(trip: Trip) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(tripForFile(trip), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `${trip.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'loose-girl-trip'}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
