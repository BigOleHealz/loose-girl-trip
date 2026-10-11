import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_TRIP, nights, parseTrip, stayError, validDate } from "../src/lib/trip";
import { normalizePlaces } from "../src/lib/geocode";

test("dates reject impossible days and accept leap years; nights use UTC across DST", () => {
  assert.equal(validDate("2027-02-29"), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validDate("2026-04-31"), false);
  assert.equal(nights({ arriveDate: "2027-03-13", departDate: "2027-03-15" }), 2);
  assert.ok(stayError("2027-03-15", "2027-03-13", EMPTY_TRIP));
  assert.ok(stayError("2027-01-01", "2027-02-02", { startDate: "2027-01-02", endDate: "2027-03-01" }));
});

test("saved data rejects invalid coordinates, duplicate IDs and malformed settings", () => {
  const stop = { id: "one", name: "Denver", state: "CO", lat: 39.7, lon: -104.9, arriveDate: "2027-06-01", departDate: "2027-06-05" };
  assert.deepEqual(parseTrip(JSON.stringify({ ...EMPTY_TRIP, stops: [stop] })).stops, [stop]);
  assert.throws(() => parseTrip(JSON.stringify({ ...EMPTY_TRIP, stops: [stop, stop] })));
  assert.throws(() => parseTrip(JSON.stringify({ ...EMPTY_TRIP, stops: [{ ...stop, lat: 120 }] })));
  assert.throws(() => parseTrip(JSON.stringify({ ...EMPTY_TRIP, travelers: 0 })));
  assert.throws(() => parseTrip("null"));
});

test("ORS GeoJSON converts longitude/latitude correctly and rejects unusable results", () => {
  const places = normalizePlaces({ features: [
    { properties: { gid: "city:denver", name: "Denver", region_a: "CO", label: "Denver, CO, USA" }, geometry: { coordinates: [-104.99, 39.74] } },
    { properties: { name: "Invalid" }, geometry: { coordinates: [200, 100] } },
    null,
  ] });
  assert.deepEqual(places, [{ id: "city:denver", name: "Denver", label: "Denver, CO, USA", state: "CO", lon: -104.99, lat: 39.74 }]);
  assert.throws(() => normalizePlaces({}));
});
