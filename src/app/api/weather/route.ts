import { NextRequest, NextResponse } from 'next/server';
import { validDate } from '@/lib/trip';
import { getWeather } from '@/lib/weather-server';
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const lat = Number(q.get('lat')), lon = Number(q.get('lon'));
  const arrive = q.get('arrive') || '', depart = q.get('depart') || '';
  if (!q.get('lat') || !q.get('lon') || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 || !validDate(arrive) || !validDate(depart) || depart < arrive || (Date.parse(depart) - Date.parse(arrive)) / 86400000 > 3660) return NextResponse.json({ error: 'Choose valid coordinates and a stay of up to ten years.' }, { status: 400 });
  try { return NextResponse.json(await getWeather(lat,lon,arrive,depart), { headers: { 'Cache-Control': 'public, max-age=300' } }); }
  catch { return NextResponse.json({ error: 'Weather could not load. Please retry shortly.' }, { status: 502 }); }
}
