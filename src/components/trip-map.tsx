"use client";

import { useEffect } from "react";
import { divIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import type { Stop } from "@/lib/types";
import { nights } from "@/lib/trip";

function View({ stops, selected }: { stops: Stop[]; selected: Stop | undefined }) {
  const map = useMap();
  const coordinates = JSON.stringify(stops.map(s => [s.lat, s.lon]));
  useEffect(() => {
    const points: [number, number][] = JSON.parse(coordinates);
    if (points.length) map.fitBounds(latLngBounds(points), { padding: [60, 60], maxZoom: 9 });
  }, [map, coordinates]);
  useEffect(() => {
    if (selected) map.flyTo([selected.lat, selected.lon], Math.max(map.getZoom(), 7));
  }, [map, selected]);
  return null;
}

export default function TripMap({ stops, selectedId, onSelect }: { stops: Stop[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <MapContainer center={[38.5, -97.5]} zoom={4} zoomControl={false} className="trip-map" aria-label="Trip stops map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <ZoomControl position="bottomright" />
    <View stops={stops} selected={stops.find(s => s.id === selectedId)} />
    {stops.map((stop, index) => <Marker key={stop.id} title={stop.name} position={[stop.lat, stop.lon]} eventHandlers={{ click: () => onSelect(stop.id) }} icon={divIcon({ className: "stop-pin", html: `<span><b>${index + 1}</b></span>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -35] })}>
      <Popup><strong>{stop.name}</strong><br />{stop.state}<br />{stop.arriveDate} → {stop.departDate}<br />{nights(stop)} nights</Popup>
    </Marker>)}
  </MapContainer>;
}
