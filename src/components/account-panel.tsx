"use client";

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient, configured } from '@/lib/supabase/client';
import type { TripRow } from '@/lib/cloud-trip';
import type { Trip } from '@/lib/types';
import { travelerInviteUrl } from '@/lib/app-url';

export default function AccountPanel({ user, owner, trip, trips, localTrip, activeId, busy, onSelect, onCreate, next = '/' }: {
  user: User | null; owner: boolean; trip: Trip; trips: TripRow[]; localTrip: Trip | null; activeId: string | null; busy: boolean;
  onSelect: (id: string) => Promise<void>; onCreate: (upload: boolean) => Promise<boolean>; next?: string;
}) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [invite, setInvite] = useState<{ tripId: string; url: string } | null>(null);
  const [open, setOpen] = useState(false);
  return <section className="account-panel">
    <button className="section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><span>{user ? '☷ Shared trips' : '↗ Plan together'}</span><span>{open ? '−' : '+'}</span></button>
    {open && <div className="account-content">
      {!configured ? <p className="hint">Shared trips require the Supabase project connection.</p> : !user ? <div><p className="hint">Use your Google account to share your trip and see each other’s edits live.</p><button className="primary-button" disabled={pending} onClick={async () => {
        setPending(true); setMessage('');
        try {
          const callback = new URL('/auth/confirm', window.location.origin); callback.searchParams.set('next', next);
          const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.toString(), queryParams: { prompt: 'select_account' } } });
          if (error) { setMessage('Could not start Google sign-in. Please try again.'); setPending(false); }
        } catch { setMessage('Could not connect to Google sign-in. Please try again.'); setPending(false); }
      }}>{pending ? 'Opening Google…' : 'Continue with Google'}<span>↗</span></button></div> : <>
        <p className="hint">Signed in as {user.email}</p>
        {trips.length > 0 && <label>Open trip<select value={activeId || ''} disabled={busy} onChange={e => { setInvite(null); void onSelect(e.target.value); }}>{trips.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        {localTrip && <div className="migration-prompt"><strong>Your local trip is ready to come along.</strong><p className="hint">Upload “{localTrip.name}” with {localTrip.stops.length} stops to share it. The local copy is removed only after upload succeeds.</p><button className="primary-button" disabled={busy} onClick={() => { void onCreate(true); }}>Upload my local trip ↗</button></div>}
        <div className="account-actions"><button disabled={busy} onClick={() => { void onCreate(false); }}>New shared trip</button>{owner && activeId && <button disabled={busy || pending} onClick={async () => {
          setPending(true); setMessage('');
          try {
            const { data, error } = await createClient().from('invites').insert({ trip_id: trip.id }).select('code').single();
            if (error || !data) { setMessage('Could not create an invite. Please retry.'); return; }
            setInvite({ tripId: trip.id, url: travelerInviteUrl(data.code, window.location.origin) });
          } catch { setMessage('Could not connect. Please retry.'); }
          finally { setPending(false); }
        }}>Invite a traveler</button>}<button disabled={busy} onClick={async () => { const { error } = await createClient().auth.signOut(); if (error) setMessage('Could not sign out. Please retry.'); }}>Sign out</button></div>
        {invite && invite.tripId === trip.id && <div className="invite-result"><label>Invite link (expires in 7 days)<input readOnly value={invite.url} onFocus={e => e.target.select()} /></label><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(invite.url); setMessage('Invite link copied.'); } catch { setMessage('Select the link above and copy it.'); } }}>Copy link</button><p className="hint">Anyone with this link can join and edit your trip.</p></div>}
      </>}
      {message && <p className="hint" role="status">{message}</p>}
    </div>}
  </section>;
}
