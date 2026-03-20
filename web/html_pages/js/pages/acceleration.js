/* acceleration.js — Live waveform chart for 4 acceleration channels */

// Timestamp display
function updateTimestamp() {
    const now = new Date();
    document.getElementById('currentTimestamp').textContent =
        now.toLocaleTimeString() + ' ' + now.toLocaleDateString();
}
setInterval(updateTimestamp, 1000);
updateTimestamp();

// "Last update" counter
let seconds = 0;
setInterval(() => {
    seconds = (seconds + 1) % 60;
    document.getElementById('lastUpdate').textContent = seconds + 's ago';
}, 1000);

// Channel definitions
const channels = [
    { name: 'AB-L-VERT', color: '#22c55e', base: 2.46, legendId: 'legend1', metricId: 'metric1' },
    { name: 'AB-L-LAT',  color: '#eab308', base: 0.64, legendId: 'legend2', metricId: 'metric2' },
    { name: 'AB-R-VERT', color: '#ef4444', base: 0.46, legendId: 'legend3', metricId: 'metric3' },
    { name: 'AB-R-LAT',  color: '#8b5cf6', base: 0.10, legendId: 'legend4', metricId: 'metric4' }
];

const dataPoints = 200;

const datasets = channels.map(ch => ({
    label: ch.name,
    data: Array(dataPoints).fill(0).map((_, i) =>
        ch.base + Math.sin(i * 0.1) * ch.base * 0.3 + (Math.random() - 0.5) * 0.2
    ),
    borderColor: ch.color,
    backgroundColor: 'transparent',
    borderWidth: 2,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 3
}));

const ctx = document.getElementById('mainChart').getContext('2d');
const mainChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: Array(dataPoints).fill(0).map((_, i) => i),
        datasets
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'white',
                titleColor: '#1e293b',
                bodyColor: '#334155',
                borderColor: '#e2e8f0',
                borderWidth: 1
            }
        },
        scales: {
            y: { beginAtZero: false, grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
            x: { display: false, grid: { display: false } }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
});

// Real-time updates
setInterval(() => {
    channels.forEach((ch, idx) => {
        const newVal = (ch.base + (Math.random() - 0.5) * 0.4).toFixed(2);
        document.getElementById(ch.legendId).textContent = newVal + ' m/s²';
        document.getElementById(ch.metricId).textContent = newVal;

        mainChart.data.datasets[idx].data.shift();
        mainChart.data.datasets[idx].data.push(
            ch.base + Math.sin(Date.now() * 0.01 + idx) * ch.base * 0.3 + (Math.random() - 0.5) * 0.2
        );
    });
    mainChart.update();
}, 1000);

// Time range selector
function setTimeRange(range) {
    document.querySelectorAll('.graph-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    const points = range === '1h' ? 200 : range === '6h' ? 500 : range === '24h' ? 1000 : 2000;
    mainChart.data.labels = Array(points).fill(0).map((_, i) => i);
    channels.forEach((ch, idx) => {
        mainChart.data.datasets[idx].data = Array(points).fill(0).map((_, i) =>
            ch.base + Math.sin(i * 0.1) * ch.base * 0.3 + (Math.random() - 0.5) * 0.2
        );
    });
    mainChart.update();
}

window.setTimeRange = setTimeRange;
