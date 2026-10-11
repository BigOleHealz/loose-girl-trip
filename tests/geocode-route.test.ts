import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/geocode/route";

test("server geocoding protects credentials, validates input, caches and handles failures", async () => {
  const originalKey = process.env.ORS_API_KEY;
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.ORS_API_KEY;
    assert.equal((await GET(new Request("http://localhost/api/geocode?q=x"))).status, 400);
    assert.equal((await GET(new Request("http://localhost/api/geocode?q=Denver"))).status, 503);
    // A test-only placeholder, never a live credential or an external request.
    process.env.ORS_API_KEY = "test-only-placeholder";
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.origin, "https://api.openrouteservice.org");
      assert.equal(url.pathname, "/geocode/search");
      assert.equal(url.searchParams.get("boundary.country"), "USA");
      assert.equal(url.searchParams.get("text"), "Denver");
      assert.equal(Boolean(url.searchParams.get("api_key")), true);
      assert.equal((init as RequestInit & { next: { revalidate: number } }).next.revalidate, 86400);
      return Response.json({ features: [{ properties: { id: "Denver", name: "Denver", region_a: "CO" }, geometry: { coordinates: [-104.99, 39.74] } }] });
    };
    const success = await GET(new Request("http://localhost/api/geocode?q=Denver"));
    assert.equal(success.status, 200);
    const body = await success.json();
    assert.equal(body.places[0].lat, 39.74);
    assert.equal(JSON.stringify(body).includes(process.env.ORS_API_KEY), false);
    assert.equal(calls, 1);
    for (const status of [401, 429, 500]) {
      globalThis.fetch = async () => new Response("upstream response withheld", { status });
      const failure = await GET(new Request("http://localhost/api/geocode?q=Denver"));
      assert.equal(failure.status, status === 429 ? 429 : 502);
      assert.equal(failure.headers.get("cache-control"), "no-store");
      assert.equal((await failure.text()).includes("upstream response withheld"), false);
    }
    globalThis.fetch = async () => { throw new Error("upstream failure withheld"); };
    assert.equal((await GET(new Request("http://localhost/api/geocode?q=Denver"))).status, 502);
    globalThis.fetch = async () => Response.json({ unexpected: "format" });
    assert.equal((await GET(new Request("http://localhost/api/geocode?q=Denver"))).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ORS_API_KEY;
    else process.env.ORS_API_KEY = originalKey;
  }
});
