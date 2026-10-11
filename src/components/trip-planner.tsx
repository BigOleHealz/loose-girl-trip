"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Place, Stop } from "@/lib/types";
import { nights } from "@/lib/trip";
import { useTrip } from "@/lib/use-trip";
import { useRoutes } from "@/lib/use-routes";
import PlaceSearch from "./place-search";
import StopEditor from "./stop-editor";
import TripSettings from "./trip-settings";
import AccountPanel from "./account-panel";

const TripMap = dynamic(() => import("./trip-map"), { ssr: false, loading: () => <div className="map-loading">Unfolding the map…</div> });

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default function TripPlanner() {
  const model = useTrip();
  const { trip, ready, manual, saveStatus, storageBlocked, busy } = model;
  const route = useRoutes(trip, model.user ? model.activeId : null);
  const [editor, setEditor] = useState<{ stop: Stop; isNew: boolean; tripId: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  function addPlace(place: Place) {
    const arriveDate = trip.stops.at(-1)?.departDate || trip.startDate;
    setEditor({ isNew: true, tripId: trip.id, stop: { id: crypto.randomUUID(), name: place.name, lat: place.lat, lon: place.lon, state: place.state, arriveDate, departDate: arriveDate } });
  }
  async function saveStop(stop: Stop) {
    const saved = await model.saveStop(stop, Boolean(editor?.isNew));
    if (saved) { setEditor(null); setSelected(stop.id); setAnnouncement(`${stop.name} saved.`); }
    return saved;
  }
  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    void model.moveStop(fromId, toId).then(saved => { if (saved) setAnnouncement("Stop order updated."); });
  }
  return <main className="planner">
    <aside className="sidebar" aria-label="Trip planner">
      <header className="brand"><div className="brand-mark" aria-hidden="true">↗</div><span>LOOSE GIRL TRIP<span className="brand-sub">LESS ROUTINE. MORE ROAD.</span></span><span className="edition">01 / THE PLAN</span></header>
      <div className="sidebar-content">
        <div className="intro"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>Take the<br /><em>long way.</em></h1><p>A few places. A wide-open road.<br />Let’s see where this takes you.</p></div>
        {!ready ? <p className="hint">Loading your trip…</p> : <>
          <AccountPanel user={model.user} owner={model.owner} trip={trip} trips={model.trips} localTrip={model.localTrip} activeId={model.activeId} busy={busy} onSelect={model.selectTrip} onCreate={model.createTrip} />
          {model.error && <p className="error" role="alert">{model.error}<button className="text-button" onClick={model.clearError}>Dismiss</button></p>}
          {model.user && !model.activeId ? <p className="hint">Open Shared trips above to create a trip or upload your local plan.</p> : <>
          <TripSettings key={trip.id} trip={trip} onSave={model.saveSettings} />
          <PlaceSearch onSelect={addPlace} />
          {editor && editor.tripId === trip.id && <StopEditor key={editor.stop.id} stop={editor.stop} trip={trip} isNew={editor.isNew} onSave={saveStop} onCancel={() => setEditor(null)} />}
          <section className="stops-section" aria-label="Your stops"><div className="stops-heading"><h2>Your stops <span>{String(trip.stops.length).padStart(2, "0")}</span></h2><button className="text-button" onClick={() => { void model.sortByDate().then(saved => { if (saved) setAnnouncement("Stops sorted by date."); }); }} disabled={!trip.stops.length || busy}>Sort by date ↓</button></div>
            <p className="hint order-hint">{manual ? "Your chosen order" : "In date order"} · drag the grip to rearrange</p>
            {!trip.stops.length && <div className="empty-stops"><span aria-hidden="true">✳</span><h3>Every trip starts somewhere.</h3><p>Search for your first stop above.<br />The rest is an open road.</p></div>}
            <ol className="stop-list">{trip.stops.map((stop, index) => <li key={stop.id} className={`stop-card ${selected === stop.id ? "selected" : ""}`} data-stop-id={stop.id} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain") || dragged; if (from) move(from, stop.id); setDragged(null); }}>
              <div className="stop-card-top"><button type="button" className="drag-handle" draggable onDragStart={e => { e.dataTransfer.setData("text/plain", stop.id); e.dataTransfer.effectAllowed = "move"; setDragged(stop.id); }} onDragEnd={() => setDragged(null)} aria-label={`Drag ${stop.name} to reorder`} title="Drag to reorder">⠿</button><span className="stop-number">{String(index + 1).padStart(2, "0")}</span><button className="stop-title" onClick={() => setSelected(stop.id)}><strong>{stop.name}</strong><small>{stop.state || "United States"}</small></button><span className="nights">{nights(stop)}<small>nights</small></span></div>
              <div className="stop-dates">{dateLabel(stop.arriveDate)}<span aria-hidden="true">→</span>{dateLabel(stop.departDate)}<small>{stop.arriveDate.slice(0, 4)}{stop.departDate.slice(0, 4) !== stop.arriveDate.slice(0, 4) ? `–${stop.departDate.slice(0, 4)}` : ""}</small></div>
              <div className="stop-actions"><button disabled={index === 0 || busy} aria-label={`Move ${stop.name} up`} onClick={() => move(stop.id, trip.stops[index - 1].id)}>↑</button><button disabled={index === trip.stops.length - 1 || busy} aria-label={`Move ${stop.name} down`} onClick={() => move(stop.id, trip.stops[index + 1].id)}>↓</button><span /><button disabled={busy} onClick={() => { setEditor({ stop, isNew: false, tripId: trip.id }); setSelected(stop.id); }}>Edit<span className="sr-only"> {stop.name}</span></button><button disabled={busy} onClick={() => { void model.deleteStop(stop.id).then(saved => { if (!saved) return; if (editor?.stop.id === stop.id) setEditor(null); if (selected === stop.id) setSelected(null); setAnnouncement(`${stop.name} deleted.`); }); }}>Delete<span className="sr-only"> {stop.name}</span></button></div>
            </li>)}</ol>
          </section>
          {trip.stops.length >= 2 && <section className="route-summary" aria-label="Driving route"><h2>The road between</h2>{!model.user ? <p className="hint">Sign in and upload this trip to calculate driving routes.</p> : <>
            <p className="route-total">{route.loading ? 'Finding the road…' : `${Math.round(route.legs.reduce((sum, leg) => sum + leg.miles, 0)).toLocaleString()} miles`}<small>{route.legs.length} of {trip.stops.length - 1} legs calculated</small></p>
            {route.error && <p className="error" role="alert">{route.error}<button className="text-button" onClick={route.retry}>Retry routes</button></p>}
            {route.legs.map(leg => <details key={`${leg.fromStopId}:${leg.toStopId}`}><summary>{trip.stops.find(s => s.id === leg.fromStopId)?.name} → {trip.stops.find(s => s.id === leg.toStopId)?.name}<small>{Math.round(leg.miles)} mi · {leg.durationHrs.toFixed(1)} hr</small></summary><ul>{Object.entries(leg.milesByState).map(([state, miles]) => <li key={state}><span>{state}</span><span>{miles.toFixed(1)} mi</span></li>)}</ul></details>)}
            <p className="hint">State mileage is estimated from roughly 5-mile samples. Border areas and water crossings can be approximate.</p>
          </>}</section>}
          </>}
        </>}
      </div>
      <footer className="sidebar-footer"><span className={saveStatus.includes('saved to your shared trip') || saveStatus === 'Saved to your shared trip' || saveStatus === "Saved on this device" ? "save-dot" : "save-dot warning"} /><span role="status">{saveStatus}</span>{storageBlocked && !model.user && <button className="text-button" onClick={() => { if (window.confirm("Replace unreadable saved data with this trip?")) model.clearStorageBlock(); }}>Replace saved trip</button>}</footer>
    </aside>
    <section className="map-panel" aria-label="Explore the map"><TripMap stops={trip.stops} legs={route.legs} selectedId={selected} onSelect={setSelected} /><div className="map-heading"><span className="eyebrow">A LITTLE ROOM TO WANDER</span><h2>{trip.name}</h2><p>{trip.stops.length ? `${trip.stops.length} stops · ${trip.stops.reduce((sum, stop) => sum + nights(stop), 0)} nights · ${trip.travelers} travelers` : "Your story starts with the first pin."}</p></div><div className="map-note"><span aria-hidden="true">✳</span><span>MAKE ROOM FOR THE DETOURS.</span></div></section>
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </main>;
}
