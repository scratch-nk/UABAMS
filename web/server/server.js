require('dotenv').config();
const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const mqtt      = require('mqtt');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');

// ── Persistent JSON fallback ──────────────────────────────────────────────
const PEAKS_LOG_FILE = path.join(__dirname, 'peaks_log.json');

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

function loadPeaksLog() {
    try {
        if (fs.existsSync(PEAKS_LOG_FILE))
            return JSON.parse(fs.readFileSync(PEAKS_LOG_FILE, 'utf8'));
    } catch (e) { console.error('peaks_log.json read error:', e.message); }
    return [];
}
function savePeaksLog(log) {
    try { fs.writeFileSync(PEAKS_LOG_FILE, JSON.stringify(log, null, 2)); }
    catch (e) { console.error('peaks_log.json write error:', e.message); }
}

let peaksLog = loadPeaksLog();
console.log(`Loaded ${peaksLog.length} existing impact records from JSON fallback`);

// ── Express / Socket.IO ───────────────────────────────────────────────────
const COUCHDB_URL = `http://${process.env.COUCHDB_USER}:${process.env.COUCHDB_PASS}@${process.env.COUCHDB_HOST}:${process.env.COUCHDB_PORT}`;
const nano   = require('nano')(COUCHDB_URL);
const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// ── CouchDB setup + index creation ───────────────────────────────────────
let accelerometerEventsDB, monitoringDataDB, realtimeDataDB;

async function ensureIndex(db, fields, name) {
    try {
        await db.createIndex({
            index: { fields },
            name,
            type: 'json'
        });
        console.log(`Index '${name}' ready`);
    } catch (e) {
        // 'exists' is fine — any other error log it
        if (!e.message?.includes('exists'))
            console.error(`Index '${name}' error:`, e.message);
    }
}

const initCouchDB = async () => {
    try {
        await nano.db.list();
        console.log('Connected to CouchDB');

        accelerometerEventsDB = nano.use('accelerometer_events');
        monitoringDataDB      = nano.use('monitoring_data');

        // realtime_data — create if missing
        try { await nano.db.get('realtime_data'); }
        catch (e) { await nano.db.create('realtime_data'); console.log('Created realtime_data'); }
        realtimeDataDB = nano.use('realtime_data');

        // ── Create Mango indexes so .find() queries actually work ──────────
        // Without these, CouchDB does a full scan which can fail or return
        // wrong results on large databases
        await ensureIndex(accelerometerEventsDB, ['timestamp'],           'idx-timestamp');
        await ensureIndex(accelerometerEventsDB, ['timestamp','severity'],'idx-timestamp-severity');
        await ensureIndex(monitoringDataDB,      ['timestamp'],           'idx-timestamp');

        console.log('All databases and indexes ready');
    } catch (error) {
        console.error('CouchDB initialization error:', error);
    }
};
initCouchDB();

