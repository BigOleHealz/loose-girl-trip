import { NextRequest, NextResponse } from 'next/server';
export async function GET(_request: NextRequest, context: { params: Promise<{ layer: string; z: string; x: string; y: string }> }) {
  const { layer, z, x, y } = await context.params;
  if (layer !== 'temp_new' || ![z,x,y].every(v => /^\d+$/.test(v)) || Number(z) > 10 || Number(x) >= 2 ** Number(z) || Number(y) >= 2 ** Number(z)) return new NextResponse(null,{ status: 400 });
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return new NextResponse(null,{ status: 503 });
  const url = new URL(`https://tile.openweathermap.org/map/temp_new/${z}/${x}/${y}.png`);
  url.searchParams.set('appid',key);
  try {
    const response = await fetch(url,{ next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) return new NextResponse(null,{ status: 502 });
    const body = await response.arrayBuffer();
    if (body.byteLength > 1048576) return new NextResponse(null,{ status: 502 });
    return new NextResponse(body,{ headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new NextResponse(null,{ status: 502 }); }
}
