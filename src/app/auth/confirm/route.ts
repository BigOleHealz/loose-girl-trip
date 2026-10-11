import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get('token_hash');
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  // Permit only our invite route as a post-login destination.
  const destination = next && /^\/join\/[0-9a-f-]{36}$/i.test(next) ? next : '/';
  const supabase = await createClient();
  const result = hash ? await supabase.auth.verifyOtp({ token_hash: hash, type: 'email' })
    : code ? await supabase.auth.exchangeCodeForSession(code) : { error: true };
  // A relative Location keeps the callback on the browser's current origin,
  // even when a reverse proxy normalizes the internal hostname.
  const response = new NextResponse(null, { status: 303, headers: { Location: result.error ? '/auth/error' : destination } });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
