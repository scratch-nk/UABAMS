/* events.js — Realtime Impact Events polled from DB every 2s */

const API = window.location.origin;

let allEvents = [];
let filterVal = 'all';
let lastIsoTime = '';

function normalise(d) {
    const sev = (d.severity || '').toLowerCase();
    return {
        time:    d.timestamp ? new Date(d.timestamp).toLocaleString() : '—',
        isoTime: d.timestamp || '',
        location: d.distance_m > 0
            ? `KM ${Math.floor(d.distance_m / 1000)}+${String(d.distance_m % 1000).padStart(3,'0')}`
            : 'Stationary',
        peak:    +(d.peak_g || d.gForce || 0).toFixed(2),
        sensor:  d.sensor || '—',
        severity: sev,
        pClass:  d.p_class || null,
        rmsV:    d.rmsV,
        rmsL:    d.rmsL,
        isNew:   false
    };
}

async function fetchEvents() {
    try {
        const data = await fetch(`${API}/api/impacts`).then(r => r.json());
        const normalised = data.map(normalise);

        // detect new arrivals (newer than last known)
        if (lastIsoTime) {
            normalised.forEach(e => {
                if (e.isoTime > lastIsoTime) e.isNew = true;
            });
        }

        // update lastIsoTime to most recent
        if (normalised.length) {
            const latest = normalised.reduce((a, b) => a.isoTime > b.isoTime ? a : b);
            if (latest.isoTime > lastIsoTime) lastIsoTime = latest.isoTime;
        }

        const hadNew = normalised.some(e => e.isNew);
        allEvents = normalised;
        renderAll(hadNew);
    } catch (e) { console.error('fetch impacts:', e); }
}

// ── Render ────────────────────────────────────────────────────────────────
function filtered() {
    return filterVal === 'all' ? allEvents : allEvents.filter(e => e.severity === filterVal);
}

function pClassBadge(p) {
    if (!p) return '';
    const map = { P1: '#22c55e', P2: '#f59e0b', P3: '#ef4444' };
    return `<span class="pclass-badge" style="background:${map[p]||'#94a3b8'}">${p}</span>`;
}

function cardHTML(ev) {
    const newTag = ev.isNew ? '<span class="new-tag">NEW</span>' : '';
    return `
    <div class="event-card event-${ev.severity}${ev.isNew ? ' event-flash' : ''}">
        <div class="event-left">
            <div class="event-top-row">
                ${newTag}
                <span class="event-time">${ev.time}</span>
                <span class="event-sensor">${ev.sensor}</span>
                ${pClassBadge(ev.pClass)}
            </div>
            <div class="event-bottom-row">
                <span class="event-location"><i class="fas fa-map-marker-alt"></i> ${ev.location}</span>
                ${ev.rmsV != null ? `<span class="event-meta">RMS-V ${ev.rmsV.toFixed(3)}g</span>` : ''}
                ${ev.rmsL != null ? `<span class="event-meta">RMS-L ${ev.rmsL.toFixed(3)}g</span>` : ''}
            </div>
        </div>
        <div class="event-right">
            <span class="event-peak peak-${ev.severity}">${ev.peak.toFixed(1)} g</span>
            <span class="sev-label sev-${ev.severity}">${ev.severity.toUpperCase()}</span>
        </div>
    </div>`;
}

function renderAll(flashDot = false) {
    const list = filtered();
    document.getElementById('totalEvents').textContent  = list.length;
    document.getElementById('highEvents').textContent   = list.filter(e => e.severity === 'high').length;
    document.getElementById('mediumEvents').textContent = list.filter(e => e.severity === 'medium').length;
    document.getElementById('lowEvents').textContent    = list.filter(e => e.severity === 'low').length;
    document.getElementById('eventsList').innerHTML =
        list.length ? list.map(cardHTML).join('') : '<p class="empty">No events found.</p>';

    if (flashDot) {
        const dot = document.getElementById('liveDot');
        dot.classList.add('pulse');
        setTimeout(() => dot.classList.remove('pulse'), 800);
    }
}

// ── Filter ────────────────────────────────────────────────────────────────
document.getElementById('severityFilter').addEventListener('change', e => {
    filterVal = e.target.value;
    renderAll();
});

// ── Export ────────────────────────────────────────────────────────────────
function exportEvents() {
    window.open(`${API}/api/impacts/export/csv`, '_blank');
}
window.exportEvents = exportEvents;

// ── Boot + poll every 2s ──────────────────────────────────────────────────
fetchEvents();
setInterval(fetchEvents, 2000);
