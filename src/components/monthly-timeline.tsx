"use client";
import { useState } from 'react';
import { monthStays } from '@/lib/timeline';
import type { Trip } from '@/lib/types';
import { weatherTone, type WeatherData } from '@/lib/weather';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export default function MonthlyTimeline({ trip, weather, onSelect }: { trip: Trip; weather: Record<string, WeatherData>; onSelect: (id: string) => void }) {
  const baseDate = trip.startDate || trip.stops.map(s => s.arriveDate).sort()[0] || new Date().toISOString().slice(0, 10);
  const [offset, setOffset] = useState(0);
  const year = Math.max(1, Math.min(9999, Number(baseDate.slice(0, 4)) + offset));
  return <details className="timeline-panel"><summary>Monthly timeline <span aria-hidden="true">↗</span></summary><section aria-label="Monthly timeline">
    <div className="timeline-year"><button aria-label="Previous timeline year" disabled={year <= 1} onClick={() => setOffset(offset - 1)}>←</button><h2>{year}</h2><button aria-label="Next timeline year" disabled={year >= 9999} onClick={() => setOffset(offset + 1)}>→</button></div>
    <p className="hint">Monthly climate colors help you plan ahead. Forecast stops use their current stay estimate. Tap a stay to find it on the map.</p>
    <p className="timeline-legend"><span className="weather-dot cold" />Cold <span className="weather-dot borderline" />Borderline <span className="weather-dot warm" />Warm <span className="weather-dot unknown" />Pending</p>
    <ol className="timeline-months">{MONTHS.map((name, index) => {
      const stays = monthStays(trip.stops, year, index + 1);
      return <li key={name}><h3>{name}</h3>{!stays.length ? <p className="hint">Open road</p> : <ul>{stays.map(({ stop, firstDay, lastDay, nights }) => {
        const data = weather[stop.id];
        const estimate = data?.source === 'forecast' ? data : data?.months.find(m => m.month === index + 1);
        const tone = weatherTone(estimate, trip.coldThresholdF);
        return <li key={stop.id}><button className={`timeline-stay ${tone}`} onClick={() => onSelect(stop.id)}><strong>{stop.name}</strong><span>{firstDay === lastDay ? firstDay : `${firstDay}–${lastDay}`} {name.slice(0, 3)} · {nights ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : 'day visit'}</span><small>{estimate ? `${Math.round(estimate.avgLowF)}°F low · ${tone === 'cold' ? 'cold' : tone === 'borderline' ? 'borderline' : 'warm'}` : 'Weather pending'}</small></button></li>;
      })}</ul>}</li>;
    })}</ol>
  </section></details>;
}
