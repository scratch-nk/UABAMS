import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/images/marker-shadow.png',
});

const GeolocationMap = ({ impacts = [], center = [28.6130, 77.2102], zoom = 13 }) => {
  // Remove unused setMapCenter

  const getMarkerColor = (severity) => {
    switch(severity) {
      case 'HIGH': return '#ff4444';
      case 'MEDIUM': return '#ffbb33';
      case 'LOW': return '#00C851';
      default: return '#33b5e5';
    }
  };

  const getMarkerSize = (gValue) => {
    const baseSize = 8;
    const scale = Math.min(2, Math.max(1, (gValue || 5) / 10));
    return baseSize * scale;
  };

  const validImpacts = impacts.filter(i => i.latitude && i.longitude);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%', borderRadius: '4px' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      
      {validImpacts.map((impact) => (
        <CircleMarker
          key={impact.id}
          center={[impact.latitude, impact.longitude]}
          radius={getMarkerSize(impact.peak_g)}
          fillColor={getMarkerColor(impact.severity)}
          color="#000"
          weight={1}
          opacity={1}
          fillOpacity={0.8}
        >
          <Popup>
            <div style={{ minWidth: '200px' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>
                Impact Detected - {impact.severity}
              </h4>
              <p style={{ margin: '4px 0' }}>
                <strong>Peak:</strong> {impact.peak_g?.toFixed(3)} g
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>Time:</strong> {new Date(impact.timestamp).toLocaleString()}
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>Speed:</strong> {impact.speed?.toFixed(1)} km/h
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
};

export default GeolocationMap;
