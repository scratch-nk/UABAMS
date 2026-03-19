/* index.js — Shell: accelerometer status, clock, left-panel sim, iframe loader */
/* Backend connection for real sensor data */

const ACCEL_STATES = ['not-connected', 'initialized', 'connected'];

// Socket.io connection
let socket = null;

// Initialize backend connection
function initBackendConnection() {
    console.log('Initializing backend connection...');
    
    // Load Socket.io script dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
    script.onload = function() {
        connectToBackend();
    };
    document.head.appendChild(script);
}

function connectToBackend() {
    socket = io('http://localhost:5000');
    
    socket.on('connect', function() {
        console.log('Connected to backend server');
        setAccelStatus(1, 'connected');
        setAccelStatus(2, 'connected');
        fetchInitialData();
    });
    
    socket.on('connect_error', function(error) {
        console.error('Cannot connect to backend:', error.message);
        setAccelStatus(1, 'not-connected');
        setAccelStatus(2, 'not-connected');
        showConnectionError();
    });
    
    socket.on('accelerometer-data', function(data) {
        console.log('REAL DATA FROM HARDWARE:', data);
        updateAccelerometerDisplay(data);
    });
    
    socket.on('gps-update', function(location) {
        console.log('GPS update:', location);
        updateGPSDisplay(location);
    });
    
    socket.on('new-impact', function(impact) {
        console.log('New impact:', impact);
        addImpactAlert(impact);
    });
}

// Fetch initial data from REST API
async function fetchInitialData() {
    try {
        const gpsResponse = await fetch('http://localhost:5000/api/gps/current');
        const gpsData = await gpsResponse.json();
        updateGPSDisplay(gpsData);
        
        const accelResponse = await fetch('http://localhost:5000/api/accelerometer/latest');
        const accelData = await accelResponse.json();
        updateAccelerometerDisplay(accelData);
        
        const impactsResponse = await fetch('http://localhost:5000/api/impacts?limit=5');
        const impactsData = await impactsResponse.json();
        updateRecentAlerts(impactsData);
        
    } catch (error) {
        console.error('Error fetching initial data:', error);
    }
}

// Update GPS display with real data
function updateGPSDisplay(location) {
    const coordElement = document.getElementById('coordinate');
    const speedElement = document.getElementById('speed');
    const timeElement = document.getElementById('northernTime');
    
    if (location.latitude && location.longitude && coordElement) {
        coordElement.textContent = 
            location.latitude.toFixed(4) + '°, ' + location.longitude.toFixed(4) + '°';
    }
    
    if (location.speed && speedElement) {
        speedElement.textContent = location.speed.toFixed(2) + ' km/h';
    }
    
    if (location.timestamp && timeElement) {
        const time = new Date(location.timestamp);
        timeElement.textContent = time.toLocaleTimeString();
    }
}

// Update accelerometer display with real data
function updateAccelerometerDisplay(data) {
    if (!data) return;
    
    console.log('Updating display with:', data);
    
    // Map real data to your display fields
    // Hardware sends: x, y, z (not x_axis, y_axis, z_axis)
    const ablVert = document.getElementById('ablVert');
    const ablLat = document.getElementById('ablLat');
    const abrVert = document.getElementById('abrVert');
    const abrLat = document.getElementById('abrLat');
    
    // Use data.x, data.y, data.z (not data.x_axis)
    if (data.x !== undefined && ablVert) {
        ablVert.textContent = Math.abs(data.x).toFixed(3) + ' g';
    }
    if (data.y !== undefined && ablLat) {
        ablLat.textContent = Math.abs(data.y).toFixed(3) + ' g';
    }
    if (data.z !== undefined && abrVert) {
        abrVert.textContent = Math.abs(data.z).toFixed(3) + ' g';
    }
    
    // Calculate magnitude if not provided
    let magnitude = data.gForce;
    if (!magnitude && data.x !== undefined && data.y !== undefined && data.z !== undefined) {
        magnitude = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
    }
    
    // Update AB-R-LAT with magnitude
    if (abrLat && magnitude !== undefined) {
        abrLat.textContent = magnitude.toFixed(3) + ' g';
    }
    
    // Update counter
    const counter = document.getElementById('counter');
    if (counter) {
        const currentVal = parseInt(counter.textContent.replace(/,/g, '')) || 0;
        counter.textContent = (currentVal + 1).toLocaleString();
    }
}

