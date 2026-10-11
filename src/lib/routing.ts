import { along, booleanPointInPolygon, length, lineString } from '@turf/turf';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import statesData from '@/data/us-states.json';
import type { Leg } from './types';

const states = statesData as FeatureCollection<Polygon | MultiPolygon, { name: string }>;
export type RouteData = Omit<Leg, 'fromStopId' | 'toStopId' | 'gasCost'>;

export function coordinateKey(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  return [from.lon, from.lat, to.lon, to.lat].map(n => n.toFixed(6)).join(',');
}

export function stateMileage(coordinates: [number, number][], reportedMiles: number): Record<string, number> {
  if (reportedMiles === 0) return {};
  const line = lineString(coordinates);
  const measuredMiles = length(line, { units: 'miles' });
  if (measuredMiles <= 0) throw new Error('Invalid route geometry');
  const count = Math.max(1, Math.ceil(measuredMiles / 5));
  const totals: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    const sample = along(line, measuredMiles * (i + 0.5) / count, { units: 'miles' });
    const state = states.features.find(feature => booleanPointInPolygon(sample, feature))?.properties.name || 'Outside mapped states';
    totals[state] = (totals[state] || 0) + reportedMiles / count;
  }
  // Sample weights sum to ORS's reported distance, including unknown areas.
  return totals;
}

export function normalizeRoute(value: unknown): RouteData {
  const data = value as { features?: { geometry?: { type?: string; coordinates?: unknown }; properties?: { summary?: { distance?: number; duration?: number } } }[] };
  const feature = data?.features?.[0];
  const summary = feature?.properties?.summary;
  const coords = feature?.geometry?.coordinates;
  if (!summary || typeof summary.distance !== 'number' || !Number.isFinite(summary.distance) || summary.distance < 0
    || typeof summary.duration !== 'number' || !Number.isFinite(summary.duration) || summary.duration < 0
    || feature?.geometry?.type !== 'LineString' || !Array.isArray(coords) || coords.length < 2 || coords.length > 100000
    || coords.some(c => !Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90)) throw new Error('Invalid directions response');
  const polyline: [number, number][] = coords.map(c => [c[0], c[1]]);
  const miles = summary.distance / 1609.344;
  return { miles, durationHrs: summary.duration / 3600, polyline, milesByState: stateMileage(polyline, miles) };
}
