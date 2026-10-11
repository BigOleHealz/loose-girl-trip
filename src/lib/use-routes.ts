"use client";

import { useEffect, useState } from 'react';
import type { Leg, Trip } from './types';

export function useRoutes(trip: Trip, cloudId: string | null) {
  // Names, dates, rates, weather and settings don't trigger routing requests.
  const signature = JSON.stringify([cloudId, trip.stops.map(s => [s.id, s.lon, s.lat])]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ signature: string; legs: Leg[]; error: string; loading: boolean } | null>(null);
  useEffect(() => {
    const [id, stops] = JSON.parse(signature) as [string | null, [string, number, number][]];
    if (!id || stops.length < 2) return;
    const controller = new AbortController();
    const legs: Leg[] = [];
    async function calculate() {
      setState({ signature, legs: [], error: '', loading: true });
      const errors: string[] = [];
      for (let i = 1; i < stops.length && !controller.signal.aborted; i++) {
        try {
          let leg: Leg | undefined;
          for (let retry = 0; retry < 30 && !controller.signal.aborted; retry++) {
            const response = await fetch('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId: id, fromStopId: stops[i - 1][0], toStopId: stops[i][0] }), signal: controller.signal });
            const data = await response.json();
            if (response.status === 202) {
              await new Promise<void>(resolve => {
                const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
                const timer = setTimeout(finish, 1000);
                controller.signal.addEventListener('abort', finish, { once: true });
              });
              continue;
            }
            if (!response.ok) throw new Error(data.error || 'Driving routes could not load.');
            leg = data.leg; break;
          }
          if (!controller.signal.aborted) {
            if (leg) legs.push(leg); else errors.push('A route is still being calculated on another device. Please retry shortly.');
          }
        } catch (e) {
          if (!controller.signal.aborted) errors.push(e instanceof Error ? e.message : 'Driving routes could not load.');
        }
        if (!controller.signal.aborted) setState({ signature, legs: [...legs], error: [...new Set(errors)].join(' '), loading: i < stops.length - 1 });
      }
    }
    void calculate();
    return () => controller.abort();
  }, [signature, attempt]);
  const current = state?.signature === signature ? state : null;
  return { legs: current?.legs || [], loading: current?.loading || false, error: current?.error || '', retry: () => setAttempt(n => n + 1) };
}
