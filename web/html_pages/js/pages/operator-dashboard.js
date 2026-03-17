/* operator-dashboard.js — Operator Dashboard with live chart, debug, pause/live toggle */

let isLiveStreaming = true;
let debugMode = false;
let sensorDataPoints = 50;
let currentDataIndex = 0;

// Clock — uses startClock from common.js
startClock('currentTime', 'currentDate');

// ── Debug toggle ──────────────────────────────────────────────────────────
const debugToggle = document.getElementById('debugToggle');
debugToggle.addEventListener('click', () => {
    debugMode = !debugMode;
    debugToggle.classList.toggle('active');
    document.getElementById('debugStatus').textContent = debugMode ? 'Debug ON' : 'Debug OFF';
    document.getElementById('debug1').style.display    = debugMode ? 'block' : 'none';
    document.getElementById('debug2').style.display    = debugMode ? 'block' : 'none';
    document.getElementById('debugLog').style.display  = debugMode ? 'block' : 'none';
});

// ── Live/Pause toggle ─────────────────────────────────────────────────────
const playPauseBtn  = document.getElementById('playPauseBtn');
const liveIndicator = document.getElementById('liveIndicator');
const liveDot       = document.getElementById('liveDot');
const liveText      = document.getElementById('liveText');
const pauseIcon     = document.getElementById('pauseIcon');

playPauseBtn.addEventListener('click', () => {
    isLiveStreaming = !isLiveStreaming;
    if (isLiveStreaming) {
        liveIndicator.classList.replace('paused', 'streaming');
        liveDot.classList.add('pulsing');
        liveText.textContent = 'LIVE';
        pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    } else {
        liveIndicator.classList.replace('streaming', 'paused');
        liveDot.classList.remove('pulsing');
        liveText.textContent = 'PAUSED';
        pauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
});

// Refresh button
document.getElementById('refreshBtn').addEventListener('click', () => {
    currentDataIndex = 0;
    initializeSensorData();
});

// ── Sensor chart ──────────────────────────────────────────────────────────
function generateSensorData() {
    const data = [];
    for (let i = 0; i < sensorDataPoints; i++) {
        data.push({
            time:   i,
            accel1: Math.sin(i * 0.3) * 2 + 2 + (Math.random() - 0.5) * 0.5,
            accel2: Math.cos(i * 0.25) * 1.8 + 2.2 + (Math.random() - 0.5) * 0.4
        });
    }
    return data;
}

let sensorData = generateSensorData();

const ctx = document.getElementById('sensorChart').getContext('2d');
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: sensorData.map(d => d.time),
        datasets: [
            { label: 'Accelerometer 1', data: sensorData.map(d => d.accel1), borderColor: '#0891b2', backgroundColor: 'transparent', tension: 0.4, borderWidth: 2, pointRadius: 0 },
            { label: 'Accelerometer 2', data: sensorData.map(d => d.accel2), borderColor: '#7c3aed', backgroundColor: 'transparent', tension: 0.4, borderWidth: 2, pointRadius: 0 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top', labels: { color: '#0f172a', font: { size: 11 } } },
            tooltip: { backgroundColor: '#ffffff', titleColor: '#0f172a', bodyColor: '#0f172a', borderColor: '#e2e8f0', borderWidth: 1, padding: 12 }
        },
        scales: {
            y: { min: 0, max: 5, grid: { color: '#e2e8f0' }, ticks: { color: '#64748b', font: { size: 11 } } },
            x: { display: false }
        },
        animation: { duration: 0 }
    }
});

function initializeSensorData() {
    sensorData = generateSensorData();
    chart.data.labels = sensorData.map(d => d.time);
    chart.data.datasets[0].data = sensorData.map(d => d.accel1);
    chart.data.datasets[1].data = sensorData.map(d => d.accel2);
    chart.update();
}

function updateSensorData() {
    if (!isLiveStreaming) return;
    currentDataIndex++;
    sensorData.shift();
    sensorData.push({
        time:   currentDataIndex,
        accel1: Math.sin(currentDataIndex * 0.3) * 2 + 2 + (Math.random() - 0.5) * 0.5,
        accel2: Math.cos(currentDataIndex * 0.25) * 1.8 + 2.2 + (Math.random() - 0.5) * 0.4
    });
    chart.data.labels = sensorData.map(d => d.time);
    chart.data.datasets[0].data = sensorData.map(d => d.accel1);
    chart.data.datasets[1].data = sensorData.map(d => d.accel2);
    chart.update();
}

function updateRawValues() {
    if (!isLiveStreaming) return;

    const a1X = (Math.random() - 0.5) * 0.1,  a1Y = (Math.random() - 0.5) * 0.1;
    const a1Z = 9.8 + (Math.random() - 0.5) * 0.05, a1M = 2.3 + (Math.random() - 0.5) * 0.2;
    document.getElementById('accel1X').textContent   = a1X.toFixed(4);
    document.getElementById('accel1Y').textContent   = a1Y.toFixed(4);
    document.getElementById('accel1Z').textContent   = a1Z.toFixed(4);
    document.getElementById('accel1Mag').textContent = a1M.toFixed(4);

    const a2X = (Math.random() - 0.5) * 0.1,  a2Y = (Math.random() - 0.5) * 0.1;
    const a2Z = 9.8 + (Math.random() - 0.5) * 0.05, a2M = 2.2 + (Math.random() - 0.5) * 0.2;
    document.getElementById('accel2X').textContent   = a2X.toFixed(4);
    document.getElementById('accel2Y').textContent   = a2Y.toFixed(4);
    document.getElementById('accel2Z').textContent   = a2Z.toFixed(4);
    document.getElementById('accel2Mag').textContent = a2M.toFixed(4);
}

setInterval(() => { updateSensorData(); updateRawValues(); }, 1000);
