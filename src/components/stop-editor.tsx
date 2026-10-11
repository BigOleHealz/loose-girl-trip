"use client";

import { useState } from "react";
import type { Stop, Trip } from "@/lib/types";
import { stayError } from "@/lib/trip";

export default function StopEditor({ stop, trip, isNew, onSave, onCancel }: { stop: Stop; trip: Trip; isNew: boolean; onSave: (stop: Stop) => Promise<boolean>; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return <form className="stop-editor" aria-label={isNew ? "Add stop dates" : "Edit stop"} onSubmit={async e => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const arriveDate = String(data.get("arriveDate"));
    const departDate = String(data.get("departDate"));
    const name = String(data.get("name")).trim();
    const rate = String(data.get("nightlyRate"));
    const invalid = stayError(arriveDate, departDate, trip);
    if (invalid || !name || (rate !== "" && (!Number.isFinite(Number(rate)) || Number(rate) < 0))) { setError(invalid || "Enter a name and a valid nightly rate."); return; }
    setPending(true);
    const saved = await onSave({ ...stop, name, arriveDate, departDate, nightlyRate: rate === "" ? undefined : Number(rate) });
    if (!saved) { setPending(false); setError('This stop could not save. Please retry.'); }
  }}>
    <div className="editor-heading"><span>{isNew ? "A NEW ADVENTURE" : "EDIT YOUR STOP"}</span><button type="button" className="icon-button" onClick={onCancel} aria-label="Cancel stop edit">×</button></div>
    <label>Stop name<input name="name" required maxLength={160} defaultValue={stop.name} /></label>
    <p className="hint">{stop.state} · {stop.lat.toFixed(3)}, {stop.lon.toFixed(3)}</p>
    <div className="field-grid"><label>Arrive<input name="arriveDate" type="date" required min={trip.startDate || undefined} max={trip.endDate || undefined} defaultValue={stop.arriveDate} /></label><label>Depart<input name="departDate" type="date" required min={trip.startDate || undefined} max={trip.endDate || undefined} defaultValue={stop.departDate} /></label></div>
    <label>Nightly rate override ($)<input name="nightlyRate" type="number" min="0" step="0.01" placeholder={`Trip default: $${trip.defaultNightlyRate}`} defaultValue={stop.nightlyRate} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Saving…' : isNew ? "Add to my trip" : "Save stop"}<span aria-hidden="true">↗</span></button>
  </form>;
}