// ── MQTT ──────────────────────────────────────────────────────────────────
let lastDataTimestamp = null;
let mqttConnected     = false;
const mqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`);

// ── Health parser ─────────────────────────────────────────────────────────
// TODO: Details of peripherals to be fetched from controller encoded in msg.
function parseHealthMessage(msgStr) {
    const get = pattern => {
        const m = msgStr.match(pattern);
        if (!m) return 'UNKNOWN';
        return m[1].trim().toUpperCase() === 'OK' ? 'OK' : 'FAIL';
    };
    return {
        usart2:     get(/USART2\s*:\s*(OK|FAIL)/i),
        spi1:       get(/SPI1\s*:\s*(OK|FAIL)/i),
        adxl345_s1: get(/ADXL345\s+S1\s*:\s*(OK|FAIL)/i),
        adxl345_s2: get(/ADXL345\s+S2\s*:\s*(OK|FAIL)/i),
        w5500:      get(/W5500\s*:\s*(OK|FAIL)/i),
        phyLink:    get(/PHY\s*Link\s*:\s*(OK|FAIL)/i),
        tcp:        get(/TCP\s*:\s*(OK|FAIL)/i),
        timestamp:  new Date().toISOString(),
        raw:        msgStr.trim()
    };
}

// ── Stats helper — single source of truth ────────────────────────────────
// Used by both REST and socket broadcasts
// Tries CouchDB first (authoritative), falls back to peaksLog JSON
// ── P-class thresholds — persisted to file so they survive restarts ───────
const THRESHOLDS_FILE = path.join(__dirname, 'thresholds.json');

function loadThresholds() {
    try {
        if (fs.existsSync(THRESHOLDS_FILE))
            return JSON.parse(fs.readFileSync(THRESHOLDS_FILE, 'utf8'));
    } catch (e) { console.error('thresholds.json read error:', e.message); }
    return { p1Min: 5, p1Max: 10, p2Min: 10, p2Max: 20, p3Min: 20 };
}

function saveThresholds(t) {
    try { fs.writeFileSync(THRESHOLDS_FILE, JSON.stringify(t, null, 2)); }
    catch (e) { console.error('thresholds.json write error:', e.message); }
}

let pClassThresholds = loadThresholds();
console.log('[thresholds] Loaded:', pClassThresholds);

function getPClass(peakG) {
    if (peakG == null) return null;
    const g = +peakG;
    if (g >= pClassThresholds.p3Min)                                    return 'P3';
    if (g >= pClassThresholds.p2Min && g < pClassThresholds.p2Max)      return 'P2';
    if (g >= pClassThresholds.p1Min && g < pClassThresholds.p1Max)      return 'P1';
    return null; // below minimum threshold
}

// GET /api/thresholds
app.get('/api/thresholds', (req, res) => res.json(pClassThresholds));

// POST /api/thresholds  body: { p1Min, p1Max, p2Min, p2Max, p3Min }
app.post('/api/thresholds', (req, res) => {
    const { p1Min, p1Max, p2Min, p2Max, p3Min } = req.body;
    if ([p1Min, p1Max, p2Min, p2Max, p3Min].some(v => v == null || isNaN(v)))
        return res.status(400).json({ error: 'All threshold values required' });
    pClassThresholds = { p1Min: +p1Min, p1Max: +p1Max, p2Min: +p2Min, p2Max: +p2Max, p3Min: +p3Min };
    saveThresholds(pClassThresholds);
    console.log('[thresholds] Updated and saved:', pClassThresholds);
    // Broadcast to all connected clients so dashboards update live
    io.emit('thresholds-updated', pClassThresholds);
    res.json({ success: true, thresholds: pClassThresholds });
});

// ── Last health status (kept in memory, served via /api/latest/health) ───
let lastHealthStatus = null;


// Increments when GPS data arrives with a new coordinate
// 0 when system is static
let totalDistanceM = 0;
let lastGpsCoord   = null; // { lat, lng } — used to calculate delta distance

// ── computeStats ──────────────────────────────────────────────────────────
async function computeStats(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();

    // ── CouchDB path ──────────────────────────────────────────────────────
    if (accelerometerEventsDB) {
        try {
            const all  = await accelerometerEventsDB.list({ include_docs: true });
            const docs = all.rows
                .map(r => r.doc)
                .filter(d => d && d.timestamp && d.timestamp >= cutoff && !d._id.startsWith('_'))
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // newest first

            if (docs.length > 0 || all.rows.length > 0) {
                const peaks   = docs.map(d => d.peak_g || 0);
                const lastDoc = docs[0]; // most recent impact
                const stats   = {
                    total:              docs.length,
                    highSeverity:       docs.filter(d => d.severity === 'HIGH').length,
                    medium:             docs.filter(d => d.severity === 'MEDIUM').length,
                    low:                docs.filter(d => d.severity === 'LOW').length,
                    maxPeak:            peaks.length ? Math.max(...peaks) : 0,
                    avgPeak:            peaks.length ? peaks.reduce((a,b) => a+b,0) / peaks.length : 0,
                    lastPeak:           lastDoc ? (lastDoc.peak_g || 0) : 0,
                    lastPeakClass:      lastDoc ? (getPClass(lastDoc.peak_g) || '—') : '—',
                    lastPeakTimestamp:  lastDoc ? lastDoc.timestamp : null,
                    lastPeakSensor:     lastDoc ? lastDoc.sensor    : null,
                    totalDistanceM,
                    source: 'couchdb'
                };
                console.log(`[stats] CouchDB: ${stats.total} impacts, lastPeak=${stats.lastPeak}g (${stats.lastPeakClass})`);
                return stats;
            }
        } catch (e) {
            console.error('[stats] CouchDB failed, falling back to JSON:', e.message);
        }
    }

    // ── JSON fallback ─────────────────────────────────────────────────────
    const recent  = peaksLog
        .filter(p => p.timestamp >= cutoff)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const peaks   = recent.map(p => p.peak_g || 0);
    const lastDoc = recent[0];
    const stats   = {
        total:              recent.length,
        highSeverity:       recent.filter(p => p.severity === 'HIGH').length,
        medium:             recent.filter(p => p.severity === 'MEDIUM').length,
        low:                recent.filter(p => p.severity === 'LOW').length,
        maxPeak:            peaks.length ? Math.max(...peaks) : 0,
        avgPeak:            peaks.length ? peaks.reduce((a,b) => a+b,0) / peaks.length : 0,
        lastPeak:           lastDoc ? (lastDoc.peak_g || 0) : 0,
        lastPeakClass:      lastDoc ? (getPClass(lastDoc.peak_g) || '—') : '—',
        lastPeakTimestamp:  lastDoc ? lastDoc.timestamp : null,
        lastPeakSensor:     lastDoc ? lastDoc.sensor    : null,
        totalDistanceM,
        source: 'json_fallback'
    };
    console.log(`[stats] JSON: ${stats.total} impacts, lastPeak=${stats.lastPeak}g (${stats.lastPeakClass})`);
    return stats;
}

// ── API endpoints ─────────────────────────────────────────────────────────
app.get('/api/impacts/stats', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const stats = await computeStats(hours);
        res.json(stats);
    } catch (e) {
        console.error('/api/impacts/stats error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/latest/sensor ────────────────────────────────────────────────
// Returns last recorded reading for each sensor side from monitoring_data
// Used to pre-populate the UI on page load before live data arrives
app.get('/api/latest/sensor', async (req, res) => {
    try {
        const result = { left: null, right: null };

        if (monitoringDataDB) {
            // Fetch last 200 docs and pick the most recent per side
            const all  = await monitoringDataDB.list({ include_docs: true, descending: true, limit: 200 });
            const docs = all.rows.map(r => r.doc).filter(d => d && d.timestamp);

            for (const doc of docs) {
                const side = doc.device_id;
                if ((side === 'left'  || side === 'right') && !result[side]) {
                    result[side] = {
                        sensor:    side,
                        x:         doc.x_axis   ?? 0,
                        y:         doc.y_axis   ?? 0,
                        z:         doc.z_axis   ?? 0,
                        rmsV:      doc.rmsV,
                        rmsL:      doc.rmsL,
                        sdV:       doc.sdV,
                        sdL:       doc.sdL,
                        p2pV:      doc.p2pV,
                        p2pL:      doc.p2pL,
                        peak:      doc.peak,
                        gForce:    doc.gForce,
                        fs:        doc.fs,
                        window:    doc.window_ms,
                        timestamp: doc.timestamp
                    };
                }
                if (result.left && result.right) break;
            }
        }

        // Fallback: use peaksLog for last known values
        if (!result.left || !result.right) {
            const sorted = [...peaksLog].sort((a,b) => b.timestamp.localeCompare(a.timestamp));
            for (const p of sorted) {
                if ((p.sensor === 'left'  || p.sensor === 'right') && !result[p.sensor]) {
                    result[p.sensor] = {
                        sensor: p.sensor, x: p.x ?? 0, y: p.y ?? 0, z: p.z ?? 0,
                        rmsV: p.rmsV, rmsL: p.rmsL, sdV: p.sdV, sdL: p.sdL,
                        p2pV: p.p2pV, p2pL: p.p2pL, peak: p.peak_g,
                        gForce: p.gForce, timestamp: p.timestamp
                    };
                }
                if (result.left && result.right) break;
            }
        }

        res.json(result);
    } catch (e) {
        console.error('/api/latest/sensor error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ── GET /api/latest/health ────────────────────────────────────────────────
// Returns the most recent system health status (stored in memory from MQTT)
// On server restart we have no history, so returns null if never received
app.get('/api/latest/health', (req, res) => {
    res.json(lastHealthStatus);
});

// ── GET /api/history/sensor ───────────────────────────────────────────────
// Returns last N monitoring_data points for graph pre-population
// Includes both left and right, sorted by timestamp ascending
app.get('/api/history/sensor', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    try {
        if (monitoringDataDB) {
            const all  = await monitoringDataDB.list({ include_docs: true, descending: true, limit: limit * 2 });
            const docs = all.rows
                .map(r => r.doc)
                .filter(d => d && d.timestamp && !d._id?.startsWith('_'))
                .sort((a, b) => a.timestamp.localeCompare(b.timestamp)) // ascending
                .slice(-limit);

            return res.json(docs.map(d => ({
                sensor:    d.device_id,
                x:         d.x_axis   ?? 0,
                y:         d.y_axis   ?? 0,
                z:         d.z_axis   ?? 0,
                rmsV:      d.rmsV,
                rmsL:      d.rmsL,
                gForce:    d.gForce,
                timestamp: d.timestamp
            })));
        }
    } catch (e) {
        console.error('/api/history/sensor error:', e.message);
    }
    res.json([]);
});

app.get('/api/impacts', async (req, res) => {
    try {
        if (accelerometerEventsDB) {
            const response = await accelerometerEventsDB.list(
                { include_docs: true, descending: true, limit: 200 });
            const docs = response.rows.map(r => r.doc).filter(d => d && !d._id?.startsWith('_'));
            if (docs.length) return res.json(docs);
        }
    } catch (e) { console.error('/api/impacts error:', e.message); }
    res.json([...peaksLog].reverse().slice(0, 200));
});

app.get('/api/historical/graph/:hours', async (req, res) => {
    try {
        const hours     = parseInt(req.params.hours) || 24;
        const timeLimit = new Date(Date.now() - hours * 3600000).toISOString();
        const response  = await monitoringDataDB.find({
            selector: { timestamp: { $gte: timeLimit } },
            sort:     [{ timestamp: 'asc' }],
            limit:    2000
        });
        res.json(response.docs.map((doc, i) => ({
            distance: i * 100,
            accel1: doc.x_axis   || 0,
            accel2: doc.y_axis   || 0,
            magnitude: doc.z_axis || 0,
            timestamp: doc.timestamp,
            rmsV: doc.rmsV, rmsL: doc.rmsL,
            sdV:  doc.sdV,  sdL:  doc.sdL,
            p2pV: doc.p2pV, p2pL: doc.p2pL
        })));
    } catch (e) {
        console.error('/api/historical/graph error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/realtime/status', (req, res) => {
    res.json({
        connected:          mqttConnected,
        receiving_data:     mqttConnected && lastDataTimestamp && (Date.now() - lastDataTimestamp < 10000),
        last_data_received: lastDataTimestamp,
        time_since_last:    lastDataTimestamp ? Math.floor((Date.now() - lastDataTimestamp) / 1000) : null
    });
});

app.get('/health', async (req, res) => {
    try {
        const dbs = await nano.db.list();
        res.json({ status: 'OK', timestamp: new Date(), couchdb: 'connected',
                   databases: dbs, mqtt: mqttConnected, last_data: lastDataTimestamp });
    } catch (e) {
        res.json({ status: 'ERROR', timestamp: new Date(), couchdb: 'disconnected', error: e.message });
    }
});

app.get('/api', (req, res) => {
    res.json({ message: 'Railway Monitoring API', endpoints: {
        impacts:          'GET /api/impacts',
        impacts_stats:    'GET /api/impacts/stats?hours=24',
        historical_graph: 'GET /api/historical/graph/:hours',
        realtime_status:  'GET /api/realtime/status',
        health:           'GET /health'
    }});
});

// ── WebSocket ─────────────────────────────────────────────────────────────
io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    // Send historical chart data
    try {
        const timeLimit = new Date(Date.now() - 86400000).toISOString();
        const response  = await monitoringDataDB.find({
            selector: { timestamp: { $gte: timeLimit } },
            sort: [{ timestamp: 'asc' }], limit: 2000
        });
        socket.emit('historical-data', response.docs.map((doc, i) => ({
            distance: i * 100,
            accel1: doc.x_axis || 0, accel2: doc.y_axis || 0,
            magnitude: doc.z_axis || 0, timestamp: doc.timestamp,
            rmsV: doc.rmsV, rmsL: doc.rmsL,
            sdV: doc.sdV,   sdL: doc.sdL,
            p2pV: doc.p2pV, p2pL: doc.p2pL
        })));
    } catch (e) {
        console.error('sendHistoricalData error:', e.message);
        socket.emit('historical-data', []);
    }

    // Send current stats immediately on connect so frontend shows correct counts
    try {
        const stats = await computeStats(24);
        socket.emit('stats-update', stats);
        console.log(`Sent stats to ${socket.id}: total=${stats.total}`);
    } catch (e) {
        console.error('stats-update on connect error:', e.message);
    }

    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// ── MQTT handler ──────────────────────────────────────────────────────────
mqttClient.on('error', err => { console.error('MQTT error:', err.message); mqttConnected = false; });
mqttClient.on('close', ()  => { console.warn('MQTT closed'); mqttConnected = false; });

mqttClient.on('connect', () => {
    console.log(`MQTT Connected to ${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`);
    mqttConnected = true;
    [
        'adj/datalogger/sensors/left',
        'adj/datalogger/sensors/right',
        'adj/datalogger/health',
        'adj/datalogger/sensors/accelerometer',
        'sensor/railway/accelerometer/#',
        'sensor/accelerometer/#',
        'sensor/gps/#'
    ].forEach(topic => {
        mqttClient.subscribe(topic, err => {
            if (err) console.error(`Subscribe failed ${topic}:`, err.message);
            else     console.log(`Subscribed: ${topic}`);
        });
    });
});

mqttClient.on('message', async (topic, message) => {
    try {
        const msgStr    = message.toString();
        const timestamp = new Date().toISOString();
        lastDataTimestamp = Date.now();

        console.log(`\n=== Received on: ${topic} ===`);
        console.log(`Raw: ${msgStr.substring(0, 200)}`);

        // ── Health topic ──────────────────────────────────────────────────
        if (topic === 'adj/datalogger/health') {
            const health = parseHealthMessage(msgStr);
            lastHealthStatus = health; // persist for /api/latest/health
            console.log('Health:', health);
            io.emit('system-health', health);
            return;
        }

        // ── Sensor topics only ────────────────────────────────────────────
        const sensorSide = topic.includes('right') ? 'right'
                         : topic.includes('left')  ? 'left' : null;
        if (!sensorSide) return;

        // Parse axes
        const ax = msgStr.match(/Ax\s*:\s*([+-]?\d+\.?\d*)/i);
        const ay = msgStr.match(/Ay\s*:\s*([+-]?\d+\.?\d*)/i);
        const az = msgStr.match(/Az\s*:\s*([+-]?\d+\.?\d*)/i);
        const xm = msgStr.match(/X=([+-]?\d+\.?\d*)/);
        const ym = msgStr.match(/Y=([+-]?\d+\.?\d*)/);
        const zm = msgStr.match(/Z=([+-]?\d+\.?\d*)/);

        const x = ax ? parseFloat(ax[1]) : (xm ? parseFloat(xm[1]) : 0);
        const y = ay ? parseFloat(ay[1]) : (ym ? parseFloat(ym[1]) : 0);
        const z = az ? parseFloat(az[1]) : (zm ? parseFloat(zm[1]) : 0);

        const rmsVm = msgStr.match(/RMS-V\s*:\s*([+-]?\d+\.?\d*)/i);
        const rmsLm = msgStr.match(/RMS-L\s*:\s*([+-]?\d+\.?\d*)/i);
        const sdVm  = msgStr.match(/SD-V\s*:\s*([+-]?\d+\.?\d*)/i);
        const sdLm  = msgStr.match(/SD-L\s*:\s*([+-]?\d+\.?\d*)/i);
        const p2pVm = msgStr.match(/P2P-V\s*:\s*([+-]?\d+\.?\d*)/i);
        const p2pLm = msgStr.match(/P2P-L\s*:\s*([+-]?\d+\.?\d*)/i);
        const pkm   = msgStr.match(/PEAK\s*:\s*([+-]?\d+\.?\d*)/i);
        const fsm   = msgStr.match(/FS\s*:\s*(\d+)/i);
        const winm  = msgStr.match(/WINDOW\s*:\s*(\d+)/i);

        const rmsV = rmsVm ? parseFloat(rmsVm[1]) : null;
        const rmsL = rmsLm ? parseFloat(rmsLm[1]) : null;
        const sdV  = sdVm  ? parseFloat(sdVm[1])  : null;
        const sdL  = sdLm  ? parseFloat(sdLm[1])  : null;
        const p2pV = p2pVm ? parseFloat(p2pVm[1]) : null;
        const p2pL = p2pLm ? parseFloat(p2pLm[1]) : null;
        const peak = pkm   ? parseFloat(pkm[1])   : null;
        const fs   = fsm   ? parseInt(fsm[1])      : null;
        const win  = winm  ? parseInt(winm[1])     : null;

        const gForce = Math.sqrt(x**2 + y**2 + z**2);

        console.log(`Parsed [${sensorSide}]: x=${x} y=${y} z=${z} peak=${peak} gForce=${gForce.toFixed(4)}`);

        // ── Store in monitoring_data ──────────────────────────────────────
        if (monitoringDataDB) {
            monitoringDataDB.insert({
                timestamp, type: 'accelerometer', device_id: sensorSide,
                x_axis: x, y_axis: y, z_axis: z, gForce,
                rmsV, rmsL, sdV, sdL, p2pV, p2pL, peak, fs, window_ms: win
            }).catch(e => console.error('monitoring_data insert:', e.message));
        }

        if (realtimeDataDB) {
            realtimeDataDB.insert({
                timestamp, sensor: sensorSide,
                x, y, z, gForce, rmsV, rmsL, sdV, sdL, p2pV, p2pL, peak
            }).catch(e => console.error('realtime_data insert:', e.message));
        }

        // ── Impact detection ──────────────────────────────────────────────
        const peakVal = peak || gForce;
        if (peakVal > 2) {
            const severity  = peakVal > 15 ? 'HIGH' : peakVal > 5 ? 'MEDIUM' : 'LOW';
            const pClass    = getPClass(peakVal);
            const impact    = {
                timestamp, sensor: sensorSide, severity, peak_g: peakVal, gForce,
                rmsV, rmsL, sdV, sdL, p2pV, p2pL, x, y, z, fs, window_ms: win,
                distance_m: totalDistanceM,   // 0 when static, real value when GPS active
                p_class:    pClass            // P1 / P2 / P3 / null
            };

            // Save to JSON fallback (always reliable)
            peaksLog.push(impact);
            savePeaksLog(peaksLog);

            // Save to CouchDB
            if (accelerometerEventsDB) {
                accelerometerEventsDB.insert(impact)
                    .catch(e => console.error('accelerometerEvents insert:', e.message));
            }

            // Broadcast impact event
            io.emit('new-impact', impact);
            console.log(`IMPACT: ${peakVal.toFixed(3)}g (${severity}) on ${sensorSide}`);

            // ── Broadcast fresh stats to ALL connected clients immediately ──
            // This is what keeps the counters live without polling
            computeStats(24).then(stats => {
                io.emit('stats-update', stats);
                console.log(`[stats-update] broadcast: total=${stats.total} max=${stats.maxPeak.toFixed(2)}g source=${stats.source}`);
            }).catch(e => console.error('stats broadcast error:', e.message));
        }

        // Broadcast raw sensor data
        io.emit('accelerometer-data', {
            sensor: sensorSide, x, y, z, gForce,
            rmsV, rmsL, sdV, sdL, p2pV, p2pL, peak, timestamp
        });

        console.log(`Broadcast: X=${x}, Y=${y}, Z=${z}, gForce=${gForce.toFixed(4)}g`);

    } catch (error) {
        console.error('MQTT message error:', error);
    }
});

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local IP: ${LOCAL_IP}`);
    console.log(`Frontend: http://${LOCAL_IP}:${PORT}/index.html`);

    console.log(`CouchDB:  http://127.0.0.1:5984/_utils/`);
});

