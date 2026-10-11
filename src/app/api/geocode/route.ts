import "server-only";
import { normalizePlaces } from "@/lib/geocode";

export const runtime = "nodejs";
export const maxDuration = 15;

function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) return fail("Search must be between 2 and 120 characters.", 400);
  const key = process.env.ORS_API_KEY;
  if (!key) return fail("Place search needs an OpenRouteService key. Set ORS_API_KEY on the server and restart or redeploy.", 503);
  const url = new URL("https://api.openrouteservice.org/geocode/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("text", query);
  url.searchParams.set("boundary.country", "USA");
  url.searchParams.set("size", "6");
  try {
    // Next's persistent fetch cache, never a process-local cache.
    const response = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (response.status === 429) return fail("Place search is busy. Wait a moment and try again.", 429);
    if (!response.ok) return fail("Place search is temporarily unavailable. Check the server's OpenRouteService key and quota.", 502);
    return Response.json({ places: normalizePlaces(await response.json()) });
  } catch {
    // Never return or log upstream URLs, response bodies, or keys.
    return fail("Place search could not connect. Please try again.", 502);
  }
}
