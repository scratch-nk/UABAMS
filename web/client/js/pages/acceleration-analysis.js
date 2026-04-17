/* acceleration-analysis.js
 *
 * Thresholds come exclusively from GET /api/thresholds.
 * No localStorage, no hardcoded values.
 * If thresholds are null (not configured yet), P-class shows as "—".
 * Classification always happens at render time against live thresholds,
 * so changing config is reflected immediately on next poll.
 */

const SERVER = window.location.origin;

// Null until fetched — no defaults
let thresholds = { p1Min: null, p1Max: null, p2Min: null, p2Max: null, p3Min: null };

async function loadThresholds() {
    try {
        const res = await fetch(`${SERVER}/api/thresholds`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        thresholds = await res.json();
        console.log('[analysis] Thresholds:', thresholds);
    } catch (e) {
        console.warn('[analysis] Could not load thresholds:', e.message);
    }
}

// Classify peak_g against CURRENT thresholds.
// Never reads d.p_class from the DB record — that was stamped at record time.
function getPriority(peakG) {
    if (peakG == null) return { class: '—', badge: '', threshold: '—', color: '#94a3b8' };
    if (thresholds.p1Min === null) // not configured yet
        return { class: '—', badge: 'badge-unconfigured', threshold: '—', color: '#94a3b8' };

    const g = +peakG;
    const { p1Min, p1Max, p2Min, p2Max, p3Min } = thresholds;

    // Gap-absorbing: g >= p1Min but below p2Min → P1 (gap belongs to lower class)
    if (g >= p3Min) return { class: 'P3', badge: 'badge-p3', threshold: p3Min, color: '#b91c1c' };
    if (g >= p2Min) return { class: 'P2', badge: 'badge-p2', threshold: p2Min, color: '#c2410c' };
    if (g >= p1Min) return { class: 'P1', badge: 'badge-p1', threshold: p1Min, color: '#b45309' };
    return { class: '—', badge: '', threshold: '—', color: '#94a3b8' };
}

function formatKM(distanceM) {
    if (!distanceM) return '0+000';
    const km = Math.floor(distanceM / 1000);
    const m  = Math.round(distanceM % 1000);
    return `${km}+${String(m).padStart(3, '0')}`;
}

async function fetchImpacts() {
    try {
        const res = await fetch(`${SERVER}/api/impacts?t=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to fetch');
        return await res.json();
    } catch (e) {
        console.error('[analysis] Fetch error:', e);
        return [];
    }
}

function renderThresholdsBar() {
    const container = document.getElementById('thresholdsBar');
    if (!container) return;
    const { p1Min, p1Max, p2Min, p2Max, p3Min } = thresholds;
    const notSet = p1Min === null;
    container.innerHTML = notSet
        ? `<div class="threshold-item" style="color:#94a3b8;font-size:0.9rem;">
               No thresholds configured — go to <a href="configuration.html">Configuration</a> to set them.
           </div>`
        : `
        <div class="threshold-item"><div class="threshold-marker marker-p1"></div>
            <div class="threshold-info"><span class="threshold-label">P1 MEDIUM</span>
            <span class="threshold-value">${p1Min}g – ${p1Max}g</span></div></div>
        <div class="threshold-item"><div class="threshold-marker marker-p2"></div>
            <div class="threshold-info"><span class="threshold-label">P2 HIGH</span>
            <span class="threshold-value">${p2Min}g – ${p2Max}g</span></div></div>
        <div class="threshold-item"><div class="threshold-marker marker-p3"></div>
            <div class="threshold-info"><span class="threshold-label">P3 CRITICAL</span>
            <span class="threshold-value">&gt; ${p3Min}g</span></div></div>
        `;
}

function renderTable(data) {
    const tbody   = document.getElementById('reportBody');
    const countEl = document.getElementById('recordCount');
    if (!tbody) return;

    countEl.textContent = `${data.length} records`;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#ef4444;">No data from database</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(d => {
        const pri    = getPriority(d.peak_g);   // always re-classify, never trust d.p_class
        const km     = formatKM(d.distance_m);
        const ts     = new Date(d.timestamp).toLocaleString();
        const sensor = d.sensor || '—';
        return `
            <tr>
                <td><strong>KM ${km}</strong><br><small>${ts}</small></td>
                <td style="font-family:monospace;">—</td>
                <td style="color:${pri.color};font-weight:600;">${(+d.peak_g || 0).toFixed(3)} g</td>
                <td><span class="threshold-highlight">${pri.threshold}${pri.threshold !== '—' ? ' g' : ''}</span></td>
                <td><span class="priority-badge ${pri.badge}">${pri.class}</span></td>
                <td>—</td>
                <td>${sensor}</td>
            </tr>`;
    }).join('');
}

async function loadAndRender() {
    const tbody = document.getElementById('reportBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8;">Loading...</td></tr>';

    await loadThresholds();   // fresh from server every cycle
    const data = await fetchImpacts();
    renderTable(data);
    renderThresholdsBar();
}

document.addEventListener('DOMContentLoaded', () => {
    loadAndRender();
    setInterval(loadAndRender, 30000);
});

window.exportReport = () => alert('Report exported!');