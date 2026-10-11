"use client";
import type { Stop, Trip } from '@/lib/types';
import { monthLabel, stopWeather, warmerStay, weatherTone, type WeatherData } from '@/lib/weather';
export default function StopWeather({stop,trip,data,error,busy,onMove,onRetry}: {stop:Stop;trip:Trip;data?:WeatherData;error?:string;busy:boolean;onMove:(stop:Stop)=>void;onRetry:()=>void}) {
  if (error) return <div className="stop-weather"><p className="error" role="alert">{error} <button className="text-button" onClick={onRetry}>Retry weather</button></p></div>;
  if (!data) return <p className="hint weather-loading">Checking the weather…</p>;
  const weather = stopWeather(data,trip.coldThresholdF);
  const tone = weatherTone(weather,trip.coldThresholdF);
  const suggestion = weather.isCold ? warmerStay(stop,data.months,trip) : null;
  return <div className={`stop-weather ${tone}`}>
    <p className="weather-values"><span className={`weather-dot ${tone}`} />{Math.round(weather.avgHighF)}° / {Math.round(weather.avgLowF)}°F <strong>{tone === 'cold' ? 'Cold nights' : tone === 'borderline' ? 'Near your threshold' : 'Warm nights'}</strong></p>
    <p className="hint">{data.source === 'climate' ? 'Climate averages' : 'Live forecast'} · {data.coverage}{data.partial ? ' · Only part of this stay is in forecast range.' : ''}</p>
    {weather.isCold && <><p className="warmer-months">{weather.bestMonths?.length ? `Warmer in: ${monthLabel(weather.bestMonths)}` : 'No month meets your cold threshold here.'}</p>
      {suggestion ? <button className="text-button move-dates" disabled={busy} onClick={() => onMove({...stop,...suggestion,weather:undefined})}>Move dates to {suggestion.arriveDate} → {suggestion.departDate} ↗</button> : !!weather.bestMonths?.length && <p className="hint">No warmer stay fits your current trip dates in the next two years. Edit your dates to choose another window.</p>}
    </>}
  </div>;
}
