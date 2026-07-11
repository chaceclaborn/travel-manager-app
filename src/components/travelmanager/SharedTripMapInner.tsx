'use client';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

// Same brand-amber pin styling as TravelMap, single-destination variant.
const destinationIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:28px;height:28px;">
    <div style="position:absolute;inset:0;border-radius:9999px;background:#f59e0b;opacity:0.25;"></div>
    <div style="position:absolute;inset:5px;border-radius:9999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface SharedTripMapInnerProps {
  latitude: number;
  longitude: number;
  label: string;
}

export function SharedTripMapInner({ latitude, longitude, label }: SharedTripMapInnerProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={9}
      scrollWheelZoom={false}
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      zoomControl={false}
      attributionControl={true}
      className="h-full w-full"
      aria-label={`Map of ${label}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={destinationIcon} />
    </MapContainer>
  );
}
