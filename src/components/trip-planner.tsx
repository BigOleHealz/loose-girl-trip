"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Place, Stop, Trip } from "@/lib/types";
import { EMPTY_TRIP, STORAGE_KEY, nights, parseTrip, reorderStops, sortStops } from "@/lib/trip";
import PlaceSearch from "./place-search";
import StopEditor from "./stop-editor";
import TripSettings from "./trip-settings";

const TripMap = dynamic(() => import("./trip-map"), { ssr: false, loading: () => <div className="map-loading">Unfolding the map…</div> });
const ORDER_KEY = `${STORAGE_KEY}:manual-order`;

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default function TripPlanner() {
  const [trip, setTrip] = useState<Trip>(EMPTY_TRIP);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loading your trip…");
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [editor, setEditor] = useState<{ stop: Stop; isNew: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    // Hydrate browser-only storage after SSR; never overwrite an unread/invalid trip.
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setTrip(parseTrip(raw));
      setManual(localStorage.getItem(ORDER_KEY) === "true");
    } catch {
      setStorageBlocked(true);
      setSaveStatus("Saved trip could not be read. It has been left untouched.");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || storageBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
      localStorage.setItem(ORDER_KEY, String(manual));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaveStatus("Saved on this device");
    } catch {
      setSaveStatus("Could not save on this device. Your changes may be lost on refresh.");
    }
  }, [trip, manual, ready, storageBlocked]);

  function addPlace(place: Place) {
    const arriveDate = trip.stops.at(-1)?.departDate || trip.startDate;
    setEditor({ isNew: true, stop: { id: crypto.randomUUID(), name: place.name, lat: place.lat, lon: place.lon, state: place.state, arriveDate, departDate: arriveDate } });
  }
  function saveStop(stop: Stop) {
    setTrip(t => {
      const stops = editor?.isNew ? [...t.stops, stop] : t.stops.map(s => s.id === stop.id ? stop : s);
      return { ...t, stops: manual ? stops : sortStops(stops) };
    });
    setEditor(null); setSelected(stop.id); setAnnouncement(`${stop.name} saved.`);
  }
  function move(fromId: string, toId: string) {
    if (fromId === toId) return;
    setTrip(t => ({ ...t, stops: reorderStops(t.stops, fromId, toId) }));
    setManual(true); setAnnouncement("Stop order updated.");
  }
  return <main className="planner">
    <aside className="sidebar" aria-label="Trip planner">
      <header className="brand"><div className="brand-mark" aria-hidden="true">↗</div><span>LOOSE GIRL TRIP<span className="brand-sub">LESS ROUTINE. MORE ROAD.</span></span><span className="edition">01 / THE PLAN</span></header>
      <div className="sidebar-content">
        <div className="intro"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>Take the<br /><em>long way.</em></h1><p>A few places. A wide-open road.<br />Let’s see where this takes you.</p></div>
        {!ready ? <p className="hint">Loading your trip…</p> : <>
          <TripSettings trip={trip} onSave={setTrip} />
          <PlaceSearch onSelect={addPlace} />
          {editor && <StopEditor key={editor.stop.id} stop={editor.stop} trip={trip} isNew={editor.isNew} onSave={saveStop} onCancel={() => setEditor(null)} />}
          <section className="stops-section" aria-label="Your stops"><div className="stops-heading"><h2>Your stops <span>{String(trip.stops.length).padStart(2, "0")}</span></h2><button className="text-button" onClick={() => { setTrip(t => ({ ...t, stops: sortStops(t.stops) })); setManual(false); setAnnouncement("Stops sorted by date."); }} disabled={!trip.stops.length}>Sort by date ↓</button></div>
            <p className="hint order-hint">{manual ? "Your chosen order" : "In date order"} · drag the grip to rearrange</p>
            {!trip.stops.length && <div className="empty-stops"><span aria-hidden="true">✳</span><h3>Every trip starts somewhere.</h3><p>Search for your first stop above.<br />The rest is an open road.</p></div>}
            <ol className="stop-list">{trip.stops.map((stop, index) => <li key={stop.id} className={`stop-card ${selected === stop.id ? "selected" : ""}`} data-stop-id={stop.id} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = e.dataTransfer.getData("text/plain") || dragged; if (from) move(from, stop.id); setDragged(null); }}>
              <div className="stop-card-top"><button type="button" className="drag-handle" draggable onDragStart={e => { e.dataTransfer.setData("text/plain", stop.id); e.dataTransfer.effectAllowed = "move"; setDragged(stop.id); }} onDragEnd={() => setDragged(null)} aria-label={`Drag ${stop.name} to reorder`} title="Drag to reorder">⠿</button><span className="stop-number">{String(index + 1).padStart(2, "0")}</span><button className="stop-title" onClick={() => setSelected(stop.id)}><strong>{stop.name}</strong><small>{stop.state || "United States"}</small></button><span className="nights">{nights(stop)}<small>nights</small></span></div>
              <div className="stop-dates">{dateLabel(stop.arriveDate)}<span aria-hidden="true">→</span>{dateLabel(stop.departDate)}<small>{stop.arriveDate.slice(0, 4)}{stop.departDate.slice(0, 4) !== stop.arriveDate.slice(0, 4) ? `–${stop.departDate.slice(0, 4)}` : ""}</small></div>
              <div className="stop-actions"><button disabled={index === 0} aria-label={`Move ${stop.name} up`} onClick={() => move(stop.id, trip.stops[index - 1].id)}>↑</button><button disabled={index === trip.stops.length - 1} aria-label={`Move ${stop.name} down`} onClick={() => move(stop.id, trip.stops[index + 1].id)}>↓</button><span /><button onClick={() => { setEditor({ stop, isNew: false }); setSelected(stop.id); }}>Edit<span className="sr-only"> {stop.name}</span></button><button onClick={() => { setTrip(t => ({ ...t, stops: t.stops.filter(s => s.id !== stop.id) })); if (editor?.stop.id === stop.id) setEditor(null); if (selected === stop.id) setSelected(null); setAnnouncement(`${stop.name} deleted.`); }}>Delete<span className="sr-only"> {stop.name}</span></button></div>
            </li>)}</ol>
          </section>
        </>}
      </div>
      <footer className="sidebar-footer"><span className={saveStatus === "Saved on this device" ? "save-dot" : "save-dot warning"} /><span role="status">{saveStatus}</span>{storageBlocked && <button className="text-button" onClick={() => { if (window.confirm("Replace unreadable saved data with this trip?")) setStorageBlocked(false); }}>Replace saved trip</button>}</footer>
    </aside>
    <section className="map-panel" aria-label="Explore the map"><TripMap stops={trip.stops} selectedId={selected} onSelect={setSelected} /><div className="map-heading"><span className="eyebrow">A LITTLE ROOM TO WANDER</span><h2>{trip.name}</h2><p>{trip.stops.length ? `${trip.stops.length} stops · ${trip.stops.reduce((sum, stop) => sum + nights(stop), 0)} nights · ${trip.travelers} travelers` : "Your story starts with the first pin."}</p></div><div className="map-note"><span aria-hidden="true">✳</span><span>MAKE ROOM FOR THE DETOURS.</span></div></section>
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </main>;
}
