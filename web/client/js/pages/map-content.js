/* map-content.js — Leaflet map with event markers */

let map;
let markers = [];
let currentEvents = [];

const sampleMapEvents = [
    { id: 1, lat: 28.613040, lon: 77.210347, severity: 'high',   peak: 16.855, time: '2024-03-12 14:32:18', speed: 93.6 },
    { id: 2, lat: 28.613697, lon: 77.210048, severity: 'high',   peak: 19.768, time: '2024-03-12 14:30:15', speed: 96.8 },
    { id: 3, lat: 28.613351, lon: 77.210007, severity: 'medium', peak: 7.926,  time: '2024-03-12 14:25:42', speed: 94.9 },
    { id: 4, lat: 28.613030, lon: 77.210199, severity: 'medium', peak: 7.378,  time: '2024-03-12 14:20:33', speed: 93.4 },
    { id: 5, lat: 28.613567, lon: 77.209967, severity: 'low',    peak: 2.970,  time: '2024-03-12 14:15:21', speed: 95.1 }
];

function initMap() {
    if (typeof L === 'undefined') { console.error('Leaflet not loaded'); return; }

    map = L.map('mapid').setView([28.6139, 77.2090], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.polyline([
        [28.6140, 77.2080], [28.6139, 77.2090], [28.6137, 77.2100],
        [28.6135, 77.2110], [28.6133, 77.2120]
    ], { color: '#22c55e', weight: 3 }).addTo(map);

    currentEvents = [...sampleMapEvents];
    plotMarkers();
    updateRecentEvents();
}

function plotMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    const severityFilter = document.getElementById('eventTypeFilter').value;

    let filtered = currentEvents;
    if (severityFilter !== 'all') filtered = filtered.filter(e => e.severity === severityFilter);

    filtered.forEach(event => {
        const color = event.severity === 'high' ? '#ef4444'
                    : event.severity === 'medium' ? '#d97706' : '#22c55e';

        const marker = L.circleMarker([event.lat, event.lon], {
            radius: event.severity === 'high' ? 10 : event.severity === 'medium' ? 8 : 6,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        marker.bindPopup(`
            <strong>${event.severity.toUpperCase()} SEVERITY</strong><br>
            Peak: ${event.peak.toFixed(3)} g<br>
            Time: ${event.time}<br>
            Speed: ${event.speed.toFixed(1)} km/h<br>
            Location: ${event.lat.toFixed(6)}°, ${event.lon.toFixed(6)}°
        `);

        markers.push(marker);
    });
}

function filterMapMarkers() { plotMarkers(); }

function centerMap() { map.setView([28.6139, 77.2090], 14); }

function refreshMap() {
    plotMarkers();
}

function updateRecentEvents() {
    document.getElementById('recentEventsList').innerHTML = currentEvents.slice(0, 5).map(event => `
        <div class="recent-event-item ${event.severity}" onclick="flyToEvent(${event.lat}, ${event.lon})">
            <div class="event-time">${event.time}</div>
            <div class="event-peak">${event.peak.toFixed(3)} g - ${event.severity.toUpperCase()}</div>
        </div>
    `).join('');
}

function flyToEvent(lat, lon) { map.flyTo([lat, lon], 16); }

document.addEventListener('DOMContentLoaded', () => {
    if (typeof L !== 'undefined') {
        initMap();
    } else {
        const check = setInterval(() => {
            if (typeof L !== 'undefined') { clearInterval(check); initMap(); }
        }, 100);
    }
});

window.filterMapMarkers = filterMapMarkers;
window.centerMap = centerMap;
window.refreshMap = refreshMap;
window.flyToEvent = flyToEvent;