// Update recent alerts with real data
function updateRecentAlerts(impacts) {
    const alertsContainer = document.querySelector('.alerts-mini-list');
    if (!alertsContainer || !impacts || impacts.length === 0) return;
    
    let alertsHTML = '';
    impacts.slice(0, 3).forEach(function(impact) {
        const severityClass = impact.severity ? impact.severity.toLowerCase() : 'low';
        const location = impact.latitude ? 
            Math.round(impact.latitude) + ' km' : 
            'unknown location';
        
        alertsHTML += `
            <div class="alert-mini-item ${severityClass}">
                <span class="alert-dot"></span>
                <span class="alert-text">${impact.peak_g.toFixed(1)}g at ${location}</span>
            </div>
        `;
    });
    
    alertsContainer.innerHTML = alertsHTML;
}

// Add new impact alert in real-time
function addImpactAlert(impact) {
    const alertsContainer = document.querySelector('.alerts-mini-list');
    if (!alertsContainer) return;
    
    const severityClass = impact.severity ? impact.severity.toLowerCase() : 'low';
    const location = impact.latitude ? 
        Math.round(impact.latitude) + ' km' : 
        'unknown location';
    
    const newAlert = document.createElement('div');
    newAlert.className = 'alert-mini-item ' + severityClass;
    newAlert.innerHTML = `
        <span class="alert-dot"></span>
        <span class="alert-text">${impact.peak_g.toFixed(1)}g at ${location}</span>
    `;
    
    alertsContainer.insertBefore(newAlert, alertsContainer.firstChild);
    
    while (alertsContainer.children.length > 5) {
        alertsContainer.removeChild(alertsContainer.lastChild);
    }
    
    if (impact.severity === 'HIGH') {
        showHighSeverityPopup(impact);
    }
}

// Show popup for high severity impacts
function showHighSeverityPopup(impact) {
    const popup = document.createElement('div');
    popup.className = 'high-severity-popup';
    popup.innerHTML = `
        <strong>HIGH SEVERITY IMPACT</strong><br>
        ${impact.peak_g.toFixed(2)}g detected<br>
        ${new Date(impact.timestamp).toLocaleTimeString()}
    `;
    
    document.body.appendChild(popup);
    
    setTimeout(function() {
        if (popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }, 5000);
}

// Show connection error
function showConnectionError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'connection-error';
    errorDiv.innerHTML = 'Cannot connect to backend server';
    document.body.appendChild(errorDiv);
    
    setAccelStatus(1, 'not-connected');
    setAccelStatus(2, 'not-connected');
}

/**
 * Highlight the active state pill and dim the other two.
 * @param {1|2} accelId
 * @param {'not-connected'|'initialized'|'connected'} status
 */
function setAccelStatus(accelId, status) {
    ACCEL_STATES.forEach(function(state) {
        const pill = document.getElementById('accel' + accelId + '-' + state);
        if (!pill) return;
        if (state === status) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
}

// Clock — top-bar time + left-panel time
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour12: false });
    const currentTime = document.getElementById('currentTime');
    const northernTime = document.getElementById('northernTime');
    
    if (currentTime) currentTime.textContent = timeString;
    if (northernTime) northernTime.textContent = timeString;
}
setInterval(updateTime, 1000);
updateTime();

// Load page into right panel iframe
function loadPage(pageUrl, event) {
    console.log('Loading page:', pageUrl);
    
    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent) {
        console.error('Dynamic content element not found');
        return false;
    }
    
    let iframe = document.getElementById('content-frame');
    
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'content-frame';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        dynamicContent.innerHTML = '';
        dynamicContent.appendChild(iframe);
    }
    
    // Handle different path formats
    if (!pageUrl.startsWith('http')) {
        // Remove 'html/' prefix if present (from your menu items)
        pageUrl = pageUrl.replace('html/', '');
        
        // Add 'pages/' prefix if not already there
        if (!pageUrl.startsWith('pages/')) {
            pageUrl = 'pages/' + pageUrl;
        }
    }
    
    console.log('Final path:', pageUrl);
    iframe.src = pageUrl;
    
    // Update active menu button
    document.querySelectorAll('.menu-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    
    if (event && event.target) {
        // Find the closest menu button
        const menuBtn = event.target.closest('.menu-btn');
        if (menuBtn) {
            menuBtn.classList.add('active');
        }
    }
    
    return false;
}

// Make functions available globally
window.loadPage = loadPage;
window.setAccelStatus = setAccelStatus;

// Initialize backend connection on page load
window.addEventListener('load', function() {
    const iframe = document.getElementById('content-frame');
    if (iframe) iframe.remove();
    
    // Start backend connection
    initBackendConnection();
});

// NO SIMULATION CODE - REMOVED COMPLETELY
// The hardware data will now show directly
