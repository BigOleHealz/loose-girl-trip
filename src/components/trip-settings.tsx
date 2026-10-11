"use client";

import { useState } from "react";
import type { Trip } from "@/lib/types";
import { stayError, validDate } from "@/lib/trip";

export default function TripSettings({ trip, onSave }: { trip: Trip; onSave: (trip: Trip) => Promise<boolean> }) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return <section className="settings">
    <button className="section-toggle" aria-expanded={open} aria-controls="trip-settings" onClick={() => setOpen(!open)}><span><span aria-hidden="true">☷</span> Trip settings</span><span aria-hidden="true">{open ? "−" : "+"}</span></button>
    {open && <form id="trip-settings" onSubmit={async e => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      const value = (key: string) => String(data.get(key));
      const startDate = value("startDate"), endDate = value("endDate");
      const next: Trip = { ...trip, name: value("name").trim(), startDate, endDate, budgetTotal: Number(value("budgetTotal")), vehicleMpg: Number(value("vehicleMpg")), travelers: Number(value("travelers")), coldThresholdF: Number(value("coldThresholdF")), defaultNightlyRate: Number(value("defaultNightlyRate")) };
      if ((startDate && !validDate(startDate)) || (endDate && !validDate(endDate)) || (startDate && endDate && endDate < startDate)) { setError("Trip end must be on or after its start."); return; }
      if (next.stops.some(s => stayError(s.arriveDate, s.departDate, next))) { setError("These trip dates exclude an existing stop. Adjust the stop dates first."); return; }
      if (!next.name || ![next.budgetTotal, next.vehicleMpg, next.travelers, next.coldThresholdF, next.defaultNightlyRate].every(Number.isFinite) || next.budgetTotal < 0 || next.vehicleMpg <= 0 || !Number.isInteger(next.travelers) || next.travelers < 1 || next.defaultNightlyRate < 0) { setError("Please enter valid trip settings."); return; }
      setPending(true);
      const saved = await onSave(next);
      setPending(false);
      if (saved) { setError(null); setOpen(false); } else setError('Settings could not save. Please retry.');
    }}>
      <label>Trip name<input name="name" required maxLength={160} defaultValue={trip.name} /></label>
      <div className="field-grid"><label>Start date<input name="startDate" type="date" defaultValue={trip.startDate} /></label><label>End date<input name="endDate" type="date" defaultValue={trip.endDate} /></label>
      <label>Budget ($)<input name="budgetTotal" type="number" required min="0" step="0.01" defaultValue={trip.budgetTotal} /></label><label>Travelers<input name="travelers" type="number" required min="1" step="1" defaultValue={trip.travelers} /></label>
      <label>Vehicle MPG<input name="vehicleMpg" type="number" required min="0.1" step="0.1" defaultValue={trip.vehicleMpg} /></label><label>Cold threshold (°F)<input name="coldThresholdF" type="number" required step="0.1" defaultValue={trip.coldThresholdF} /></label></div>
      <label>Default nightly rate ($)<input name="defaultNightlyRate" type="number" required min="0" step="0.01" defaultValue={trip.defaultNightlyRate} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary-button" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}<span aria-hidden="true">↗</span></button>
    </form>}
  </section>;
}
