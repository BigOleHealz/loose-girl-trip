import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { coordinateKey, normalizeRoute } from '@/lib/routing';

export const runtime = 'nodejs';
export const maxDuration = 30;
function result(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }); }

export async function POST(request: Request) {
  let body: { tripId?: string; fromStopId?: string; toStopId?: string };
  try { body = await request.json(); } catch { return result({ error: 'Invalid route request.' }, 400); }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body || ![body.tripId, body.fromStopId, body.toStopId].every(id => typeof id === 'string' && uuid.test(id)) || body.fromStopId === body.toStopId) return result({ error: 'Choose two different stops in a shared trip.' }, 400);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return result({ error: 'Shared trips are not configured.' }, 503);
  const supabase = await createClient();
  const { data: identity, error: authError } = await supabase.auth.getClaims();
  if (authError || !identity?.claims?.sub) return result({ error: 'Sign in to calculate your shared trip route.' }, 401);
  const stops = await supabase.from('stops').select('id,lat,lon').eq('trip_id', body.tripId!).in('id', [body.fromStopId!, body.toStopId!]);
  const from = stops.data?.find(s => s.id === body.fromStopId), to = stops.data?.find(s => s.id === body.toStopId);
  if (stops.error || !from || !to) return result({ error: 'These stops were not found in your trip.' }, 404);
  const key = coordinateKey(from, to);
  const claim = await supabase.rpc('claim_leg', { target: body.tripId, key });
  if (claim.error || !claim.data) return result({ error: 'The shared route cache could not connect. Please retry.' }, 502);
  if (claim.data.status === 'ready') return result({ leg: { ...claim.data.data, fromStopId: body.fromStopId, toStopId: body.toStopId, gasCost: 0 } });
  if (claim.data.status === 'pending') return result({ pending: true }, 202);
  const token = claim.data.token;
  try {
    if (!process.env.ORS_API_KEY) {
      await supabase.rpc('finish_leg', { target: body.tripId, key, token, result: null });
      return result({ error: 'Driving routes need ORS_API_KEY on the server.' }, 503);
    }
    let route;
    if (from.lat === to.lat && from.lon === to.lon) route = { miles: 0, durationHrs: 0, polyline: [[from.lon, from.lat], [to.lon, to.lat]], milesByState: {} };
    else {
      const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
        method: 'POST', headers: { Authorization: process.env.ORS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: [[from.lon, from.lat], [to.lon, to.lat]] }),
        next: { revalidate: 604800 }, signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        await supabase.rpc('finish_leg', { target: body.tripId, key, token, result: null });
        return result({ error: response.status === 429 ? 'Routing quota is busy. Wait a moment and retry.' : 'No driving route could be found. Check these places and your ORS key.' }, response.status === 429 ? 429 : 502);
      }
      route = normalizeRoute(await response.json());
    }
    const saved = await supabase.rpc('finish_leg', { target: body.tripId, key, token, result: route });
    if (saved.error || !saved.data) return result({ error: 'The route could not be saved to your shared trip. Please retry.' }, 502);
    return result({ leg: { ...route, fromStopId: body.fromStopId, toStopId: body.toStopId, gasCost: 0 } });
  } catch {
    await supabase.rpc('finish_leg', { target: body.tripId, key, token, result: null });
    return result({ error: 'Driving directions could not connect. Please try again.' }, 502);
  }
}
