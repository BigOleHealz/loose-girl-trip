"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import AccountPanel from './account-panel';
import { EMPTY_TRIP } from '@/lib/trip';

export default function JoinTrip({ code }: { code: string }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void createClient().auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); }); }, []);
  return <main className="join-page"><div className="join-card"><span className="eyebrow">THERE’S ROOM FOR YOU</span><h1>Come along.</h1><p>Sign in, then join your friend’s trip. You’ll both be able to edit the stops.</p>
    {!ready ? <p>Checking your sign-in…</p> : !user ? <AccountPanel user={null} owner={false} trip={EMPTY_TRIP} trips={[]} localTrip={null} activeId={null} busy={false} onSelect={async () => {}} onCreate={async () => false} next={`/join/${code}`} /> : <button className="primary-button" disabled={busy} onClick={async () => {
      setBusy(true); setMessage('');
      try {
        if (!/^[0-9a-f-]{36}$/i.test(code)) throw new Error();
        const result = await createClient().rpc('join_trip', { invite_code: code });
        if (result.error || typeof result.data !== 'string') throw new Error();
        try { localStorage.setItem('loose-girl-trip:active-cloud-trip', result.data); } catch { /* Optional selection only. */ }
        router.push('/');
      } catch { setMessage('This invite is invalid, expired, or could not connect. Ask your friend for a fresh link, or try again.'); setBusy(false); }
    }}>{busy ? 'Joining…' : 'Join this trip'} ↗</button>}
    {message && <p className="error" role="alert">{message}</p>}<Link href="/">Back to the map</Link>
  </div></main>;
}
