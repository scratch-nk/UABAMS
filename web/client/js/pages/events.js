/* events.js — Realtime Impact Events
 *
 * Threshold classification:
 *   - Fetched fresh from /api/thresholds every poll cycle
 *   - d.p_class from DB is IGNORED — re-classified at render time against
 *     live thresholds so config changes reflect immediately
 *   - Gap-absorbing logic: g >= p3Min → P3, g >= p2Min → P2, g >= p1Min → P1
 *
 * Live/Offline indicator:
 *   - Checks /api/realtime/status on every cycle
 *   - "Live" (green) only when MQTT is connected AND data received < 10s ago
 *   - "Offline" (red) when hardware disconnected or no recent data
 */

const API = window.location.origin;

let allEvents  = [];
let filterVal  = 'all';
let lastIsoTime = '';

// Null until fetched — no hardcoded defaults
let thresholds = { p1Min: null, p1Max: null, p2Min: null, p2Max: null, p3Min: null };

// ── Fetch live thresholds ─────────────────────────────────────────────────
async function loadThresholds() {
    try {
        const res = await fetch(`${API}/api/thresholds`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        thresholds = await res.json();
    } catch (e) {
        console.warn('[events] Could not load thresholds:', e.message);
    }
}

// ── Gap-absorbing P-class from live thresholds ────────────────────────────
// Never reads d.p_class — always re-classifies from raw peak_g value.
function getPClass(peakG) {
    if (peakG == null || thresholds.p1Min === null) return null;
    const g = +peakG;
    if (g >= thresholds.p3Min) return 'P3';
    if (g >= thresholds.p2Min) return 'P2';
    if (g >= thresholds.p1Min) return 'P1';
    return null;
}

// ── Normalise DB record ───────────────────────────────────────────────────
function normalise(d) {
    const sev = (d.severity || '').toLowerCase();
    return {
        time: d.timestamp ? new Date(d.timestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }) : '—',
        isoTime:  d.timestamp || '',
        location: d.distance_m > 0
            ? `KM ${Math.floor(d.distance_m / 1000)}+${String(d.distance_m % 1000).padStart(3,'0')}`
            : 'Stationary',
        peak:     +(d.peak_g || d.gForce || 0).toFixed(2),
        sensor:   d.sensor || '—',
        severity: sev,
        pClass:     getPClass(d.peak_g),   // live classification, not d.p_class
        // Applied threshold: the min of whichever band the peak falls into
        appliedThreshold: (() => {
            if (thresholds.p1Min === null) return null;
            const g = +(d.peak_g || 0);
            if (g >= thresholds.p3Min) return thresholds.p3Min;
            if (g >= thresholds.p2Min) return thresholds.p2Min;
            if (g >= thresholds.p1Min) return thresholds.p1Min;
            return null;
        })(),
        isNew:    false
    };
}

// ── Device connection status ──────────────────────────────────────────────
async function updateConnectionStatus() {
    const statusEl = document.getElementById('connStatus');
    if (!statusEl) return;
    try {
        const res    = await fetch(`${API}/api/realtime/status`);
        const status = await res.json();
        // "Live" only when MQTT connected AND hardware sent data in last 10s
        const live = status.connected && status.receiving_data;
        statusEl.textContent  = live ? 'Live' : 'Offline';
        statusEl.className    = `conn-status ${live ? 'conn-on' : 'conn-off'}`;
    } catch (e) {
        // Server itself unreachable
        statusEl.textContent = 'Offline';
        statusEl.className   = 'conn-status conn-off';
    }
}

// ── Fetch and render events ───────────────────────────────────────────────
async function fetchEvents() {
    // Always refresh thresholds first so classification uses latest config
    await loadThresholds();

    // Connection status is independent of data fetch — check separately
    await updateConnectionStatus();

    try {
        const data       = await fetch(`${API}/api/impacts`).then(r => r.json());
        const normalised = data.map(normalise);

        // Mark genuinely new arrivals
        if (lastIsoTime) {
            normalised.forEach(e => { if (e.isoTime > lastIsoTime) e.isNew = true; });
        }
        if (normalised.length) {
            const latest = normalised.reduce((a, b) => a.isoTime > b.isoTime ? a : b);
            if (latest.isoTime > lastIsoTime) lastIsoTime = latest.isoTime;
        }

        allEvents = normalised;
        renderAll(normalised.some(e => e.isNew));
    } catch (e) {
        console.error('[events] fetch impacts:', e);
    }
}

// ── Render ────────────────────────────────────────────────────────────────
function filtered() {
    return filterVal === 'all' ? allEvents : allEvents.filter(e => e.severity === filterVal);
}

function pClassBadge(p) {
    if (!p) return '';
    const map = { P1: '#22c55e', P2: '#f59e0b', P3: '#ef4444' };
    return `<span class="pclass-badge" style="background:${map[p] || '#94a3b8'}">${p}</span>`;
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
                <span class="event-meta">Peak <strong>${ev.peak.toFixed(3)} g</strong></span>
                ${ev.appliedThreshold != null
                    ? `<span class="event-meta">Threshold <strong>${ev.appliedThreshold} g</strong></span>`
                    : '<span class="event-meta" style="color:#94a3b8;">Threshold —</span>'}
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
        if (dot) { dot.classList.add('pulse'); setTimeout(() => dot.classList.remove('pulse'), 800); }
    }
}

// ── Filter ────────────────────────────────────────────────────────────────
document.getElementById('severityFilter').addEventListener('change', e => {
    filterVal = e.target.value;
    renderAll();
});

// ── Export ────────────────────────────────────────────────────────────────
function exportEvents() { window.open(`${API}/api/impacts/export/csv`, '_blank'); }
window.exportEvents = exportEvents;

// ── Boot — show Offline immediately, then start polling ───────────────────
(function init() {
    const statusEl = document.getElementById('connStatus');
    if (statusEl) { statusEl.textContent = 'Offline'; statusEl.className = 'conn-status conn-off'; }
    fetchEvents();
    setInterval(fetchEvents, 2000);
})();
