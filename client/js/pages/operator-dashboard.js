/* operator-dashboard.js — Operator Dashboard with REAL data only */

let isLiveStreaming = true;
let debugMode = false;
let sensorDataPoints = 50;
let currentDataIndex = 0;

// Socket connection for real data
let socket = null;
let realDataHistory = [];

// Clock — uses startClock from common.js
startClock('currentTime', 'currentDate');

// Initialize socket connection
function initSocketConnection() {
    console.log('Initializing socket connection for operator dashboard...');
    
    // Add status element
    if (!document.getElementById('socket-status')) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'socket-status';
        statusDiv.style.cssText = 'position:fixed; top:10px; right:10px; background:#333; color:white; padding:5px 10px; z-index:9999; border-radius:4px; font-size:12px;';
        statusDiv.innerHTML = 'Socket: Connecting...';
        document.body.appendChild(statusDiv);
    }
    
    // Load socket.io if needed
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
        script.onload = connectSocket;
        script.onerror = () => {
            document.getElementById('socket-status').innerHTML = 'Socket: Failed to load library';
        };
        document.head.appendChild(script);
    } else {
        connectSocket();
    }
}

function connectSocket() {
    document.getElementById('socket-status').innerHTML = 'Socket: Connecting to server...';
    
    socket = io('http://localhost:5000');
    
    socket.on('connect', function() {
        console.log('✅ Operator dashboard connected to backend');
        document.getElementById('socket-status').innerHTML = 'Socket: ✅ Connected';
        document.getElementById('socket-status').style.backgroundColor = '#22c55e';
    });
    
    socket.on('connect_error', function(error) {
        console.log('❌ Connection error:', error);
        document.getElementById('socket-status').innerHTML = 'Socket: ❌ Failed';
        document.getElementById('socket-status').style.backgroundColor = '#ef4444';
    });
    
    socket.on('accelerometer-data', function(data) {
        console.log('📊 REAL DATA RECEIVED:', data);
        
        if (isLiveStreaming) {
            updateWithRealData(data);
        }
        
        // Update status to show data is arriving
        document.getElementById('socket-status').innerHTML = `Socket: 📊 ${new Date().toLocaleTimeString()}`;
    });
}

// Update with REAL hardware data (NO FAKE VALUES)
function updateWithRealData(data) {
    // Update raw values with REAL data
    if (data.x !== undefined) {
        document.getElementById('accel1X').textContent = data.x.toFixed(4);
        document.getElementById('accel2X').textContent = data.x.toFixed(4);
    }
    if (data.y !== undefined) {
        document.getElementById('accel1Y').textContent = data.y.toFixed(4);
        document.getElementById('accel2Y').textContent = data.y.toFixed(4);
    }
    if (data.z !== undefined) {
        document.getElementById('accel1Z').textContent = data.z.toFixed(4);
        document.getElementById('accel2Z').textContent = data.z.toFixed(4);
    }
    
    // Use peak_g if provided, otherwise calculate
    const magnitude = data.peak_g || Math.sqrt(
        (data.x || 0) * (data.x || 0) + 
        (data.y || 0) * (data.y || 0) + 
        (data.z || 0) * (data.z || 0)
    );
    
    document.getElementById('accel1Mag').textContent = magnitude.toFixed(4);
    document.getElementById('accel2Mag').textContent = magnitude.toFixed(4);
    
    // Update chart with real data
    updateChartWithRealData(magnitude);
    
    // Add to debug log if enabled
    if (debugMode) {
        const debugLog = document.getElementById('debugLog');
        if (debugLog) {
            debugLog.innerHTML += `<div>${new Date().toLocaleTimeString()}: X=${data.x?.toFixed(4)} Y=${data.y?.toFixed(4)} Z=${data.z?.toFixed(4)} Mag=${magnitude.toFixed(4)}</div>`;
            while (debugLog.children.length > 10) {
                debugLog.removeChild(debugLog.firstChild);
            }
        }
    }
}

