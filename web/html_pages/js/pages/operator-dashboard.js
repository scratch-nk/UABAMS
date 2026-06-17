/* operator-dashboard.js — Operator Dashboard with live chart, debug, pause/live toggle */

let isLiveStreaming = true;
let debugMode = false;
let sensorDataPoints = 50;
let currentDataIndex = 0;

// Track latest readings per sensor side
let latestLeft  = { x: 0, y: 0, z: 0, gForce: 0 };
let latestRight = { x: 0, y: 0, z: 0, gForce: 0 };

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
        data.push({ time: i, accel1: 0, accel2: 0 });
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
            { label: 'Left (S1)',  data: sensorData.map(d => d.accel1), borderColor: '#0891b2', backgroundColor: 'transparent', tension: 0.4, borderWidth: 2, pointRadius: 0 },
            { label: 'Right (S2)', data: sensorData.map(d => d.accel2), borderColor: '#7c3aed', backgroundColor: 'transparent', tension: 0.4, borderWidth: 2, pointRadius: 0 }
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
            y: { min: 0, grid: { color: '#e2e8f0' }, ticks: { color: '#64748b', font: { size: 11 } } },
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

function pushToChart(accel1Val, accel2Val) {
    currentDataIndex++;
    sensorData.shift();
    sensorData.push({ time: currentDataIndex, accel1: accel1Val, accel2: accel2Val });
    chart.data.labels = sensorData.map(d => d.time);
    chart.data.datasets[0].data = sensorData.map(d => d.accel1);
    chart.data.datasets[1].data = sensorData.map(d => d.accel2);
    chart.update();
}

// ── Socket.io — real sensor data ──────────────────────────────────────────
const socket = io();

socket.on('connect', () => {
    console.log('Socket.io connected:', socket.id);
    liveText.textContent = 'LIVE';
    liveDot.style.background = '#22c55e';
});

socket.on('disconnect', () => {
    console.warn('Socket.io disconnected');
    liveText.textContent = 'NO SERVER';
    liveDot.style.background = '#ef4444';
});

socket.on('connect_error', (err) => {
    console.error('Socket.io error:', err.message);
    liveText.textContent = 'ERROR';
    liveDot.style.background = '#f59e0b';
});

function fillAccel(prefix, data) {
    const f4  = v => (v != null ? (+v).toFixed(4) : '—');
    const fint = v => (v != null ? v.toString()   : '—');
    document.getElementById(`${prefix}X`).textContent      = f4(data.x);
    document.getElementById(`${prefix}Y`).textContent      = f4(data.y);
    document.getElementById(`${prefix}Z`).textContent      = f4(data.z);
    document.getElementById(`${prefix}Peak`).textContent   = f4(data.peak);
    document.getElementById(`${prefix}RmsV`).textContent   = f4(data.rmsV);
    document.getElementById(`${prefix}RmsL`).textContent   = f4(data.rmsL);
    document.getElementById(`${prefix}SdV`).textContent    = f4(data.sdV);
    document.getElementById(`${prefix}SdL`).textContent    = f4(data.sdL);
    document.getElementById(`${prefix}P2pV`).textContent   = f4(data.p2pV);
    document.getElementById(`${prefix}P2pL`).textContent   = f4(data.p2pL);
    document.getElementById(`${prefix}Fs`).textContent     = fint(data.fs);
    document.getElementById(`${prefix}Window`).textContent = fint(data.window);
}

let alertTimeout = null;

function triggerHighGAlert(g, sensor) {
    const banner  = document.getElementById('highGAlert');
    const msg     = document.getElementById('highGMsg');
    if (!banner || !msg) return;
    msg.textContent = `${g.toFixed(2)} g on ${sensor.toUpperCase()} axle box`;
    banner.style.display = 'flex';
    // Auto-dismiss after 8 seconds
    clearTimeout(alertTimeout);
    alertTimeout = setTimeout(() => { banner.style.display = 'none'; }, 8000);
    // Also beep if supported
    try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA==').play(); } catch (_) {}
}

socket.on('sensor-data', (data) => {
    if (!isLiveStreaming) return;

    if (data.sensor === 'left') {
        latestLeft = data;
        fillAccel('accel1', data);
    } else if (data.sensor === 'right') {
        latestRight = data;
        fillAccel('accel2', data);
    }

    // HIGH-G ALERT: trigger when peak or gForce exceeds 4g
    const peakVal = data.peak ?? data.gForce ?? 0;
    if (peakVal >= 4) {
        triggerHighGAlert(peakVal, data.sensor);
    }

    pushToChart(latestLeft.gForce || 0, latestRight.gForce || 0);
});

// Update impact metrics whenever a new impact is recorded
socket.on('new-impact', () => {
    fetch('/api/impacts/stats')
        .then(r => r.json())
        .then(stats => {
            if (stats.total !== undefined)       document.getElementById('impactsToday').textContent = stats.total;
            if (stats.highSeverity !== undefined) document.getElementById('highSeverity').textContent = stats.highSeverity;
            if (stats.maxPeak !== undefined)      document.getElementById('maxPeak').textContent = stats.maxPeak.toFixed(2) + 'g';
        })
        .catch(() => {});
});
