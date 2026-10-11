"use client";
import { useEffect, useState } from 'react';
import type { GasPrices } from './budget';
export function useGas(enabled: boolean) {
  const [attempt,setAttempt] = useState(0);
  const [prices,setPrices] = useState<GasPrices | null>(null);
  const [error,setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/gas',{signal:controller.signal});
        const data = await response.json();
        if (!response.ok) throw new Error('Gas prices could not load. Please retry.');
        if (!controller.signal.aborted) { setPrices(data); setError(''); }
      } catch { if (!controller.signal.aborted) setError('Gas prices could not load. Please retry.'); }
    }
    void load(); return () => controller.abort();
  },[enabled,attempt]);
  return { prices,error,retry:() => setAttempt(v => v + 1) };
}