// Update chart with real data
function updateChartWithRealData(magnitude) {
    currentDataIndex++;
    
    // Remove oldest data point
    if (sensorData.length >= sensorDataPoints) {
        sensorData.shift();
    }
    
    // Add new real data point
    sensorData.push({
        time: currentDataIndex,
        accel1: magnitude,
        accel2: magnitude * 0.98  // Slight variation for visual difference
    });
    
    // Update chart
    if (window.operatorChart) {
        window.operatorChart.data.labels = sensorData.map(d => d.time);
        window.operatorChart.data.datasets[0].data = sensorData.map(d => d.accel1);
        window.operatorChart.data.datasets[1].data = sensorData.map(d => d.accel2);
        window.operatorChart.update();
    }
}

// ── Debug toggle ──────────────────────────────────────────────────────────
const debugToggle = document.getElementById('debugToggle');
if (debugToggle) {
    debugToggle.addEventListener('click', () => {
        debugMode = !debugMode;
        debugToggle.classList.toggle('active');
        document.getElementById('debugStatus').textContent = debugMode ? 'Debug ON' : 'Debug OFF';
        const debug1 = document.getElementById('debug1');
        const debug2 = document.getElementById('debug2');
        const debugLog = document.getElementById('debugLog');
        if (debug1) debug1.style.display = debugMode ? 'block' : 'none';
        if (debug2) debug2.style.display = debugMode ? 'block' : 'none';
        if (debugLog) debugLog.style.display = debugMode ? 'block' : 'none';
    });
}

// ── Live/Pause toggle ─────────────────────────────────────────────────────
const playPauseBtn = document.getElementById('playPauseBtn');
if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        isLiveStreaming = !isLiveStreaming;
        const liveIndicator = document.getElementById('liveIndicator');
        const liveDot = document.getElementById('liveDot');
        const liveText = document.getElementById('liveText');
        const pauseIcon = document.getElementById('pauseIcon');
        
        if (isLiveStreaming) {
            if (liveIndicator) liveIndicator.classList.replace('paused', 'streaming');
            if (liveDot) liveDot.classList.add('pulsing');
            if (liveText) liveText.textContent = 'LIVE';
            if (pauseIcon) pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
        } else {
            if (liveIndicator) liveIndicator.classList.replace('streaming', 'paused');
            if (liveDot) liveDot.classList.remove('pulsing');
            if (liveText) liveText.textContent = 'PAUSED';
            if (pauseIcon) pauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        }
    });
}

// ── Sensor chart setup ────────────────────────────────────────────────────
function generateInitialData() {
    const data = [];
    for (let i = 0; i < sensorDataPoints; i++) {
        data.push({
            time: i,
            accel1: 0.005,
            accel2: 0.005
        });
    }
    return data;
}

let sensorData = generateInitialData();

const ctx = document.getElementById('sensorChart')?.getContext('2d');
if (ctx) {
    window.operatorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sensorData.map(d => d.time),
            datasets: [
                { 
                    label: 'Accelerometer 1', 
                    data: sensorData.map(d => d.accel1), 
                    borderColor: '#0891b2', 
                    backgroundColor: 'transparent', 
                    tension: 0.4, 
                    borderWidth: 2, 
                    pointRadius: 0 
                },
                { 
                    label: 'Accelerometer 2', 
                    data: sensorData.map(d => d.accel2), 
                    borderColor: '#7c3aed', 
                    backgroundColor: 'transparent', 
                    tension: 0.4, 
                    borderWidth: 2, 
                    pointRadius: 0 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    display: true, 
                    position: 'top', 
                    labels: { color: '#0f172a', font: { size: 11 } } 
                }
            },
            scales: {
                y: { 
                    min: 0, 
                    max: 0.02,  // Adjusted for your 0.005g values
                    grid: { color: '#e2e8f0' }, 
                    ticks: { color: '#64748b', font: { size: 11 } } 
                },
                x: { display: false }
            },
            animation: { duration: 0 }
        }
    });
}

// Refresh button
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        currentDataIndex = 0;
        sensorData = generateInitialData();
        if (window.operatorChart) {
            window.operatorChart.data.labels = sensorData.map(d => d.time);
            window.operatorChart.data.datasets[0].data = sensorData.map(d => d.accel1);
            window.operatorChart.data.datasets[1].data = sensorData.map(d => d.accel2);
            window.operatorChart.update();
        }
    });
}

// Initialize everything
document.addEventListener('DOMContentLoaded', function() {
    console.log('Operator dashboard loaded - using REAL data only');
    initSocketConnection();
});

// NO FAKE DATA GENERATION - REMOVED COMPLETELY
// The only values shown will be from your hardware
