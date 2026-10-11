"use client";
import { useEffect, useRef, useState } from 'react';
import type { Trip } from './types';
import type { WeatherData } from './weather';
export function useWeather(trip: Trip) {
  const [hour, setHour] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map<string,WeatherData>());
  const signature = JSON.stringify([trip.id, hour, trip.stops.map(s => [s.id,s.lat,s.lon,s.arriveDate,s.departDate]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))]);
  const [state,setState] = useState<{ signature: string; data: Record<string,WeatherData>; errors: Record<string,string> } | null>(null);
  useEffect(() => { const timer = setInterval(() => setHour(v => v + 1),3600000); return () => clearInterval(timer); },[]);
  useEffect(() => {
    const [, tick, stops] = JSON.parse(signature) as [string,number,[string,number,number,string,string][]];
    const controller = new AbortController();
    const data: Record<string,WeatherData> = {}, errors: Record<string,string> = {};
    const publish = () => { if (!controller.signal.aborted) setState({ signature,data: {...data},errors: {...errors} }); };
    let cursor = 0;
    async function worker() {
      while (cursor < stops.length && !controller.signal.aborted) {
        const [id,lat,lon,arrive,depart] = stops[cursor++];
        const key = JSON.stringify([tick,lat,lon,arrive,depart]);
        try {
          let value = cache.current.get(key);
          if (!value) {
            const response = await fetch(`/api/weather?${new URLSearchParams({lat:String(lat),lon:String(lon),arrive,depart})}`,{ signal:controller.signal });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'Weather could not load.');
            value = body as WeatherData;
            if (!controller.signal.aborted) { cache.current.set(key,value); if (cache.current.size > 100) cache.current.delete(cache.current.keys().next().value!); }
          }
          data[id] = value;
        } catch { if (!controller.signal.aborted) errors[id] = 'Weather could not load. Please retry.'; }
        publish();
      }
    }
    publish(); void Promise.all(Array.from({length:Math.min(3,stops.length)},worker));
    return () => controller.abort();
  },[signature,attempt]);
  const current = state?.signature === signature ? state : null;
  return { data:current?.data || {}, errors:current?.errors || {}, retry:() => setAttempt(v => v + 1) };
}
