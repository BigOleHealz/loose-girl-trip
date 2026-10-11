"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient, configured } from './supabase/client';
import { fromRows, settingsRow, stopRow, type TripRow, type StopRow } from './cloud-trip';
import { EMPTY_TRIP, STORAGE_KEY, parseTrip, sortStops, reorderStops } from './trip';
import type { Stop, Trip } from './types';
import { readTripFile } from './trip-file';

const ORDER_KEY = `${STORAGE_KEY}:manual-order`;
const ACTIVE_KEY = 'loose-girl-trip:active-cloud-trip';

export function useTrip() {
  const supabase = useMemo(() => configured ? createClient() : null, []);
  const [trip, setTrip] = useState<Trip>(EMPTY_TRIP);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [owner, setOwner] = useState(false);
  const [manual, setManual] = useState(false);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [localTrip, setLocalTrip] = useState<Trip | null>(null);
  const [saveStatus, setSaveStatus] = useState('Loading your trip…');
  const [error, setError] = useState('');
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const fetchSequence = useRef(0);
  const userRef = useRef<User | null>(null);
  const mutationLock = useRef(false);

  const load = useCallback(async (id: string) => {
    if (!supabase) return;
    const sequence = ++fetchSequence.current;
    const [settings, stops] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('stops').select('*').eq('trip_id', id).order('position').order('id'),
    ]);
    if (sequence !== fetchSequence.current || activeRef.current !== id) return;
    if (settings.error || stops.error) { setError('Could not load this trip. Check your connection and membership.'); return; }
    const row = settings.data as TripRow;
    setTrip(fromRows(row, stops.data as StopRow[])); setManual(row.manual_order);
    setOwner(row.owner_id === userRef.current?.id);
    setSaveStatus('Saved to your shared trip');
  }, [supabase]);

  const selectTrip = useCallback(async (id: string) => {
    activeRef.current = id; setActiveId(id); setError('');
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* Trip data stays in Supabase. */ }
    await load(id);
  }, [load]);

  const refreshTrips = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.from('trips').select('*').order('updated_at', { ascending: false });
    if (result.error) throw new Error('Could not load your trips. Please check your connection.');
    const rows = result.data as TripRow[];
    setTrips(rows);
    return rows;
  }, [supabase]);

  useEffect(() => {
    let alive = true;
    async function initialize(nextUser: User | null) {
      if (!alive) return;
      fetchSequence.current++; userRef.current = nextUser; setUser(nextUser); setReady(false);
      let local: Trip | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) local = parseTrip(raw);
      } catch { setStorageBlocked(true); setSaveStatus('Saved trip could not be read. It has been left untouched.'); }
      if (nextUser && supabase) {
        setLocalTrip(local);
        try {
          const result = await supabase.from('trips').select('*').order('updated_at', { ascending: false });
          if (result.error) throw new Error();
          if (!alive || userRef.current?.id !== nextUser.id) return;
          const rows = result.data as TripRow[];
          setTrips(rows);
          let previous: string | null = null;
          try { previous = localStorage.getItem(ACTIVE_KEY); } catch { /* Optional selection metadata. */ }
          const id = rows.find(r => r.id === previous)?.id || rows[0]?.id;
          if (id) await selectTrip(id);
          else { activeRef.current = null; setActiveId(null); setTrip({ ...EMPTY_TRIP, stops: [] }); setSaveStatus('Create or upload a trip to start sharing'); }
        } catch { setError('Could not load your shared trips. Please try signing in again.'); }
      } else {
        activeRef.current = null; setActiveId(null); setTrips([]); setOwner(false); setLocalTrip(null);
        setTrip(local || { ...EMPTY_TRIP, stops: [] });
        try { setManual(localStorage.getItem(ORDER_KEY) === 'true'); } catch { /* Already surfaced above. */ }
      }
      if (alive) setReady(true);
    }
    if (!supabase) { void initialize(null); return () => { alive = false; }; }
    void supabase.auth.getUser().then(({ data }) => initialize(data.user));
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && userRef.current?.id !== session?.user.id)) {
        // Leave the auth callback before issuing any Supabase requests.
        queueMicrotask(() => { void initialize(session?.user || null); });
      }
    });
    return () => { alive = false; subscription.subscription.unsubscribe(); };
  }, [supabase, selectTrip]);

  useEffect(() => {
    if (!ready || user || storageBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
      localStorage.setItem(ORDER_KEY, String(manual));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaveStatus('Saved on this device');
    } catch { setSaveStatus('Could not save on this device. Your changes may be lost on refresh.'); }
  }, [trip, manual, ready, user, storageBlocked]);

  useEffect(() => {
    if (!supabase || !user || !activeId) return;
    const reload = () => { void load(activeId); };
    const channel = supabase.channel(`trip:${activeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${activeId}` }, reload)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stops', filter: `trip_id=eq.${activeId}` }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stops', filter: `trip_id=eq.${activeId}` }, reload)
      // DELETE events cannot be filtered by non-primary-key columns.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'stops' }, reload)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { reload(); setSaveStatus('Live · saved to your shared trip'); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setSaveStatus('Live connection interrupted. Reconnecting…');
      });
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    return () => { void supabase.removeChannel(channel); window.removeEventListener('focus', reload); window.removeEventListener('online', reload); };
  }, [supabase, user, activeId, load]);

  async function mutate(action: () => Promise<void>) {
    if (mutationLock.current) return false;
    mutationLock.current = true; setBusy(true); setError('');
    try { await action(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please retry.'); return false; }
    finally { mutationLock.current = false; setBusy(false); }
  }
  const requireTrip = () => { if (!supabase || !activeId) throw new Error('Create or upload a shared trip first.'); return { client: supabase, id: activeId }; };

  async function saveSettings(next: Trip) {
    return mutate(async () => {
      if (!user) { setTrip(next); return; }
      const { client, id } = requireTrip();
      const result = await client.from('trips').update(settingsRow(next)).eq('id', id).select('id').single();
      if (result.error) throw new Error('Could not save settings. Check your connection and trip dates.');
      await load(id); await refreshTrips();
    });
  }
  async function saveStop(stop: Stop, isNew: boolean) {
    return mutate(async () => {
      if (!user) { setTrip(t => { const stops = isNew ? [...t.stops, stop] : t.stops.map(s => s.id === stop.id ? stop : s); return { ...t, stops: manual ? stops : sortStops(stops) }; }); return; }
      const { client, id } = requireTrip();
      const row = stopRow(stop, id, trip.stops.length);
      // Editing a row leaves its position intact, avoiding accidental reorders.
      const { position: _position, id: _id, trip_id: _tripId, ...editable } = row;
      void _position; void _id; void _tripId;
      const result = isNew ? await client.from('stops').insert(row).select('id').single()
        : await client.from('stops').update(editable).eq('id', stop.id).eq('trip_id', id).select('id').single();
      if (result.error) throw new Error('Could not save this stop. Check your connection and dates; it may have been deleted on another device.');
      await load(id);
    });
  }
  async function deleteStop(id: string) {
    return mutate(async () => {
      if (!user) { setTrip(t => ({ ...t, stops: t.stops.filter(s => s.id !== id) })); return; }
      const { client, id: tripId } = requireTrip();
      const result = await client.from('stops').delete().eq('id', id).eq('trip_id', tripId);
      if (result.error) throw new Error('Could not delete this stop. Please retry.');
      await load(tripId);
    });
  }
  async function order(stops: Stop[], isManual: boolean) {
    return mutate(async () => {
      if (!user) { setTrip(t => ({ ...t, stops })); setManual(isManual); return; }
      const { client, id } = requireTrip();
      const result = await client.rpc('order_stops', { target: id, ordered_ids: stops.map(s => s.id), manual: isManual });
      if (result.error) throw new Error('Stops changed on another device or could not save. Please retry.');
      await load(id);
    });
  }
  async function createTrip(upload: boolean) {
    return mutate(async () => {
      if (!supabase || !user) throw new Error('Sign in first.');
      const source = upload && localTrip ? localTrip : { ...EMPTY_TRIP, stops: [] };
      let manualOrder = false;
      try { manualOrder = upload && localStorage.getItem(ORDER_KEY) === 'true'; } catch { /* Defaults to dates. */ }
      const result = await supabase.rpc('create_trip', { input: { ...source, manualOrder } });
      if (result.error || typeof result.data !== 'string') throw new Error('Could not create this trip. Please retry. Your local trip has been left untouched.');
      await refreshTrips(); await selectTrip(result.data);
      if (upload) {
        try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(ORDER_KEY); } catch { /* Never write shared trip data into browser storage. */ }
        setLocalTrip(null);
      }
    });
  }
  async function importTrip(input: Trip) {
    return mutate(async () => {
      const source = readTripFile(JSON.stringify(input));
      if (!user) {
        // Persist before replacing the visible trip so a storage failure leaves it intact.
        try { localStorage.setItem(ORDER_KEY, 'true'); localStorage.setItem(STORAGE_KEY, JSON.stringify(source)); }
        catch { throw new Error('Could not save the import on this device. Your current trip is still open.'); }
        setStorageBlocked(false); setTrip(source); setManual(true); return;
      }
      if (!supabase) throw new Error('Sign in first.');
      // The existing RPC is atomic and generates fresh trip/stop IDs.
      const result = await supabase.rpc('create_trip', { input: { ...source, manualOrder: true } });
      if (result.error || typeof result.data !== 'string') throw new Error('Could not import this trip. Your existing shared trips are unchanged.');
      await refreshTrips(); await selectTrip(result.data);
    });
  }
  return { trip, ready, user, owner, trips, localTrip, manual, saveStatus, error, busy, activeId, storageBlocked,
    selectTrip, saveSettings, saveStop, deleteStop, createTrip, importTrip,
    moveStop: (from: string, to: string) => order(reorderStops(trip.stops, from, to), true),
    sortByDate: () => order(sortStops(trip.stops), false),
    clearStorageBlock: () => setStorageBlocked(false), clearError: () => setError(''),
  };
}
