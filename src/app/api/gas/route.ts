import { NextResponse } from 'next/server';
import { getGasPrices } from '@/lib/gas-server';
export async function GET() {
  try { return NextResponse.json(await getGasPrices(), { headers: { 'Cache-Control': 'public, max-age=300' } }); }
  catch { return NextResponse.json({ error: 'Gas prices could not load. Please retry shortly.' }, { status: 502 }); }
}
