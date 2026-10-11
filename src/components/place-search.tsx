"use client";

import { useEffect, useId, useState } from "react";
import type { Place } from "@/lib/types";

export default function PlaceSearch({ onSelect }: { onSelect: (place: Place) => void }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ query: string; places: Place[]; error?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const id = useId();
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPending(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted) setResult({ query, places: response.ok ? data.places : [], error: response.ok ? undefined : data.error });
      } catch {
        if (!controller.signal.aborted) setResult({ query, places: [], error: "Search could not connect. Please try again." });
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const current = result?.query === query ? result : null;
  return <div className="place-search">
    <label htmlFor={id}>Where to next?</label>
    <div className="search-input"><span aria-hidden="true">⌕</span><input id={id} type="search" placeholder="Search a city or place…" value={query} maxLength={120} autoComplete="off" onChange={e => { setQuery(e.target.value); setPending(false); }} /></div>
    <div aria-live="polite">
      {query.trim().length >= 2 && (!current || pending) && <p className="hint">Looking for your next stop…</p>}
      {current?.error && <p className="error" role="alert">{current.error}</p>}
      {current && !current.error && !pending && current.places.length === 0 && <p className="hint">No places found. Try a nearby city or a more specific name.</p>}
    </div>
    {current && !pending && current.places.length > 0 && <ul className="search-results" aria-label="Place results">{current.places.map(place => <li key={place.id}><button type="button" onClick={() => { onSelect(place); setQuery(""); setResult(null); }}><span aria-hidden="true">↗</span><span><strong>{place.name}</strong><small>{place.label}</small></span></button></li>)}</ul>}
    <p className="attribution">Place search by <a href="https://openrouteservice.org" target="_blank" rel="noreferrer">OpenRouteService</a></p>
  </div>;
}
