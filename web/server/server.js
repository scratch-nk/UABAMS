const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                return addr.address;
            }
        }
    }
    return '127.0.0.1';
}

const LOCAL_IP = getLocalIP();

// ── Persistent JSON peak log ───────────────────────────────────────────────
const PEAKS_LOG_FILE = path.join(__dirname, 'peaks_log.json');

function loadPeaksLog() {
    try {
        if (fs.existsSync(PEAKS_LOG_FILE)) {
            return JSON.parse(fs.readFileSync(PEAKS_LOG_FILE, 'utf8'));
        }
    } catch (e) { console.error('peaks_log.json read error:', e.message); }
    return [];
}

function savePeaksLog(log) {
    try { fs.writeFileSync(PEAKS_LOG_FILE, JSON.stringify(log, null, 2)); }
    catch (e) { console.error('peaks_log.json write error:', e.message); }
}

let peaksLog = loadPeaksLog();
console.log(`Loaded ${peaksLog.length} existing impact records from peaks_log.json`);

// CouchDB connection
const nano = require('nano')('http://admin:admin123@127.0.0.1:5984');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Serve your existing frontend files
app.use(express.static(path.join(__dirname, '../client')));

// ============================================
// COUCHDB SETUP
// ============================================

let accelerometerEventsDB;
let monitoringDataDB;
let gpsTrackingDB;
let rideComfortDB;

const initCouchDB = async () => {
    try {
        // Test connection
        await nano.db.list();
        console.log('Connected to CouchDB');
        
        // Get database references
        accelerometerEventsDB = nano.use('accelerometer_events');
        monitoringDataDB = nano.use('monitoring_data');
        gpsTrackingDB = nano.use('gps_tracking');
        rideComfortDB = nano.use('ride_comfort_index');
        
        console.log('All databases ready');
    } catch (error) {
        console.error('CouchDB initialization error:', error);
    }
};

// Initialize databases
initCouchDB();

// MQTT Connection
// const mqttClient = mqtt.connect(`mqtt://${LOCAL_IP}:1883`);
const mqttClient = mqtt.connect(`mqtt://localhost:1883`);

// ============================================
// API ENDPOINTS
// ============================================

// ── Shared helpers ─────────────────────────────────────────────────────────
function statsFromDocs(docs) {
    const last24h = new Date(Date.now() - 86400000).toISOString();
    const today   = docs.filter(d => d.timestamp >= last24h);
    const peaks   = today.map(d => d.peak_g || 0);
    return {
        total:        today.length,
        highSeverity: today.filter(d => d.severity === 'HIGH').length,
        medium:       today.filter(d => d.severity === 'MEDIUM').length,
        low:          today.filter(d => d.severity === 'LOW').length,
        maxPeak:      peaks.length ? Math.max(...peaks) : 0,
        avgPeak:      peaks.length ? peaks.reduce((a, b) => a + b, 0) / peaks.length : 0
    };
}

// GET /api/impacts - Get recent impacts (JSON log, newest first)
app.get('/api/impacts', async (req, res) => {
    try {
        if (accelerometerEventsDB) {
            const response = await accelerometerEventsDB.list({ include_docs: true, descending: true, limit: 200 });
            return res.json(response.rows.map(r => r.doc));
        }
    } catch (_) {}
    res.json([...peaksLog].reverse().slice(0, 200));
});

// GET /api/impacts/severity/:level
app.get('/api/impacts/severity/:level', (req, res) => {
    const level = req.params.level.toUpperCase();
    res.json(peaksLog.filter(d => d.severity === level).reverse());
});

// GET /api/impacts/stats - stats for the last 24 h
app.get('/api/impacts/stats', async (req, res) => {
    try {
        if (accelerometerEventsDB) {
            const last24h = new Date(Date.now() - 86400000).toISOString();
            const response = await accelerometerEventsDB.find({ selector: { timestamp: { $gte: last24h } } });
            return res.json(statsFromDocs(response.docs));
        }
    } catch (_) {}
    res.json(statsFromDocs(peaksLog));
});

