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

// Simulate live left-panel readings
setInterval(() => {
    document.getElementById('speed').textContent = (89 + Math.random() * 5).toFixed(2) + ' km/h';

    const counter = parseInt(document.getElementById('counter').textContent.replace(/,/g, '')) + 1;
    document.getElementById('counter').textContent = counter.toLocaleString();

    document.getElementById('ablVert').textContent = (2 + Math.random() * 0.8).toFixed(2) + ' g';
    document.getElementById('ablLat').textContent  = (0.5 + Math.random() * 0.3).toFixed(2) + ' g';
    document.getElementById('abrVert').textContent = (0.3 + Math.random() * 0.3).toFixed(2) + ' g';
    document.getElementById('abrLat').textContent  = (0.08 + Math.random() * 0.06).toFixed(2) + ' g';
}, 3000);

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
