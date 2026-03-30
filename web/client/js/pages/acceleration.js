/* acceleration.js — DB-driven waveform, with database timestamp for last update (1s polling) */

const API          = window.location.origin;
const CHART_POINTS = 120; // seconds visible on chart
const ONLINE_THRESHOLD_MS = 10000; // device considered online if last data ≤ 10s ago
let   pollMinutes  = 2;    // window sent to API (matches time range btn)

// ── Chart setup ───────────────────────────────────────────────────────────
const channels = [
    { key: 'lv', name: 'AB-L-VERT', color: '#22c55e', legendId: 'legend1', metricId: 'metric1' },
    { key: 'll', name: 'AB-L-LAT',  color: '#eab308', legendId: 'legend2', metricId: 'metric2' },
    { key: 'rv', name: 'AB-R-VERT', color: '#ef4444', legendId: 'legend3', metricId: 'metric3' },
    { key: 'rl', name: 'AB-R-LAT',  color: '#8b5cf6', legendId: 'legend4', metricId: 'metric4' }
];

const ctx = document.getElementById('mainChart').getContext('2d');
const mainChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(CHART_POINTS).fill(''),
        datasets: channels.map(ch => ({
            label: ch.name,
            data: Array(CHART_POINTS).fill(null),
            borderColor: ch.color,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            tension: 0.3,
            pointRadius: 0,
            spanGaps: true
        }))
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#ffffff',
                titleColor: '#1e293b',
                bodyColor: '#334155',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(4) + ' g' : '—'}`
                }
            }
        },
        scales: {
            y: {
                beginAtZero: false,
                grid: { color: '#f1f5f9' },
                ticks: { color: '#64748b', font: { size: 11 } }
            },
            x: { display: false }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
});

// ── Format timestamp from DB (handles ISO with/without offset) ────────────
function formatISTDateTime(timestampStr) {
    if (!timestampStr) return 'No data yet';
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) return 'Invalid timestamp';
    const options = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return date.toLocaleString('en-IN', options);
}

// ── Fetch and update the last active timestamp from database (1s polling) ─
async function fetchLastActiveTime() {
    try {
        const response = await fetch(`${API}/api/last-active`);
        const data = await response.json();
        const lastUpdateSpan = document.getElementById('lastUpdate');
        if (!lastUpdateSpan) return;

        if (data.lastActive) {
            const lastTimestampStr = data.lastActive;
            const lastDate = new Date(lastTimestampStr);
            const ageMs = Date.now() - lastDate.getTime();
            const isOnline = ageMs <= ONLINE_THRESHOLD_MS;

            // Display formatted time
            lastUpdateSpan.textContent = formatISTDateTime(lastTimestampStr);
            // Colour: green if online, red if offline
            lastUpdateSpan.style.color = isOnline ? '#22c55e' : '#ef4444';
        } else {
            lastUpdateSpan.textContent = 'No data yet';
            lastUpdateSpan.style.color = '#ef4444';
        }
    } catch (err) {
        console.error('Failed to fetch last active time:', err);
        const lastUpdateSpan = document.getElementById('lastUpdate');
        if (lastUpdateSpan) {
            lastUpdateSpan.textContent = 'Error';
            lastUpdateSpan.style.color = '#ef4444';
        }
    }
}

// ── Fetch from DB and update chart + metrics ───────────────────────────────
async function fetchChannels() {
    try {
        const data = await fetch(`${API}/api/acceleration/channels?minutes=${pollMinutes}`)
            .then(r => r.json());

        if (!Array.isArray(data) || data.length === 0) {
            // No data — clear chart, show dashes
            channels.forEach((ch, i) => {
                mainChart.data.datasets[i].data = Array(CHART_POINTS).fill(null);
                document.getElementById(ch.legendId).textContent = '— g';
                document.getElementById(ch.metricId).textContent = '—';
            });
            mainChart.data.labels = Array(CHART_POINTS).fill('');
            mainChart.update('none');
            return;
        }

        // Rolling window: keep last CHART_POINTS seconds
        const slice  = data.slice(-CHART_POINTS);
        const pad    = CHART_POINTS - slice.length;

        const labels = [...Array(pad).fill(''), ...slice.map(pt =>
            new Date(pt.ts).toLocaleTimeString())];

        channels.forEach((ch, i) => {
            mainChart.data.datasets[i].data = [
                ...Array(pad).fill(null),
                ...slice.map(pt => pt[ch.key])
            ];

            // Always show last known value in legend/metric
            const latest = [...slice].reverse().find(pt => pt[ch.key] != null);
            if (latest) {
                const v = latest[ch.key].toFixed(4);
                document.getElementById(ch.legendId).textContent = v + ' g';
                document.getElementById(ch.metricId).textContent = v;
            } else {
                document.getElementById(ch.legendId).textContent = '— g';
                document.getElementById(ch.metricId).textContent = '—';
            }
        });

        mainChart.data.labels = labels;
        mainChart.update('none');

        // Data points count
        const dpEl = document.getElementById('dataPoints');
        if (dpEl) dpEl.textContent = data.length.toLocaleString();

    } catch (e) {
        console.error('fetchChannels error:', e);
    }
}

// ── Time range buttons ─────────────────────────────────────────────────────
function setTimeRange(range, btn) {
    document.querySelectorAll('.graph-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const map = { '2m': 2, '1h': 60, '6h': 360, '24h': 1440 };
    pollMinutes = map[range] || 2;
    fetchChannels();
}
window.setTimeRange = setTimeRange;

// ── Start polling ──────────────────────────────────────────────────────────
fetchChannels();
setInterval(fetchChannels, 3000);          // chart updates every 3s

fetchLastActiveTime();
setInterval(fetchLastActiveTime, 1000);    // timestamp updates every 1s (real-time)
