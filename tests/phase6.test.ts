import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_TRIP } from '../src/lib/trip';
import { readTripFile, tripForFile } from '../src/lib/trip-file';
import { monthStays } from '../src/lib/timeline';

const stop = { id: 'stop', name: 'Denver', state: 'CO', lat: 39.74, lon: -104.99, arriveDate: '2027-01-30', departDate: '2027-02-02', nightlyRate: 0 };
test('JSON round trips preserve settings, zero rates and manual stop order, stripping unknown and stale derived data', () => {
  const source = { ...EMPTY_TRIP, stops: [stop, { ...stop, id: 'earlier', arriveDate: '2027-01-01', departDate: '2027-01-03' }], owner_id: 'never-import', apiKey: 'never-import' };
  const result = readTripFile(JSON.stringify({ ...source, stops: source.stops.map(s => ({ ...s, weather: { bad: 'cached' }, secret: 'never-import' })) }));
  assert.deepEqual(result, tripForFile(source));
  assert.equal(result.stops[0].nightlyRate, 0); assert.equal(result.stops[1].id, 'earlier');
  assert(!JSON.stringify(result).includes('never-import'));
  for (const bad of ['{}', '{', JSON.stringify({ ...source, stops: [{ ...stop, lat: 120 }] }), JSON.stringify({ ...source, stops: [stop, stop] }), JSON.stringify({ ...source, travelers: 0 }), JSON.stringify({ ...source, name: '' }), ' '.repeat(1024 * 1024 + 1)]) assert.throws(() => readTripFile(bad));
});
test('monthly timeline splits nights at month/year boundaries and includes day visits only once', () => {
  assert.deepEqual(monthStays([stop], 2027, 1).map(s => [s.firstDay, s.lastDay, s.nights]), [[30,31,2]]);
  assert.deepEqual(monthStays([stop], 2027, 2).map(s => [s.firstDay, s.lastDay, s.nights]), [[1,1,1]]);
  const day = { ...stop, arriveDate: '2027-02-01', departDate: '2027-02-01' };
  assert.equal(monthStays([day],2027,1).length,0); assert.equal(monthStays([day],2027,2)[0].nights,0);
  const boundary = { ...stop, arriveDate:'2026-12-31', departDate:'2027-01-01' };
  assert.equal(monthStays([boundary],2027,1).length,0); assert.equal(monthStays([boundary],2026,12)[0].nights,1);
  const leap = { ...stop, arriveDate:'2028-02-28', departDate:'2028-03-01' };
  assert.equal(monthStays([leap],2028,2)[0].nights,2);
});
