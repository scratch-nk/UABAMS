const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');

// CouchDB connection
const nano = require('nano')('http://admin:admin123@192.168.0.125:5984');

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
const mqttClient = mqtt.connect('mqtt://localhost:1883');

// ============================================
// API ENDPOINTS
// ============================================

// GET /api/impacts - Get recent impacts
app.get('/api/impacts', async (req, res) => {
    try {
        if (!accelerometerEventsDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const response = await accelerometerEventsDB.list({ 
            include_docs: true, 
            descending: true, 
            limit: 50 
        });
        const impacts = response.rows.map(row => row.doc);
        res.json(impacts);
    } catch (error) {
        console.error('Error fetching impacts:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/impacts/severity/:level - Get impacts by severity
app.get('/api/impacts/severity/:level', async (req, res) => {
    try {
        if (!accelerometerEventsDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const { level } = req.params;
        const response = await accelerometerEventsDB.find({
            selector: {
                severity: level.toUpperCase()
            },
            sort: [{ timestamp: 'desc' }],
            limit: 50
        });
        res.json(response.docs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/impacts/stats - Get impact statistics
app.get('/api/impacts/stats', async (req, res) => {
    try {
        if (!accelerometerEventsDB) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const now = new Date();
        const last24h = new Date(now.setDate(now.getDate() - 1));
        
        const response = await accelerometerEventsDB.find({
            selector: {
                timestamp: { $gte: last24h.toISOString() }
            }
        });
        
        const stats = {
            total: response.docs.length,
            high: response.docs.filter(d => d.severity === 'HIGH').length,
            medium: response.docs.filter(d => d.severity === 'MEDIUM').length,
            low: response.docs.filter(d => d.severity === 'LOW').length,
            maxG: Math.max(...response.docs.map(d => d.peak_g || 0)),
            avgG: response.docs.length > 0 
                ? response.docs.reduce((acc, d) => acc + (d.peak_g || 0), 0) / response.docs.length 
                : 0
        };
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

mqttClient.on('connect', () => {
    console.log('MQTT Connected');
    
    // Subscribe to ALL topics - including your actual one
    mqttClient.subscribe('sensor/railway/accelerometer/#');      // YOUR ACTUAL TOPIC - ADDED
    mqttClient.subscribe('sensor/accelerometer/#');              // Your existing
    mqttClient.subscribe('sensor/gps/#');                        // Your existing
    mqttClient.subscribe('adj/datalogger/sensors/accelerometer'); // Other device
    
    console.log('Subscribed to:');
    console.log('   sensor/railway/accelerometer/#');  // THIS IS THE KEY
    console.log('   sensor/accelerometer/#');
    console.log('   sensor/gps/#'); 
    console.log('   adj/datalogger/sensors/accelerometer');
});

mqttClient.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const timestamp = new Date().toISOString();
        
        // Log every message received (for debugging)
        console.log(` Received on topic: ${topic}`);
        console.log(` Data:`, data);  // See exactly what came in
        
        // This will match ANY topic containing 'accelerometer'
        if (topic.includes('accelerometer')) {
            console.log(' Processing accelerometer data');
            
            // Store in monitoring_data database
            if (monitoringDataDB) {
                await monitoringDataDB.insert({
                    timestamp: timestamp,
                    type: 'accelerometer',
                    x_axis: data.x || 0,
                    y_axis: data.y || 0,
                    z_axis: data.z || 0,
                    device_id: data.device_id || 'unknown'
                });
                console.log('Stored in monitoring_data');
            }

            // Calculate g-force (magnitude)
            const gForce = Math.sqrt(
                Math.pow(data.x || 0, 2) +
                Math.pow(data.y || 0, 2) +
                Math.pow(data.z || 0, 2)
            );
            console.log(`Calculated gForce: ${gForce.toFixed(4)}g`);

            // Check for impacts
            if (gForce > 2 && accelerometerEventsDB) {
                const severity = gForce > 15 ? 'HIGH' : gForce > 5 ? 'MEDIUM' : 'LOW';

                const impact = {
                    timestamp: timestamp,
                    peak_g: gForce,
                    severity: severity,
                    latitude: data.lat || null,
                    longitude: data.lng || null,
                    speed: data.speed || 0,
                    x_axis: data.x || 0,
                    y_axis: data.y || 0,
                    z_axis: data.z || 0,
                    device_id: data.device_id || 'unknown'
                };
                
                await accelerometerEventsDB.insert(impact);
                io.emit('new-impact', impact);
                
                console.log(`Impact detected: ${gForce.toFixed(2)}g (${severity})`);
            }

            // Broadcast sensor data to frontend
            console.log(` BROADCASTING TO FRONTEND:`, {
                x: data.x,
                y: data.y,
                z: data.z,
                gForce: gForce,
                device_id: data.device_id
            });
            
            io.emit('accelerometer-data', {
                x: data.x,
                y: data.y,
                z: data.z,
                gForce: gForce,
                device_id: data.device_id,
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
    console.log(`Frontend: http://192.168.0.125:${PORT}/index.html`);
    console.log(`API endpoints: http://192.168.0.125:${PORT}/api/`);
    console.log(`CouchDB Admin: http://192.168.0.125:5984/_utils/`);
    console.log(`Health check: http://192.168.0.125:${PORT}/health`);
});
