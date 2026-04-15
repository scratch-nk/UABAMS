/* events.js — Realtime Impact Events via Socket.IO + initial REST fetch */

const API = window.location.origin;

let allEvents = [];
let filterVal = 'all';
let filterFrom = '';
let filterTo   = '';

function normalise(d) {
    const sev = (d.severity || '').toLowerCase();
    return {
        time:    d.timestamp ? new Date(d.timestamp).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }) : '—',
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
        // full detail fields
        x: d.x, y: d.y, z: d.z,
        sdV: d.sdV, sdL: d.sdL,
        p2pV: d.p2pV, p2pL: d.p2pL,
        fs: d.fs, window_ms: d.window_ms,
        distance_m: d.distance_m,
        isNew: false
    };
}

// ── Initial load from REST ────────────────────────────────────────────────
async function fetchEvents() {
    const statusEl = document.getElementById('connStatus');
    try {
        const data = await fetch(`${API}/api/impacts`).then(r => r.json());
        allEvents = data.map(normalise);
        renderAll(false);
        if (statusEl) { statusEl.textContent = 'Live'; statusEl.className = 'conn-status conn-on'; }
    } catch (e) {
        console.error('fetch impacts:', e);
        if (statusEl) { statusEl.textContent = 'Offline'; statusEl.className = 'conn-status conn-off'; }
    }
}

// ── Socket.IO live updates ────────────────────────────────────────────────
const socket = io(API);

socket.on('connect', () => {
    const statusEl = document.getElementById('connStatus');
    if (statusEl) { statusEl.textContent = 'Live'; statusEl.className = 'conn-status conn-on'; }
});

socket.on('disconnect', () => {
    const statusEl = document.getElementById('connStatus');
    if (statusEl) { statusEl.textContent = 'Offline'; statusEl.className = 'conn-status conn-off'; }
});

socket.on('new-impact', (impact) => {
    const ev = normalise(impact);
    ev.isNew = true;
    // Prepend (newest first) and cap at 200
    allEvents.unshift(ev);
    if (allEvents.length > 200) allEvents.pop();
    renderAll(true);
});

// ── Render ────────────────────────────────────────────────────────────────
function filtered() {
    let list = filterVal === 'all' ? allEvents : allEvents.filter(e => e.severity === filterVal);
    if (filterFrom) list = list.filter(e => e.isoTime >= filterFrom);
    if (filterTo)   list = list.filter(e => e.isoTime <= filterTo + 'T23:59:59');
    return list;
}

function pClassBadge(p) {
    if (!p) return '';
    const map = { P1: '#22c55e', P2: '#f59e0b', P3: '#ef4444' };
    return `<span class="pclass-badge" style="background:${map[p]||'#94a3b8'}">${p}</span>`;
}

function cardHTML(ev) {
    const newTag = ev.isNew ? '<span class="new-tag">NEW</span>' : '';
    return `
    <div class="event-card event-${ev.severity}${ev.isNew ? ' event-flash' : ''}" onclick="openDetail(${allEvents.indexOf(ev)})" style="cursor:pointer;">
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

// ── Event Detail Slide-Out Panel ──────────────────────────────────────────
(function injectDetailPanel() {
    const panel = document.createElement('div');
    panel.id = 'eventDetailPanel';
    panel.style.cssText = `
        position:fixed; top:0; right:-420px; width:400px; height:100vh;
        background:#fff; border-left:1px solid #e2e8f0;
        box-shadow:-4px 0 20px rgba(0,0,0,0.1);
        z-index:9999; transition:right 0.3s ease;
        display:flex; flex-direction:column; font-family:inherit;`;
    panel.innerHTML = `
        <div style="padding:1.25rem 1.5rem; border-bottom:1px solid #e2e8f0;
                    display:flex; align-items:center; justify-content:space-between;">
            <h3 style="margin:0; font-size:1rem; color:#0f172a;">Impact Detail</h3>
            <button id="detailClose" style="background:none; border:none; cursor:pointer; color:#64748b; font-size:1.25rem;">✕</button>
        </div>
        <div id="detailBody" style="flex:1; overflow-y:auto; padding:1.25rem 1.5rem;"></div>`;
    document.body.appendChild(panel);

    document.getElementById('detailClose').addEventListener('click', closeDetail);
    panel.addEventListener('click', e => { if (e.target === panel) closeDetail(); });
})();

function openDetail(idx) {
    const ev = filtered()[idx];
    if (!ev) return;
    const fmt = v => v != null ? (+v).toFixed(4) : '—';
    const row = (label, val) =>
        `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:0.8rem;color:#64748b;">${label}</span>
            <span style="font-size:0.8rem;font-weight:600;color:#0f172a;font-family:'Courier New',monospace;">${val}</span>
        </div>`;
    const section = (title) =>
        `<div style="font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;
                     letter-spacing:0.06em;margin:1rem 0 0.25rem;">${title}</div>`;

    document.getElementById('detailBody').innerHTML = `
        ${section('Identity')}
        ${row('Time', ev.time)}
        ${row('Sensor', ev.sensor)}
        ${row('Severity', ev.severity.toUpperCase())}
        ${row('P-Class', ev.pClass || '—')}
        ${row('Location', ev.location)}
        ${section('Peak & Force')}
        ${row('Peak (g)', fmt(ev.peak))}
        ${row('X-axis (g)', fmt(ev.x))}
        ${row('Y-axis (g)', fmt(ev.y))}
        ${row('Z-axis (g)', fmt(ev.z))}
        ${section('RMS & Std Dev')}
        ${row('RMS-Vertical (g)', fmt(ev.rmsV))}
        ${row('RMS-Lateral (g)', fmt(ev.rmsL))}
        ${row('SD-Vertical (g)', fmt(ev.sdV))}
        ${row('SD-Lateral (g)', fmt(ev.sdL))}
        ${section('Peak-to-Peak & Config')}
        ${row('P2P-Vertical (g)', fmt(ev.p2pV))}
        ${row('P2P-Lateral (g)', fmt(ev.p2pL))}
        ${row('Sample Rate (Hz)', ev.fs != null ? ev.fs : '—')}
        ${row('Window (ms)', ev.window_ms != null ? ev.window_ms : '—')}
        ${row('Distance (m)', ev.distance_m != null ? ev.distance_m : '—')}`;

    const panel = document.getElementById('eventDetailPanel');
    panel.style.right = '0';
}

function closeDetail() {
    document.getElementById('eventDetailPanel').style.right = '-420px';
}
window.openDetail  = openDetail;
window.closeDetail = closeDetail;

// ── Filters ───────────────────────────────────────────────────────────────
document.getElementById('severityFilter').addEventListener('change', e => {
    filterVal = e.target.value;
    renderAll();
});

const fromEl = document.getElementById('filterFrom');
const toEl   = document.getElementById('filterTo');
if (fromEl) fromEl.addEventListener('change', e => { filterFrom = e.target.value; renderAll(); });
if (toEl)   toEl.addEventListener('change',   e => { filterTo   = e.target.value; renderAll(); });

// ── Export ────────────────────────────────────────────────────────────────
function exportEvents() {
    window.open(`${API}/api/impacts/export/csv`, '_blank');
}
window.exportEvents = exportEvents;

// ── Boot: load history once, then live updates via socket ─────────────────
fetchEvents();
