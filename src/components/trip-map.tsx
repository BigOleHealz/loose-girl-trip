"use client";

import { useEffect, useState } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, Popup, Polyline, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { Leg, Stop } from "@/lib/types";
import { nights } from "@/lib/trip";
import { lodgingCost, money } from '@/lib/budget';
import { weatherTone } from '@/lib/weather';

function View({ stops, selected, sheet }: { stops: Stop[]; selected: Stop | undefined; sheet: 'collapsed' | 'half' | 'expanded' }) {
  const map = useMap();
  const coordinates = JSON.stringify(stops.map(s => [s.lat, s.lon]));
  const selectedLat = selected?.lat, selectedLon = selected?.lon, selectedId = selected?.id;
  useEffect(() => {
    function fit() {
      map.invalidateSize();
      const mobile = window.innerWidth <= 700;
      if (mobile && sheet === 'expanded') return;
      const inset = mobile ? (sheet === 'collapsed' ? 104 : window.innerHeight * .6) : 0;
      const points: [number, number][] = selectedLat !== undefined && selectedLon !== undefined ? [[selectedLat,selectedLon]] : JSON.parse(coordinates);
      if (points.length) map.fitBounds(latLngBounds(points), { paddingTopLeft: [30, 100], paddingBottomRight: [30, inset + 35], maxZoom: selectedId ? 7 : 9 });
    }
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [map, coordinates, sheet, selectedId, selectedLat, selectedLon]);
  return null;
}

export default function TripMap({ stops, legs, pricedLegs, coldThresholdF, defaultNightlyRate, selectedId, onSelect, sheet }: { stops: Stop[]; legs: Leg[]; pricedLegs: Leg[]; coldThresholdF: number; defaultNightlyRate: number; selectedId: string | null; onSelect: (id: string) => void; sheet: 'collapsed' | 'half' | 'expanded' }) {
  const [temperature,setTemperature] = useState(false);
  const [tileError,setTileError] = useState(false);
  return <MapContainer center={[38.5, -97.5]} zoom={4} zoomControl={false} className="trip-map" aria-label="Trip stops map">
    <TileLayer className="base-map-tiles" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {temperature && <TileLayer url="/api/tiles/temp_new/{z}/{x}/{y}" attribution='<a href="https://openweathermap.org/">OpenWeather</a>' opacity={0.65} maxNativeZoom={10} eventHandlers={{ tileerror: () => setTileError(true) }} />}
    <div className="weather-map-control" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
      <button className="weather-toggle" aria-pressed={temperature} onClick={() => {setTemperature(!temperature);setTileError(false);}}>Temperature overlay {temperature ? 'on' : 'off'}</button>
      {temperature && <><p className="hint">Current temperature · not your trip dates</p><div className="temperature-scale" /><div className="temperature-labels"><span>−40°F</span><span>32°F</span><span>86°F</span></div>{tileError && <p className="error" role="alert">Temperature tiles could not load. Toggle off and on to retry.</p>}</>}
      <p className="pin-legend"><span className="weather-dot cold" />Cold <span className="weather-dot borderline" />Borderline <span className="weather-dot warm" />Warm</p>
    </div>
    <ZoomControl position="topright" />
    <View stops={stops} selected={stops.find(s => s.id === selectedId)} sheet={sheet} />
    {legs.map(leg => <Polyline key={`${leg.fromStopId}:${leg.toStopId}`} positions={leg.polyline.map(([lon, lat]) => [lat, lon] as [number, number])} pathOptions={{ color: '#efa777', weight: 4, opacity: 0.8 }}><Popup>{Math.round(leg.miles)} miles · {leg.durationHrs.toFixed(1)} hours</Popup></Polyline>)}
    {stops.map((stop, index) => <Marker key={stop.id} title={stop.name} position={[stop.lat, stop.lon]} eventHandlers={{ click: () => onSelect(stop.id) }} icon={divIcon({ className: `stop-pin ${weatherTone(stop.weather,coldThresholdF)}`, html: `<span><b>${index + 1}</b></span>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -35] })}>
      <Popup><strong>{stop.name}</strong><br />{stop.state}<br />{stop.arriveDate} → {stop.departDate}<br />{nights(stop)} nights · Lodging {money(lodgingCost(stop,defaultNightlyRate))}<br />
        {stop.weather ? <>{stop.weather.source === 'climate' ? 'Climate averages' : 'Forecast'}: {Math.round(stop.weather.avgHighF)}° / {Math.round(stop.weather.avgLowF)}°F<br /></> : <>Weather pending<br /></>}
        Gas into this stop: {index === 0 ? money(0) : pricedLegs.find(l => l.toStopId === stop.id) ? money(pricedLegs.find(l => l.toStopId === stop.id)!.gasCost) : 'Pending'}
      </Popup>
    </Marker>)}
  </MapContainer>;
}
