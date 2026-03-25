/* events.js — Impact Events list with severity filter */

const API = window.location.origin;

// Read date-range params (set by index.js when in historical mode)
const _p        = new URLSearchParams(location.search);
const _histFrom = _p.get('from');
const _histTo   = _p.get('to');

let allImpacts = [];

async function loadImpacts() {
    try {
        const url = new URL(`${API}/api/impacts`);
        if (_histFrom) url.searchParams.set('from', _histFrom);
        if (_histTo)   url.searchParams.set('to',   _histTo);
        const res  = await fetch(url);
        allImpacts = await res.json();
    } catch (e) {
        console.error('[events] Failed to load impacts:', e.message);
        allImpacts = [];
    }
    displayEvents();
}

function displayEvents() {
    const filter   = document.getElementById('severityFilter').value;
    const filtered = filter === 'all'
        ? allImpacts
        : allImpacts.filter(e => (e.severity || '').toLowerCase() === filter);

    document.getElementById('totalEvents').textContent  = filtered.length;
    document.getElementById('highEvents').textContent   = filtered.filter(e => (e.severity || '').toUpperCase() === 'HIGH').length;
    document.getElementById('mediumEvents').textContent = filtered.filter(e => (e.severity || '').toUpperCase() === 'MEDIUM').length;
    document.getElementById('lowEvents').textContent    = filtered.filter(e => (e.severity || '').toUpperCase() === 'LOW').length;

    document.getElementById('eventsList').innerHTML = filtered.map(event => {
        const sev      = (event.severity || 'low').toLowerCase();
        const peak     = event.peak_g != null ? (+event.peak_g).toFixed(1) + ' g' : '—';
        const time     = event.timestamp ? new Date(event.timestamp).toLocaleString() : (event.time || '—');
        const location = event.distance_m != null
            ? 'KM ' + (event.distance_m / 1000).toFixed(3)
            : (event.location || '—');
        return `
        <div class="event-card event-${sev}">
            <div class="event-info">
                <span class="event-time">${time}</span>
                <span class="event-location">${location}</span>
            </div>
            <span class="event-peak peak-${sev}">${peak}</span>
        </div>`;
    }).join('');
}

function exportEvents() {
    const params = new URLSearchParams();
    if (_histFrom) params.set('from', _histFrom);
    if (_histTo)   params.set('to',   _histTo);
    window.location.href = `${API}/api/impacts/export/csv?${params}`;
}

document.getElementById('severityFilter').addEventListener('change', displayEvents);

// Respond to mode changes from the shell (index.js postMessage)
window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== undefined) return; // ignore non-mode messages
    if (e.data.mode === 'historical' || e.data.mode === 'live') {
        location.href = e.data.mode === 'historical'
            ? `${location.pathname}?from=${e.data.from}&to=${e.data.to}`
            : location.pathname;
    }
});

window.exportEvents = exportEvents;

loadImpacts();