// ── Reset endpoint ────────────────────────────────────────────────────────
// POST /api/reset
// Body: { saveToDb: true }  → keep CouchDB, reset display only (peaksLog cleared)
// Body: { saveToDb: false } → wipe CouchDB + peaksLog, everything back to 0
app.post('/api/reset', async (req, res) => {
    const saveToDb = req.body?.saveToDb === true;
    console.log(`[reset] requested — saveToDb=${saveToDb}`);

    try {
        if (!saveToDb) {
            // ── Wipe CouchDB databases ────────────────────────────────────
            const dbsToClear = [
                { name: 'accelerometer_events', ref: () => accelerometerEventsDB },
                { name: 'monitoring_data',       ref: () => monitoringDataDB      },
                { name: 'realtime_data',         ref: () => realtimeDataDB        }
            ];

            for (const db of dbsToClear) {
                try {
                    // Drop and recreate — fastest way to clear all docs
                    await nano.db.destroy(db.name);
                    await nano.db.create(db.name);
                    console.log(`[reset] Cleared DB: ${db.name}`);
                } catch (e) {
                    console.error(`[reset] Failed to clear ${db.name}:`, e.message);
                }
            }

            // Re-assign DB handles after recreate
            accelerometerEventsDB = nano.use('accelerometer_events');
            monitoringDataDB      = nano.use('monitoring_data');
            realtimeDataDB        = nano.use('realtime_data');

            // Recreate indexes
            await ensureIndex(accelerometerEventsDB, ['timestamp'],            'idx-timestamp');
            await ensureIndex(accelerometerEventsDB, ['timestamp','severity'], 'idx-timestamp-severity');
            await ensureIndex(monitoringDataDB,      ['timestamp'],            'idx-timestamp');

            // Wipe JSON fallback file
            peaksLog = [];
            savePeaksLog(peaksLog);
            console.log('[reset] JSON fallback cleared');
        }

        // Always broadcast zero stats to all clients
        const zeroStats = { total: 0, highSeverity: 0, medium: 0, low: 0, maxPeak: 0, avgPeak: 0, source: 'reset' };
        io.emit('stats-update', zeroStats);
        io.emit('display-reset', { saveToDb });

        console.log(`[reset] Complete — saveToDb=${saveToDb}`);
        res.json({ success: true, saveToDb, message: saveToDb ? 'Display reset — DB preserved' : 'Full reset — DB cleared' });

    } catch (e) {
        console.error('[reset] Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── CSV Export endpoint ───────────────────────────────────────────────────
// GET /api/impacts/export/csv?hours=24
// Returns a properly formatted CSV matching the impact_report.csv structure
// Columns: timestamp,sensor,severity,peak_g,gForce,rmsV,rmsL,sdV,sdL,p2pV,p2pL,x,y,z,fs,window_ms
app.get('/api/impacts/export/csv', async (req, res) => {
    const hours  = parseInt(req.query.hours) || 24;
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();

    let docs = [];

    // Try CouchDB first
    if (accelerometerEventsDB) {
        try {
            const all = await accelerometerEventsDB.list({ include_docs: true });
            docs = all.rows
                .map(r => r.doc)
                .filter(d => d && d.timestamp && d.timestamp >= cutoff && !d._id?.startsWith('_'))
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // newest first
        } catch (e) {
            console.error('[csv] CouchDB read failed, using JSON fallback:', e.message);
        }
    }

    // Fallback to peaks_log.json
    if (!docs.length) {
        docs = peaksLog
            .filter(p => p.timestamp >= cutoff)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    console.log(`[csv] Exporting ${docs.length} records for last ${hours}h`);

    // Build CSV
    const headers = [
        'timestamp', 'sensor', 'severity', 'p_class',
        'peak_g', 'gForce', 'rmsV', 'rmsL', 'sdV', 'sdL', 'p2pV', 'p2pL',
        'x', 'y', 'z', 'fs', 'window_ms', 'distance_m'
    ];

    const fmt = v => (v == null || v === undefined) ? '' : String(v);

    const rows = docs.map(d => [
        fmt(d.timestamp),
        fmt(d.sensor),
        fmt(d.severity),
        fmt(d.p_class   || getPClass(d.peak_g) || ''),
        fmt(d.peak_g    != null ? (+d.peak_g).toFixed(6)  : ''),
        fmt(d.gForce    != null ? (+d.gForce).toFixed(6)  : ''),
        fmt(d.rmsV      != null ? (+d.rmsV).toFixed(3)    : ''),
        fmt(d.rmsL      != null ? (+d.rmsL).toFixed(3)    : ''),
        fmt(d.sdV       != null ? (+d.sdV).toFixed(3)     : ''),
        fmt(d.sdL       != null ? (+d.sdL).toFixed(3)     : ''),
        fmt(d.p2pV      != null ? (+d.p2pV).toFixed(3)    : ''),
        fmt(d.p2pL      != null ? (+d.p2pL).toFixed(3)    : ''),
        fmt(d.x         != null ? (+d.x).toFixed(3)       : ''),
        fmt(d.y         != null ? (+d.y).toFixed(3)       : ''),
        fmt(d.z         != null ? (+d.z).toFixed(3)       : ''),
        fmt(d.fs        != null ? d.fs                     : ''),
        fmt(d.window_ms != null ? d.window_ms              : ''),
        fmt(d.distance_m != null ? d.distance_m            : '0')
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    // Filename: impact_report_YYYY-MM-DD.csv
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `impact_report_${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.send(csv);
});
