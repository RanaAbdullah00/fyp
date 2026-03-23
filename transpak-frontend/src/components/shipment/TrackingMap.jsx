import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Card from '../ui/Card.jsx';


const TrackingMap = ({ 
  origin = [31.5204, 74.3587], 
  destination = [24.8607, 67.0011], 
  route = [], 
  currentLocation, 
  trackingData 
}) => {
  const safeRoute = trackingData?.liveTrackingMap?.coordinates?.length > 1 
    ? trackingData.liveTrackingMap.coordinates 
    : route.length > 1 
      ? route 
      : [
          origin,
          [28, 75], // Multan
          [26, 72], // Sukkur
          destination
        ];

  const safeCurrentLocation = trackingData?.tracking?.currentLocation || currentLocation;

  return (
    <Card className="tp-map-card h-100">
      <h6 className="mb-2">Live tracking map</h6>
      <MapContainer 
        center={origin} 
        zoom={6} 
        style={{ height: '300px', borderRadius: '0.5rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={origin} />
        <Marker position={destination} />
        <Polyline positions={safeRoute} color="#16a34a" weight={4} />
        {safeCurrentLocation && <Marker position={safeCurrentLocation} />}
      </MapContainer>
    </Card>
  );
};

export default TrackingMap;

