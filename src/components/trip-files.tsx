"use client";
import { useRef, useState } from 'react';
import { downloadTrip, MAX_TRIP_FILE_BYTES, readTripFile } from '@/lib/trip-file';
import type { Trip } from '@/lib/types';

export default function TripFiles({ trip, signedIn, busy, onImport }: { trip: Trip; signedIn: boolean; busy: boolean; onImport: (trip: Trip) => Promise<boolean> }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Trip | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const fileSequence = useRef(0);
  async function chooseFile(file?: File) {
    if (!file) return;
    const sequence = ++fileSequence.current;
    setError(''); setMessage(''); setPending(null); setReading(true);
    try {
      if (file.size > MAX_TRIP_FILE_BYTES) throw new Error('Choose a JSON file smaller than 1 MB.');
      const parsed = readTripFile(await file.text());
      if (sequence === fileSequence.current) setPending(parsed);
    } catch (e) { if (sequence === fileSequence.current) setError(e instanceof Error ? e.message : 'Could not read this file.'); }
    finally { if (sequence === fileSequence.current) setReading(false); }
  }
  async function confirm() {
    if (pending && await onImport(pending)) { setPending(null); setMessage(signedIn ? 'Imported as a new shared trip.' : 'Imported and saved on this device.'); }
  }
  return <section className="trip-files" aria-label="Trip files">
    <div className="file-actions"><button className="text-button" disabled={busy} onClick={() => { downloadTrip(trip); setMessage('Trip JSON downloaded.'); }}>Export trip JSON ↗</button>
      <button className="text-button" disabled={busy || reading} onClick={() => input.current?.click()}>{reading ? 'Reading file…' : 'Import trip JSON ↙'}</button></div>
    <input className="sr-only" ref={input} type="file" accept=".json,application/json" aria-label="Import trip JSON file" disabled={busy || reading} onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
    {pending && <div className="import-preview" role="region" aria-label="Import preview"><strong>{pending.name}</strong><p>{pending.stops.length} stops · {pending.travelers} travelers</p>
      <p>{signedIn ? 'This creates a new shared trip. Your existing trips stay available.' : 'This replaces your trip on this device. Download your current plan first if you want to keep it.'}</p>
      {!signedIn && <button className="text-button" disabled={busy} onClick={() => downloadTrip(trip)}>Download current trip</button>}
      <div className="file-actions"><button className="primary-button" disabled={busy} onClick={() => void confirm()}>{signedIn ? 'Import as new shared trip' : 'Replace local trip'}</button><button className="text-button" disabled={busy} onClick={() => setPending(null)}>Cancel import</button></div>
    </div>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="hint" role="status">{message}</p>}
  </section>;
}
