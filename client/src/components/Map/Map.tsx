import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface Impact {
    id: number;
    latitude: number;
    longitude: number;
    severity: string;
    peak_g: number;
    speed: number;
    timestamp: string;
}

interface MapProps {
    impacts: Impact[];
}

const Map: React.FC<MapProps> = ({ impacts }) => {
    const getMarkerColor = (severity: string) => {
        switch(severity) {
            case 'HIGH': return '#ff4444';
            case 'MEDIUM': return '#ffbb33';
            case 'LOW': return '#00C851';
            default: return '#33b5e5';
        }
    };

    return (
        <MapContainer
            center={[28.6130, 77.2102]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            
            {impacts.map((impact) => (
                <CircleMarker
                    key={impact.id}
                    center={[impact.latitude, impact.longitude]}
                    radius={8}
                    fillColor={getMarkerColor(impact.severity)}
                    color="#000"
                    weight={1}
                    opacity={1}
                    fillOpacity={0.8}
                >
                    <Popup>
                        <strong>Severity: {impact.severity}</strong><br/>
                        Peak: {impact.peak_g.toFixed(3)}g<br/>
                        Speed: {impact.speed} km/h<br/>
                        Time: {new Date(impact.timestamp).toLocaleTimeString()}
                    </Popup>
                </CircleMarker>
            ))}
        </MapContainer>
    );
};

export default Map;
