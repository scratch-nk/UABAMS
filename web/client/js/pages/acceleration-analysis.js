/* acceleration-analysis.js */

const SERVER = window.location.origin;

let thresholds = { p1Min: 5, p1Max: 10, p2Min: 10, p2Max: 20, p3Min: 20 };
let lastFetchedData = [];

function loadThresholds() {
    const saved = localStorage.getItem('rm_thresholds');
    if (saved) thresholds = JSON.parse(saved);
    console.log('[analysis] Thresholds loaded:', thresholds);
}

function getPriority(peakG) {
    if (peakG == null) return { class: '—', badge: '', threshold: '—', color: '#94a3b8' };
    const g = +peakG;
    if (g >= thresholds.p3Min) return { class: 'P3', badge: 'badge-p3', threshold: thresholds.p3Min, color: '#b91c1c' };
    if (g >= thresholds.p2Min) return { class: 'P2', badge: 'badge-p2', threshold: thresholds.p2Min, color: '#c2410c' };
    if (g >= thresholds.p1Min) return { class: 'P1', badge: 'badge-p1', threshold: thresholds.p1Min, color: '#b45309' };
    return { class: '—', badge: '', threshold: '—', color: '#94a3b8' };
}

function formatKM(distanceM) {
    if (!distanceM) return '0+000';
    const km = Math.floor(distanceM / 1000);
    const m = Math.round(distanceM % 1000);
    return `${km}+${String(m).padStart(3, '0')}`;
}

async function fetchImpacts() {
    try {
        const res = await fetch(`${SERVER}/api/impacts?t=${Date.now()}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        console.log(`[analysis] Received ${data.length} records from database`);
        return data;
    } catch (e) {
        console.error('[analysis] Fetch error:', e);
        return [];
    }
}

function renderThresholdsBar() {
    const container = document.getElementById('thresholdsBar');
    if (!container) return;
    container.innerHTML = `
        <div class="threshold-item"><div class="threshold-marker marker-p1"></div><div class="threshold-info"><span class="threshold-label">P1 MEDIUM</span><span class="threshold-value">${thresholds.p1Min}g – ${thresholds.p1Max}g</span></div></div>
        <div class="threshold-item"><div class="threshold-marker marker-p2"></div><div class="threshold-info"><span class="threshold-label">P2 HIGH</span><span class="threshold-value">${thresholds.p2Min}g – ${thresholds.p2Max}g</span></div></div>
        <div class="threshold-item"><div class="threshold-marker marker-p3"></div><div class="threshold-info"><span class="threshold-label">P3 CRITICAL</span><span class="threshold-value">&gt; ${thresholds.p3Min}g</span></div></div>
    `;
}

function renderTable(data) {
    const tbody = document.getElementById('reportBody');
    const countEl = document.getElementById('recordCount');
    if (!tbody) return;

    countEl.textContent = `${data.length} records`;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#ef4444;">No data from database</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(d => {
        const pri = getPriority(d.peak_g);
        const km = formatKM(d.distance_m);
        const ts = new Date(d.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
        const sensor = d.sensor || '—';

        return `
            <tr>
                <td><strong>KM ${km}</strong><br><small>${ts}</small></td>
                <td style="font-family:monospace;">—</td>
                <td style="color:${pri.color};font-weight:600;">${(+d.peak_g || 0).toFixed(3)} g</td>
                <td><span class="threshold-highlight">${pri.threshold} g</span></td>
                <td><span class="priority-badge ${pri.badge}">${pri.class}</span></td>
                <td>—</td>
                <td>${sensor}</td>
            </tr>
        `;
    }).join('');
}

async function loadAndRender() {
    const tbody = document.getElementById('reportBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8;">Loading from database...</td></tr>';

    loadThresholds();
    const data = await fetchImpacts();
    lastFetchedData = data;
    renderTable(data);
    renderThresholdsBar();
    console.log(`[analysis] Rendered ${data.length} rows`);
}

function exportReport() {
    const data = lastFetchedData;
    if (!data || data.length === 0) { alert('No data to export'); return; }

    const headers = ['KM Location', 'Timestamp', 'Peak (g)', 'Threshold (g)', 'Priority Class', 'Sensor'];
    const rows = data.map(d => {
        const pri = getPriority(d.peak_g);
        const km = formatKM(d.distance_m);
        const ts = new Date(d.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
        return [
            `KM ${km}`,
            ts,
            (+d.peak_g || 0).toFixed(3),
            pri.threshold,
            pri.class,
            d.sensor || '—'
        ].join(',');
    });

    const metadata = [
        `Report Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}`,
        `Thresholds: P1:${thresholds.p1Min}-${thresholds.p1Max}g, P2:${thresholds.p2Min}-${thresholds.p2Max}g, P3:>${thresholds.p3Min}g`,
        `Total Records: ${data.length}`,
        ''
    ];

    const fullReport = [...metadata, headers.join(','), ...rows].join('\n');
    const blob = new Blob([fullReport], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Acceleration_Analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

window.exportReport = exportReport;

// Reload if thresholds change in another tab
window.addEventListener('storage', e => {
    if (e.key === 'rm_thresholds') loadAndRender();
});

loadAndRender();
