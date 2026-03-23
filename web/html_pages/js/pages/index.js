/* index.js — Shell: accelerometer status, clock, left-panel sim, iframe loader */

const ACCEL_STATES = ['not-connected', 'initialized', 'connected'];

/**
 * Highlight the active state pill and dim the other two.
 * @param {1|2} accelId
 * @param {'not-connected'|'initialized'|'connected'} status
 */
function setAccelStatus(accelId, status) {
    ACCEL_STATES.forEach(state => {
        const pill = document.getElementById(`accel${accelId}-${state}`);
        if (!pill) return;
        pill.classList.toggle('active', state === status);
    });
}

// Clock — top-bar time + left-panel time
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour12: false });
    document.getElementById('currentTime').textContent = timeString;
    const northernTime = document.getElementById('northernTime');
    if (northernTime) northernTime.textContent = timeString;
}
setInterval(updateTime, 1000);
updateTime();

// ── Socket.io — real sensor data ──────────────────────────────────────────
const socket = io();

socket.on('sensor-data', (data) => {
    const accelId = data.sensor === 'right' ? 2 : 1;
    setAccelStatus(accelId, 'connected');

    if (data.sensor === 'left') {
        document.getElementById('ablVert').textContent = Math.abs(data.z).toFixed(2) + ' g';
        document.getElementById('ablLat').textContent  = Math.abs(data.x).toFixed(2) + ' g';
    } else if (data.sensor === 'right') {
        document.getElementById('abrVert').textContent = Math.abs(data.z).toFixed(2) + ' g';
        document.getElementById('abrLat').textContent  = Math.abs(data.x).toFixed(2) + ' g';
    }
});

socket.on('accelerometer-data', (data) => {
    setAccelStatus(1, 'connected');
    document.getElementById('ablVert').textContent = Math.abs(data.z).toFixed(2) + ' g';
    document.getElementById('ablLat').textContent  = Math.abs(data.x).toFixed(2) + ' g';
});

socket.on('disconnect', () => {
    setAccelStatus(1, 'not-connected');
    setAccelStatus(2, 'not-connected');
});

// Load page into right panel iframe
function loadPage(pageUrl) {
    const dynamicContent = document.getElementById('dynamicContent');
    let iframe = document.getElementById('content-frame');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'content-frame';
        dynamicContent.innerHTML = '';
        dynamicContent.appendChild(iframe);
    }
    iframe.src = pageUrl;
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

window.loadPage = loadPage;
window.setAccelStatus = setAccelStatus;

// Restore welcome message on fresh load
window.addEventListener('load', () => {
    const iframe = document.getElementById('content-frame');
    if (iframe) iframe.remove();
});