// GET /api/impacts/export/csv - download all impacts as CSV
app.get('/api/impacts/export/csv', (req, res) => {
    const rows = [...peaksLog].reverse();
    const header = 'timestamp,sensor,severity,peak_g,gForce,rmsV,rmsL,sdV,sdL,p2pV,p2pL,x,y,z,fs,window_ms';
    const lines  = rows.map(d =>
        [d.timestamp, d.sensor, d.severity,
         d.peak_g, d.gForce, d.rmsV, d.rmsL, d.sdV, d.sdL, d.p2pV, d.p2pL,
         d.x, d.y, d.z, d.fs, d.window_ms].join(',')
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="impact_report.csv"');
    res.send([header, ...lines].join('\n'));
});

// GET /api/gps/current - Get current GPS location
app.get('/api/gps/current', async (req, res) => {
    try {
        if (!gpsTrackingDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const response = await gpsTrackingDB.list({ 
            include_docs: true, 
            descending: true, 
            limit: 1 
        });
        const location = response.rows.length > 0 ? response.rows[0].doc : {};
        res.json(location);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/gps/history/:timeRange - Get GPS history
app.get('/api/gps/history/:timeRange', async (req, res) => {
    try {
        if (!gpsTrackingDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const { timeRange } = req.params;
        const now = new Date();
        let timeLimit = new Date();
        
        if (timeRange === '1h') timeLimit.setHours(now.getHours() - 1);
        else if (timeRange === '24h') timeLimit.setDate(now.getDate() - 1);
        else if (timeRange === '7d') timeLimit.setDate(now.getDate() - 7);
        
        const response = await gpsTrackingDB.find({
            selector: {
                timestamp: { $gte: timeLimit.toISOString() }
            },
            sort: [{ timestamp: 'desc' }]
        });
        
        res.json(response.docs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/accelerometer/:timeRange - Get accelerometer data by time range
app.get('/api/accelerometer/:timeRange', async (req, res) => {
    try {
        if (!monitoringDataDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const { timeRange } = req.params;
        const now = new Date();
        let timeLimit = new Date();
        
        if (timeRange === '1h') timeLimit.setHours(now.getHours() - 1);
        else if (timeRange === '24h') timeLimit.setDate(now.getDate() - 1);
        else if (timeRange === '7d') timeLimit.setDate(now.getDate() - 7);
        
        const response = await monitoringDataDB.find({
            selector: {
                timestamp: { $gte: timeLimit.toISOString() }
            },
            sort: [{ timestamp: 'asc' }],
            limit: 1000
        });
        
        res.json(response.docs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/accelerometer/latest - Get latest accelerometer reading
app.get('/api/accelerometer/latest', async (req, res) => {
    try {
        if (!monitoringDataDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const response = await monitoringDataDB.list({ 
            include_docs: true, 
            descending: true, 
            limit: 1 
        });
        const latest = response.rows.length > 0 ? response.rows[0].doc : {};
        res.json(latest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/comfort/current - Get current ride comfort index
app.get('/api/comfort/current', async (req, res) => {
    try {
        if (!rideComfortDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const response = await rideComfortDB.list({ 
            include_docs: true, 
            descending: true, 
            limit: 1 
        });
        const comfort = response.rows.length > 0 ? response.rows[0].doc : {};
        res.json(comfort);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/comfort/history/:timeRange - Get ride comfort history
app.get('/api/comfort/history/:timeRange', async (req, res) => {
    try {
        if (!rideComfortDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const { timeRange } = req.params;
        const now = new Date();
        let timeLimit = new Date();
        
        if (timeRange === '1h') timeLimit.setHours(now.getHours() - 1);
        else if (timeRange === '24h') timeLimit.setDate(now.getDate() - 1);
        else if (timeRange === '7d') timeLimit.setDate(now.getDate() - 7);
        
        const response = await rideComfortDB.find({
            selector: {
                timestamp: { $gte: timeLimit.toISOString() }
            },
            sort: [{ timestamp: 'desc' }]
        });
        
        res.json(response.docs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /health - Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbs = await nano.db.list();
        res.json({ 
            status: 'OK', 
            timestamp: new Date(),
            couchdb: 'connected',
            databases: dbs
        });
    } catch (error) {
        res.json({ 
            status: 'ERROR', 
            timestamp: new Date(),
            couchdb: 'disconnected',
            error: error.message
        });
    }
});

// GET /api - List all available endpoints
app.get('/api', (req, res) => {
    res.json({
        message: 'Railway Monitoring API',
        endpoints: {
            impacts: {
                list: 'GET /api/impacts',
                bySeverity: 'GET /api/impacts/severity/:level',
                stats: 'GET /api/impacts/stats'
            },
            gps: {
                current: 'GET /api/gps/current',
                history: 'GET /api/gps/history/:timeRange'
            },
            accelerometer: {
                byTimeRange: 'GET /api/accelerometer/:timeRange',
                latest: 'GET /api/accelerometer/latest'
            },
            comfort: {
                current: 'GET /api/comfort/current',
                history: 'GET /api/comfort/history/:timeRange'
            },
            system: {
                health: 'GET /health'
            }
        }
    });
});

// ============================================
// WEBSOCKET
// ============================================

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ============================================
// MQTT HANDLER
// ============================================

mqttClient.on('error', (err) => {
    console.error('MQTT connection error:', err.message);
});

mqttClient.on('close', () => {
    console.warn('MQTT connection closed');
});

mqttClient.on('offline', () => {
    console.warn('MQTT client offline - broker unreachable?');
});

mqttClient.on('connect', () => {
    console.log('MQTT Connected');
    
    const topics = [
        'sensor/railway/accelerometer/#',
        'sensor/accelerometer/#',
        'sensor/gps/#',
        'adj/datalogger/sensors/accelerometer',
        'adj/datalogger/sensors/right',
        'adj/datalogger/sensors/left'
    ];

    topics.forEach(topic => {
        mqttClient.subscribe(topic, (err) => {
            if (err) console.error(`Failed to subscribe to ${topic}:`, err.message);
            else console.log(`Subscribed to: ${topic}`);
        });
    });
});

mqttClient.on('message', async (topic, message) => {
    try {
        const msgStr = message.toString();
        let data;

        // Try JSON first; fall back to parsing the text format
        // e.g. "Ax : 0.051 g  Ay : -0.012 g  Az : 0.983 g\nX=0.051 Y=-0.012 Z=0.983"
        try {
            data = JSON.parse(msgStr);
        } catch (_) {
            data = {};
            // X=... Y=... Z=... format
            const xm = msgStr.match(/X=([+-]?\d+\.?\d*)/);
            const ym = msgStr.match(/Y=([+-]?\d+\.?\d*)/);
            const zm = msgStr.match(/Z=([+-]?\d+\.?\d*)/);
            if (xm) data.x = parseFloat(xm[1]);
            if (ym) data.y = parseFloat(ym[1]);
            if (zm) data.z = parseFloat(zm[1]);
            // Ax/Ay/Az : value g  format
            const axm = msgStr.match(/Ax\s*:\s*([+-]?\d+\.?\d*)/);
            const aym = msgStr.match(/Ay\s*:\s*([+-]?\d+\.?\d*)/);
            const azm = msgStr.match(/Az\s*:\s*([+-]?\d+\.?\d*)/);
            if (axm) data.x = data.x ?? parseFloat(axm[1]);
            if (aym) data.y = data.y ?? parseFloat(aym[1]);
            if (azm) data.z = data.z ?? parseFloat(azm[1]);
            // Statistical fields
            const rmsV  = msgStr.match(/RMS-V\s*:\s*([+-]?\d+\.?\d*)/);
            const rmsL  = msgStr.match(/RMS-L\s*:\s*([+-]?\d+\.?\d*)/);
            const sdV   = msgStr.match(/SD-V\s*:\s*([+-]?\d+\.?\d*)/);
            const sdL   = msgStr.match(/SD-L\s*:\s*([+-]?\d+\.?\d*)/);
            const p2pV  = msgStr.match(/P2P-V\s*:\s*([+-]?\d+\.?\d*)/);
            const p2pL  = msgStr.match(/P2P-L\s*:\s*([+-]?\d+\.?\d*)/);
            const peakm = msgStr.match(/PEAK\s*:\s*([+-]?\d+\.?\d*)/);
            const fsm   = msgStr.match(/FS\s*:\s*(\d+)/);
            const winm  = msgStr.match(/WINDOW\s*:\s*(\d+)/);
            if (rmsV)  data.rmsV   = parseFloat(rmsV[1]);
            if (rmsL)  data.rmsL   = parseFloat(rmsL[1]);
            if (sdV)   data.sdV    = parseFloat(sdV[1]);
            if (sdL)   data.sdL    = parseFloat(sdL[1]);
            if (p2pV)  data.p2pV   = parseFloat(p2pV[1]);
            if (p2pL)  data.p2pL   = parseFloat(p2pL[1]);
            if (peakm) data.peak   = parseFloat(peakm[1]);
            if (fsm)   data.fs     = parseInt(fsm[1]);
            if (winm)  data.window = parseInt(winm[1]);
        }

        // Log raw payload so we can see exact field names
        if (topic.includes('sensors/right') || topic.includes('sensors/left')) {
            console.log('=== RAW MQTT payload ===\n', JSON.stringify(msgStr), '\n=== parsed data ===\n', data);
        }

        // Normalise axis field names (Ax/Ay/Az in JSON → x/y/z)
        data.x = data.x ?? data.Ax ?? data.ax ?? 0;
        data.y = data.y ?? data.Ay ?? data.ay ?? 0;
        data.z = data.z ?? data.Az ?? data.az ?? 0;

        // Normalise statistical field names (snake_case / ALL_CAPS / hyphenated variants)
        data.rmsV   = data.rmsV   ?? data.rms_v  ?? data['RMS-V']  ?? data.RMS_V  ?? data.RMSV;
        data.rmsL   = data.rmsL   ?? data.rms_l  ?? data['RMS-L']  ?? data.RMS_L  ?? data.RMSL;
        data.sdV    = data.sdV    ?? data.sd_v   ?? data['SD-V']   ?? data.SD_V   ?? data.SDV;
        data.sdL    = data.sdL    ?? data.sd_l   ?? data['SD-L']   ?? data.SD_L   ?? data.SDL;
        data.p2pV   = data.p2pV   ?? data.p2p_v  ?? data['P2P-V']  ?? data.P2P_V  ?? data.P2PV;
        data.p2pL   = data.p2pL   ?? data.p2p_l  ?? data['P2P-L']  ?? data.P2P_L  ?? data.P2PL;
        data.peak   = data.peak   ?? data.PEAK   ?? data.peak_g;
        data.fs     = data.fs     ?? data.FS     ?? data.sample_rate ?? data.sampleRate;
        data.window = data.window ?? data.WINDOW ?? data.window_ms;

        const timestamp = new Date().toISOString();

        // Log every message received (for debugging)
        console.log(`Received on topic: ${topic}`);
        console.log(`Data:`, data);  // See exactly what came in

        // This will match ANY topic containing 'accelerometer', 'right', or 'left'
        if (topic.includes('accelerometer') || topic.includes('sensors/right') || topic.includes('sensors/left')) {
            console.log('Processing accelerometer data');
            
            // Store in monitoring_data database (non-blocking — never abort the emit)
            if (monitoringDataDB) {
                monitoringDataDB.insert({
                    timestamp: timestamp,
                    type: 'accelerometer',
                    x_axis: data.x || 0,
                    y_axis: data.y || 0,
                    z_axis: data.z || 0,
                    device_id: data.device_id || 'unknown'
                }).then(() => console.log('Stored in monitoring_data'))
                  .catch(e => console.error('DB insert failed (non-fatal):', e.message));
            }

            // Calculate g-force (magnitude)
            const gForce = Math.sqrt(
                Math.pow(data.x || 0, 2) +
                Math.pow(data.y || 0, 2) +
                Math.pow(data.z || 0, 2)
            );
            console.log(`Calculated gForce: ${gForce.toFixed(4)}g`);

            // ── Impact detection (uses sensor's own PEAK value if available) ──
            const peakVal = data.peak ?? gForce;
            if (peakVal > 2) {
                const sensorSideEarly = topic.includes('right') ? 'right'
                                      : topic.includes('left')  ? 'left' : 'unknown';
                const severity = peakVal > 15 ? 'HIGH' : peakVal > 5 ? 'MEDIUM' : 'LOW';

                const impact = {
                    timestamp:  timestamp,
                    sensor:     sensorSideEarly,
                    severity:   severity,
                    peak_g:     peakVal,
                    gForce:     gForce,
                    rmsV:       data.rmsV  ?? null,
                    rmsL:       data.rmsL  ?? null,
                    sdV:        data.sdV   ?? null,
                    sdL:        data.sdL   ?? null,
                    p2pV:       data.p2pV  ?? null,
                    p2pL:       data.p2pL  ?? null,
                    x:          data.x || 0,
                    y:          data.y || 0,
                    z:          data.z || 0,
                    fs:         data.fs     ?? null,
                    window_ms:  data.window ?? null,
                    device_id:  data.device_id || topic
                };

                // Always save to JSON log
                peaksLog.push(impact);
                savePeaksLog(peaksLog);

                // Also try CouchDB (non-blocking)
                if (accelerometerEventsDB) {
                    accelerometerEventsDB.insert(impact)
                        .catch(e => console.error('Impact DB insert failed (non-fatal):', e.message));
                }

                io.emit('new-impact', impact);
                console.log(`Impact recorded: ${peakVal.toFixed(3)}g (${severity}) on ${sensorSideEarly}`);
            }

            // Broadcast sensor data to frontend
            console.log(` BROADCASTING TO FRONTEND:`, {
                x: data.x,
                y: data.y,
                z: data.z,
                gForce: gForce,
                device_id: data.device_id
            });
            
            const sensorSide = topic.includes('right') ? 'right'
                             : topic.includes('left')  ? 'left'
                             : 'unknown';

            io.emit('sensor-data', {
                sensor: sensorSide,
                x: data.x,
                y: data.y,
                z: data.z,
                gForce: gForce,
                rmsV:   data.rmsV,
                rmsL:   data.rmsL,
                sdV:    data.sdV,
                sdL:    data.sdL,
                p2pV:   data.p2pV,
                p2pL:   data.p2pL,
                peak:   data.peak ?? gForce,
                fs:     data.fs,
                window: data.window,
                device_id: data.device_id || topic,
                timestamp: timestamp
            });

        } else if (topic.includes('gps')) {
            // GPS handling code...
            if (gpsTrackingDB) {
                const gpsData = {
                    timestamp: timestamp,
                    latitude: data.lat || data.latitude,
                    longitude: data.lng || data.longitude,
                    speed: data.speed || 0,
                    heading: data.heading || 0,
                    accuracy: data.accuracy || 0,
                    device_id: data.device_id || 'unknown'
                };

                await gpsTrackingDB.insert(gpsData);
                io.emit('gps-update', {
                    lat: gpsData.latitude,
                    lng: gpsData.longitude,
                    speed: gpsData.speed,
                    timestamp: timestamp
                });
                
                console.log(`GPS update: ${gpsData.latitude}, ${gpsData.longitude}`);
            }
        }
    } catch (error) {
        console.error('Error processing MQTT message:', error);
    }
});

// Add this to your index.js file
function loadPage(pageUrl, event) {
    console.log('Loading page:', pageUrl);
    console.log('Event:', event);

    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent) {
        console.error('Dynamic content element not found');
        alert('Error: Could not find content area');
        return;
    }

    let iframe = document.getElementById('content-frame');

    if (!iframe) {
        console.log('Creating new iframe');
        iframe = document.createElement('iframe');
        iframe.id = 'content-frame';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        dynamicContent.innerHTML = '';
        dynamicContent.appendChild(iframe);
    }

    // Fix the path - remove 'html/' prefix and add 'pages/'
    let cleanPath = pageUrl.replace('html/', '');
    if (!cleanPath.startsWith('pages/')) {
        cleanPath = 'pages/' + cleanPath;
    }

    console.log('Final path:', cleanPath);

    // Add error handling for iframe
    iframe.onerror = function() {
        console.error('Failed to load:', cleanPath);
        alert('Failed to load page: ' + cleanPath);
    };

    iframe.src = cleanPath;

    // Update active menu item
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (event && event.target) {
        const menuBtn = event.target.closest('.menu-btn');
        if (menuBtn) {
            menuBtn.classList.add('active');
        }
    }

    return false;
}

// Make it globally available
//window.loadPage = loadPage;

console.log('loadPage function loaded and available');


// Start server
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local IP: ${LOCAL_IP}`);
    console.log(`Frontend: http://${LOCAL_IP}:${PORT}/index.html`);
    console.log(`API endpoints: http://${LOCAL_IP}:${PORT}/api/`);
    console.log(`CouchDB Admin: http://127.0.0.1:5984/_utils/`);
    console.log(`Health check: http://${LOCAL_IP}:${PORT}/health`);
});
