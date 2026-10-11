import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinateKey, normalizeRoute, stateMileage } from '../src/lib/routing';

test('state mileage covers a Colorado–Kansas leg and preserves the reported total', () => {
  const result = stateMileage([[-104.99, 39.74], [-100.0, 39.1]], 300);
  assert.ok(result.Colorado > 0);
  assert.ok(result.Kansas > 0);
  assert.ok(Math.abs(Object.values(result).reduce((a,b) => a+b,0) - 300) < 0.00001);
  assert.equal(coordinateKey({ lon: -104.99, lat: 39.74 }, { lon: -100, lat: 39.1 }), '-104.990000,39.740000,-100.000000,39.100000');
});

test('ORS meters/seconds become miles/hours, with longitude-first polylines', () => {
  const route = normalizeRoute({ features: [{ geometry: { type: 'LineString', coordinates: [[-104.99,39.74],[-100,39.1]] }, properties: { summary: { distance: 160934.4, duration: 7200 } } }] });
  assert.equal(route.miles, 100);
  assert.equal(route.durationHrs, 2);
  assert.deepEqual(route.polyline[0], [-104.99,39.74]);
  assert.throws(() => normalizeRoute({ features: [] }));
  assert.throws(() => normalizeRoute({ features: [{ geometry: { type: 'LineString', coordinates: [[300,0],[0,0]] }, properties: { summary: { distance: 10, duration: 10 } } }] }));
});

test('unknown areas retain their miles rather than attributing them to a nearby state', () => {
  assert.deepEqual(stateMileage([[0,0],[1,1]], 10), { 'Outside mapped states': 10 });
  assert.deepEqual(stateMileage([[-104.99,39.74],[-104.99,39.74]], 0), {});
});
