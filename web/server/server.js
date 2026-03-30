require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mqtt = require("mqtt");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { DateTime } = require("luxon"); 

// ── Timezone configuration (change as needed) ─────────────────────────────
const TIMEZONE = "Asia/Kolkata";

function getTimezoneTimestamp() {
return DateTime.now().setZone(TIMEZONE).toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS");
}

// Returns a cutoff timestamp in IST format (no Z) to compare against stored timestamps
function getISTCutoff(msAgo) {
    return DateTime.now().setZone(TIMEZONE).minus(msAgo).toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS");
}

// ── Persistent JSON fallback ──────────────────────────────────────────────
const PEAKS_LOG_FILE = path.join(__dirname, "peaks_log.json");

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "127.0.0.1";
}

const LOCAL_IP = getLocalIP();

function loadPeaksLog() {
  try {
    if (fs.existsSync(PEAKS_LOG_FILE))
      return JSON.parse(fs.readFileSync(PEAKS_LOG_FILE, "utf8"));
  } catch (e) {
    console.error("peaks_log.json read error:", e.message);
  }
  return [];
}
function savePeaksLog(log) {
  try {
    fs.writeFileSync(PEAKS_LOG_FILE, JSON.stringify(log, null, 2));
  } catch (e) {
    console.error("peaks_log.json write error:", e.message);
  }
}

let peaksLog = loadPeaksLog();
console.log(
  `Loaded ${peaksLog.length} existing impact records from JSON fallback`,
);

// ── Express / Socket.IO ───────────────────────────────────────────────────
const COUCHDB_URL = `http://${process.env.COUCHDB_USER}:${process.env.COUCHDB_PASS}@${process.env.COUCHDB_HOST}:${process.env.COUCHDB_PORT}`;
const nano = require("nano")(COUCHDB_URL);
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

// ── Descending time‑based ID (newer data → smaller ID) ───────────────────
const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 9007199254740991
let lastIdTimestamp = 0;
let idCounter = 0;

function generateDescendingId() {
  const now = Date.now();
  // Use a high base (e.g., 10^16) to make newer IDs smaller
  const base = 1e16; // 10000000000000000
  const desc = base - now; // newer → smaller number
  // Pad to 16 digits
  const descStr = String(Math.floor(desc)).padStart(16, '0');
  // Handle multiple docs in same ms
  if (desc === lastIdTimestamp) {
    idCounter++;
  } else {
    idCounter = 0;
    lastIdTimestamp = desc;
  }
  return `${descStr}-${String(idCounter).padStart(3, '0')}`;
}
// ── CouchDB setup + index creation ───────────────────────────────────────
let accelerometerEventsDB, monitoringDataDB, realtimeDataDB;
let dbReady = false;  // flag to know when databases are ready

async function ensureIndex(db, fields, name) {
  try {
    await db.createIndex({
      index: { fields },
      name,
      type: "json",
    });
    console.log(`Index '${name}' ready`);
  } catch (e) {
    if (!e.message?.includes("exists"))
      console.error(`Index '${name}' error:`, e.message);
  }
}

const initCouchDB = async () => {
  try {
    await nano.db.list();
    console.log("Connected to CouchDB");

    for (const name of [
      "accelerometer_events",
      "monitoring_data",
      "realtime_data",
    ]) {
      try {
        await nano.db.get(name);
      } catch (e) {
        await nano.db.create(name);
        console.log(`Created ${name}`);
      }
    }
    accelerometerEventsDB = nano.use("accelerometer_events");
    monitoringDataDB = nano.use("monitoring_data");
    realtimeDataDB = nano.use("realtime_data");

    await ensureIndex(accelerometerEventsDB, ["timestamp"], "idx-timestamp");
    await ensureIndex(
      accelerometerEventsDB,
      ["timestamp", "severity"],
      "idx-timestamp-severity",
    );
    await ensureIndex(monitoringDataDB, ["timestamp"], "idx-timestamp");
    await ensureIndex(realtimeDataDB, ["timestamp"], "idx-timestamp");
    await ensureIndex(
      realtimeDataDB,
      ["sensor", "timestamp"],
      "idx-sensor-timestamp",
    );

    dbReady = true;
    console.log("All databases and indexes ready");
  } catch (error) {
    console.error("CouchDB initialization error:", error);
    // keep dbReady = false, will retry later? We'll just keep it false.
  }
};

// ── MQTT ──────────────────────────────────────────────────────────────────
let lastDataTimestamp = null;
let mqttConnected = false;
let mqttClient = null; // will be created after DB is ready

// In-memory sensor tracking — updated on every MQTT message
const sensorLastSeen = {}; // { left: Date.now(), right: Date.now() }

// Health parser
function parseHealthMessage(msgStr) {
  const get = (pattern) => {
    const m = msgStr.match(pattern);
    if (!m) return "UNKNOWN";
    return m[1].trim().toUpperCase() === "OK" ? "OK" : "FAIL";
  };
  return {
    usart2: get(/USART2\s*:\s*(OK|FAIL)/i),
    spi1: get(/SPI1\s*:\s*(OK|FAIL)/i),
    adxl345_s1: get(/ADXL345\s+S1\s*:\s*(OK|FAIL)/i),
    adxl345_s2: get(/ADXL345\s+S2\s*:\s*(OK|FAIL)/i),
    w5500: get(/W5500\s*:\s*(OK|FAIL)/i),
    phyLink: get(/PHY\s*Link\s*:\s*(OK|FAIL)/i),
    tcp: get(/TCP\s*:\s*(OK|FAIL)/i),
    timestamp: getTimezoneTimestamp(),
    raw: msgStr.trim(),
  };
}

// ── Stats helper & thresholds ─────────────────────────────────────────────
const THRESHOLDS_FILE = path.join(__dirname, "thresholds.json");

function loadThresholds() {
  try {
    if (fs.existsSync(THRESHOLDS_FILE))
      return JSON.parse(fs.readFileSync(THRESHOLDS_FILE, "utf8"));
  } catch (e) {
    console.error("thresholds.json read error:", e.message);
  }
  return { p1Min: 5, p1Max: 10, p2Min: 10, p2Max: 20, p3Min: 20 };
}

function saveThresholds(t) {
  try {
    fs.writeFileSync(THRESHOLDS_FILE, JSON.stringify(t, null, 2));
  } catch (e) {
    console.error("thresholds.json write error:", e.message);
  }
}

let pClassThresholds = loadThresholds();
console.log("[thresholds] Loaded:", pClassThresholds);

function getPClass(peakG) {
  if (peakG == null) return null;
  const g = +peakG;
  if (g >= pClassThresholds.p3Min) return "P3";
  if (g >= pClassThresholds.p2Min && g < pClassThresholds.p2Max) return "P2";
  if (g >= pClassThresholds.p1Min && g < pClassThresholds.p1Max) return "P1";
  return null;
}

app.get("/api/thresholds", (req, res) => res.json(pClassThresholds));
app.post("/api/thresholds", (req, res) => {
  const { p1Min, p1Max, p2Min, p2Max, p3Min } = req.body;
  if ([p1Min, p1Max, p2Min, p2Max, p3Min].some((v) => v == null || isNaN(v)))
    return res.status(400).json({ error: "All threshold values required" });
  pClassThresholds = {
    p1Min: +p1Min,
    p1Max: +p1Max,
    p2Min: +p2Min,
    p2Max: +p2Max,
    p3Min: +p3Min,
  };
  saveThresholds(pClassThresholds);
  console.log("[thresholds] Updated and saved:", pClassThresholds);
  io.emit("thresholds-updated", pClassThresholds);
  res.json({ success: true, thresholds: pClassThresholds });
});

let lastHealthStatus = null;
let totalDistanceM = 0;
let lastGpsCoord = null;

// ── computeStats (unchanged) ─────────────────────────────────────────────
async function computeStats(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 3600000).toISOString();

  if (accelerometerEventsDB && dbReady) {
    try {
      const all = await accelerometerEventsDB.list({ include_docs: true });
      const docs = all.rows
        .map((r) => r.doc)
        .filter(
          (d) =>
            d && d.timestamp && d.timestamp >= cutoff && !d._id.startsWith("_"),
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      if (docs.length > 0 || all.rows.length > 0) {
        const peaks = docs.map((d) => d.peak_g || 0);
        const lastDoc = docs[0];
        const stats = {
          total: docs.length,
          highSeverity: docs.filter((d) => d.severity === "HIGH").length,
          medium: docs.filter((d) => d.severity === "MEDIUM").length,
          low: docs.filter((d) => d.severity === "LOW").length,
          maxPeak: peaks.length ? Math.max(...peaks) : 0,
          avgPeak: peaks.length
            ? peaks.reduce((a, b) => a + b, 0) / peaks.length
            : 0,
          lastPeak: lastDoc ? lastDoc.peak_g || 0 : 0,
          lastPeakClass: lastDoc ? getPClass(lastDoc.peak_g) || "—" : "—",
          lastPeakTimestamp: lastDoc ? lastDoc.timestamp : null,
          lastPeakSensor: lastDoc ? lastDoc.sensor : null,
          totalDistanceM,
          source: "couchdb",
        };
        console.log(
          `[stats] CouchDB: ${stats.total} impacts, lastPeak=${stats.lastPeak}g (${stats.lastPeakClass})`,
        );
        return stats;
      }
    } catch (e) {
      console.error("[stats] CouchDB failed, falling back to JSON:", e.message);
    }
  }

  // JSON fallback
  const recent = peaksLog
    .filter((p) => p.timestamp >= cutoff)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const peaks = recent.map((p) => p.peak_g || 0);
  const lastDoc = recent[0];
  const stats = {
    total: recent.length,
    highSeverity: recent.filter((p) => p.severity === "HIGH").length,
    medium: recent.filter((p) => p.severity === "MEDIUM").length,
    low: recent.filter((p) => p.severity === "LOW").length,
    maxPeak: peaks.length ? Math.max(...peaks) : 0,
    avgPeak: peaks.length ? peaks.reduce((a, b) => a + b, 0) / peaks.length : 0,
    lastPeak: lastDoc ? lastDoc.peak_g || 0 : 0,
    lastPeakClass: lastDoc ? getPClass(lastDoc.peak_g) || "—" : "—",
    lastPeakTimestamp: lastDoc ? lastDoc.timestamp : null,
    lastPeakSensor: lastDoc ? lastDoc.sensor : null,
    totalDistanceM,
    source: "json_fallback",
  };
  console.log(
    `[stats] JSON: ${stats.total} impacts, lastPeak=${stats.lastPeak}g (${stats.lastPeakClass})`,
  );
  return stats;
}

// ── API endpoints (unchanged, just ensure they use dbReady if needed) ─────
app.get("/api/impacts/stats", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const stats = await computeStats(hours);
    res.json(stats);
  } catch (e) {
    console.error("/api/impacts/stats error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/latest/sensor", async (req, res) => {
  try {
    const result = { left: null, right: null };
    if (monitoringDataDB && dbReady) {
      const all = await monitoringDataDB.list({
        include_docs: true,
        descending: true,
        limit: 200,
      });
      const docs = all.rows.map((r) => r.doc).filter((d) => d && d.timestamp);
      for (const doc of docs) {
        const side = doc.device_id;
        if ((side === "left" || side === "right") && !result[side]) {
          result[side] = {
            sensor: side,
            x: doc.x_axis ?? 0,
            y: doc.y_axis ?? 0,
            z: doc.z_axis ?? 0,
            rmsV: doc.rmsV,
            rmsL: doc.rmsL,
            sdV: doc.sdV,
            sdL: doc.sdL,
            p2pV: doc.p2pV,
            p2pL: doc.p2pL,
            peak: doc.peak,
            gForce: doc.gForce,
            fs: doc.fs,
            window: doc.window_ms,
            timestamp: doc.timestamp,
          };
        }
        if (result.left && result.right) break;
      }
    }
    if (!result.left || !result.right) {
      const sorted = [...peaksLog].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
      );
      for (const p of sorted) {
        if (
          (p.sensor === "left" || p.sensor === "right") &&
          !result[p.sensor]
        ) {
          result[p.sensor] = {
            sensor: p.sensor,
            x: p.x ?? 0,
            y: p.y ?? 0,
            z: p.z ?? 0,
            rmsV: p.rmsV,
            rmsL: p.rmsL,
            sdV: p.sdV,
            sdL: p.sdL,
            p2pV: p.p2pV,
            p2pL: p.p2pL,
            peak: p.peak_g,
            gForce: p.gForce,
            timestamp: p.timestamp,
          };
        }
        if (result.left && result.right) break;
      }
    }
    res.json(result);
  } catch (e) {
    console.error("/api/latest/sensor error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/latest/health", (req, res) => {
  res.json(lastHealthStatus);
});

app.get("/api/history/sensor", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  try {
    if (monitoringDataDB && dbReady) {
      const all = await monitoringDataDB.list({
        include_docs: true,
        descending: true,
        limit: limit * 2,
      });
      const docs = all.rows
        .map((r) => r.doc)
        .filter((d) => d && d.timestamp && !d._id?.startsWith("_"))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .slice(-limit);
      return res.json(
        docs.map((d) => ({
          sensor: d.device_id,
          x: d.x_axis ?? 0,
          y: d.y_axis ?? 0,
          z: d.z_axis ?? 0,
          rmsV: d.rmsV,
          rmsL: d.rmsL,
          gForce: d.gForce,
          timestamp: d.timestamp,
        })),
      );
    }
  } catch (e) {
    console.error("/api/history/sensor error:", e.message);
  }
  res.json([]);
});

app.get("/api/impacts", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 0;
    if (accelerometerEventsDB && dbReady) {
      const selector =
        hours > 0
          ? {
              timestamp: {
                $gte: new Date(Date.now() - hours * 3600000).toISOString(),
              },
            }
          : { timestamp: { $gt: "" } };
      const response = await accelerometerEventsDB.find({
        selector,
        sort: [{ timestamp: "desc" }],
        limit: 1000,
      });
      const docs = response.docs.filter((d) => d && !d._id?.startsWith("_"));
      if (docs.length) return res.json(docs);
    }
  } catch (e) {
    console.error("/api/impacts error:", e.message);
  }
  const fallback = [...peaksLog].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  if (hours > 0) {
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
    return res.json(
      fallback.filter((p) => p.timestamp >= cutoff).slice(0, 1000),
    );
  }
  res.json(fallback.slice(0, 1000));
});

app.get("/api/historical/graph/:hours", async (req, res) => {
  try {
    const hours = parseInt(req.params.hours) || 24;
    const timeLimit = new Date(Date.now() - hours * 3600000).toISOString();
    const response = await monitoringDataDB.find({
      selector: { timestamp: { $gte: timeLimit } },
      sort: [{ timestamp: "asc" }],
      limit: 2000,
    });
    res.json(
      response.docs.map((doc, i) => ({
        distance: i * 100,
        accel1: doc.x_axis || 0,
        accel2: doc.y_axis || 0,
        magnitude: doc.z_axis || 0,
        timestamp: doc.timestamp,
        rmsV: doc.rmsV,
        rmsL: doc.rmsL,
        sdV: doc.sdV,
        sdL: doc.sdL,
        p2pV: doc.p2pV,
        p2pL: doc.p2pL,
      })),
    );
  } catch (e) {
    console.error("/api/historical/graph error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/realtime/status", (req, res) => {
  res.json({
    connected: mqttConnected,
    receiving_data:
      mqttConnected &&
      lastDataTimestamp &&
      Date.now() - lastDataTimestamp < 10000,
    last_data_received: lastDataTimestamp,
    time_since_last: lastDataTimestamp
      ? Math.floor((Date.now() - lastDataTimestamp) / 1000)
      : null,
  });
});

// ── Management Dashboard APIs (unchanged) ─────────────────────────────────
app.get("/api/management/sensor-chart", async (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 24, 168);
  try {
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
    const all = await realtimeDataDB.find({
      selector: { timestamp: { $gte: cutoff } },
      fields: ["timestamp", "gForce"],
      limit: 10000,
    });
    const buckets = {};
    for (const doc of all.docs) {
      const h = doc.timestamp.slice(0, 13);
      if (!buckets[h]) buckets[h] = { sum: 0, count: 0 };
      buckets[h].sum += doc.gForce || 0;
      buckets[h].count += 1;
    }
    const now = new Date();
    const result = [];
    for (let i = hours - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const h = d.toISOString().slice(0, 13);
      const label = `${String(d.getHours()).padStart(2, "0")}:00`;
      const b = buckets[h];
      result.push({ label, avg: b ? +(b.sum / b.count).toFixed(4) : null });
    }
    res.json(result);
  } catch (e) {
    console.error("/api/management/sensor-chart error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/acceleration/channels", async (req, res) => {
  try {
    const minutes = Math.min(parseInt(req.query.minutes) || 2, 1440);
    const cutoff = new Date(Date.now() - minutes * 60000).toISOString();
    const all = await realtimeDataDB.find({
      selector: { timestamp: { $gte: cutoff } },
      fields: ["sensor", "x", "y", "z", "timestamp"],
      limit: 20000,
    });
    all.docs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const buckets = {};
    for (const doc of all.docs) {
      const sec = doc.timestamp.slice(0, 19);
      if (!buckets[sec])
        buckets[sec] = { ts: sec, lv: null, ll: null, rv: null, rl: null };
      if (doc.sensor === "left") {
        buckets[sec].lv = doc.z != null ? +doc.z.toFixed(4) : null;
        buckets[sec].ll = doc.x != null ? +doc.x.toFixed(4) : null;
      } else if (doc.sensor === "right") {
        buckets[sec].rv = doc.z != null ? +doc.z.toFixed(4) : null;
        buckets[sec].rl = doc.x != null ? +doc.x.toFixed(4) : null;
      }
    }
    res.json(Object.values(buckets).sort((a, b) => a.ts.localeCompare(b.ts)));
  } catch (e) {
    console.error("/api/acceleration/channels error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/management/sensor-chart-recent", async (_req, res) => {
  try {
    const cutoff = getISTCutoff(2 * 60000);
    const all = await realtimeDataDB.find({
      selector: { timestamp: { $gte: cutoff } },
      fields: ["sensor", "gForce", "timestamp"],
      limit: 5000,
    });
    all.docs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const buckets = {};
    for (const doc of all.docs) {
      const sec = doc.timestamp.slice(0, 19);
      if (!buckets[sec]) buckets[sec] = { ts: sec, left: null, right: null };
      buckets[sec][doc.sensor] = doc.gForce || 0;
    }
    const result = Object.values(buckets).sort((a, b) =>
      a.ts.localeCompare(b.ts),
    );
    res.json(result);
  } catch (e) {
    console.error("/api/management/sensor-chart-recent error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/management/uptime", async (req, res) => {
  const hours = 24;
  try {
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
    const all = await realtimeDataDB.find({
      selector: { timestamp: { $gte: cutoff } },
      fields: ["timestamp"],
      limit: 10000,
    });
    const activeHours = new Set(all.docs.map((d) => d.timestamp.slice(0, 13)));
    const pct = +((activeHours.size / hours) * 100).toFixed(1);
    res.json({
      uptime_pct: pct,
      active_hours: activeHours.size,
      window_hours: hours,
      server_uptime_s: Math.floor(process.uptime()),
    });
  } catch (e) {
    console.error("/api/management/uptime error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/management/active-sensors", (_req, res) => {
  const now = Date.now();
  const sensors = Object.keys(sensorLastSeen);
  const onlineSensors = sensors.filter((s) => now - sensorLastSeen[s] <= 5000);
  const knownSensors  = sensors.filter((s) => now - sensorLastSeen[s] >  5000);
  const lastSeenTs = {};
  sensors.forEach(s => lastSeenTs[s] = new Date(sensorLastSeen[s]).toISOString());
  res.json({
    count: onlineSensors.length,
    total_known: sensors.length,
    online: onlineSensors,
    last_known: knownSensors,
    last_seen: lastSeenTs,
  });
});

app.get("/api/management/active-alerts", async (req, res) => {
  try {
    const cutoff = getISTCutoff(24 * 3600000);
    const recent = peaksLog.filter((p) => p.timestamp >= cutoff);
    const high = recent.filter((p) => p.severity === "HIGH").length;
    const medium = recent.filter((p) => p.severity === "MEDIUM").length;
    const low = recent.filter((p) => p.severity === "LOW").length;
    res.json({
      total: recent.length,
      high,
      medium,
      low,
      require_attention: high + medium,
      latest: [...recent]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5),
    });
  } catch (e) {
    console.error("/api/management/active-alerts error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/management/system-health", async (req, res) => {
  try {
    const cutoff6h = getISTCutoff(6 * 3600000);
    const cutoff5m = getISTCutoff(5 * 60000);
    const all = await realtimeDataDB.find({
      selector: { timestamp: { $gte: cutoff6h } },
      fields: ["sensor", "gForce", "timestamp"],
      limit: 5000,
    });
    const latest = {};
    for (const doc of all.docs) {
      if (!latest[doc.sensor] || doc.timestamp > latest[doc.sensor].timestamp)
        latest[doc.sensor] = doc;
    }
    let operational = 0,
      warning = 0,
      critical = 0;
    for (const doc of Object.values(latest)) {
      const g = doc.gForce || 0;
      const isLive = doc.timestamp >= cutoff5m;
      if (!isLive) critical++;
      else if (g >= 15) critical++;
      else if (g >= 5) warning++;
      else operational++;
    }
    if (Object.keys(latest).length === 0) critical = 2;
    res.json({
      operational,
      warning,
      critical,
      total: operational + warning + critical,
    });
  } catch (e) {
    console.error("/api/management/system-health error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", async (req, res) => {
  try {
    const dbs = await nano.db.list();
    res.json({
      status: "OK",
      timestamp: getTimezoneTimestamp(),
      couchdb: "connected",
      databases: dbs,
      mqtt: mqttConnected,
      last_data: lastDataTimestamp,
    });
  } catch (e) {
    res.json({
      status: "ERROR",
      timestamp: getTimezoneTimestamp(),
      couchdb: "disconnected",
      error: e.message,
    });
  }
});

app.get("/api", (req, res) => {
  res.json({
    message: "Railway Monitoring API",
    endpoints: {
      impacts: "GET /api/impacts",
      impacts_stats: "GET /api/impacts/stats?hours=24",
      historical_graph: "GET /api/historical/graph/:hours",
      realtime_status: "GET /api/realtime/status",
      health: "GET /health",
    },
  });
});

// GET /api/last-active – returns timestamp of the most recent sensor reading
app.get('/api/last-active', async (req, res) => {
  try {
    if (!monitoringDataDB || !dbReady) {
      return res.status(503).json({ error: 'Database not ready' });
    }
    const result = await monitoringDataDB.find({
      selector: { timestamp: { $exists: true } },
      sort: [{ timestamp: 'desc' }],
      limit: 1,
      fields: ['timestamp']
    });
    if (result.docs && result.docs.length > 0) {
      res.json({ lastActive: result.docs[0].timestamp });
    } else {
      res.json({ lastActive: null });
    }
  } catch (err) {
    console.error('Error fetching last active time:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── WebSocket ─────────────────────────────────────────────────────────────
io.on("connection", async (socket) => {
  console.log("Client connected:", socket.id);
  try {
    const timeLimit = new Date(Date.now() - 86400000).toISOString();
    const response = await monitoringDataDB.find({
      selector: { timestamp: { $gte: timeLimit } },
      sort: [{ timestamp: "asc" }],
      limit: 2000,
    });
    socket.emit(
      "historical-data",
      response.docs.map((doc, i) => ({
        distance: i * 100,
        accel1: doc.x_axis || 0,
        accel2: doc.y_axis || 0,
        magnitude: doc.z_axis || 0,
        timestamp: doc.timestamp,
        rmsV: doc.rmsV,
        rmsL: doc.rmsL,
        sdV: doc.sdV,
        sdL: doc.sdL,
        p2pV: doc.p2pV,
        p2pL: doc.p2pL,
      })),
    );
  } catch (e) {
    console.error("sendHistoricalData error:", e.message);
    socket.emit("historical-data", []);
  }
  try {
    const stats = await computeStats(24);
    socket.emit("stats-update", stats);
    console.log(`Sent stats to ${socket.id}: total=${stats.total}`);
  } catch (e) {
    console.error("stats-update on connect error:", e.message);
  }
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

// ── MQTT setup (now after DB is ready) ───────────────────────────────────
async function startMqtt() {
  mqttClient = mqtt.connect(
    `mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`,
  );

  mqttClient.on("error", (err) => {
    console.error("MQTT error:", err.message);
    mqttConnected = false;
  });
  mqttClient.on("close", () => {
    console.warn("MQTT closed");
    mqttConnected = false;
  });

  mqttClient.on("connect", () => {
    console.log(
      `MQTT Connected to ${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`,
    );
    mqttConnected = true;
    [
      "adj/datalogger/sensors/left",
      "adj/datalogger/sensors/right",
      "adj/datalogger/health",
      "adj/datalogger/sensors/accelerometer",
      "adj/datalogger/sensors/gps",
    ].forEach((topic) => {
      mqttClient.subscribe(topic, (err) => {
        if (err) console.error(`Subscribe failed ${topic}:`, err.message);
        else console.log(`Subscribed: ${topic}`);
      });
    });
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      // Skip processing if DB not ready
      if (!dbReady) {
        console.log("DB not ready, skipping message");
        return;
      }

      const msgStr = message.toString();
      const timestampTZ = getTimezoneTimestamp();
      lastDataTimestamp = Date.now();

      console.log(`\n=== Received on: ${topic} ===`);
      console.log(`Raw: ${msgStr.substring(0, 200)}`);

      if (topic === "adj/datalogger/health") {
        const health = parseHealthMessage(msgStr);
        lastHealthStatus = health;
        console.log("Health:", health);
        io.emit("system-health", health);
        return;
      }

      const sensorSide = topic.includes("right")
        ? "right"
        : topic.includes("left")
          ? "left"
          : null;
      if (!sensorSide) return;

      // Track last seen time in memory
      sensorLastSeen[sensorSide] = Date.now();

      // Parse axes
      const ax = msgStr.match(/Ax\s*:\s*([+-]?\d+\.?\d*)/i);
      const ay = msgStr.match(/Ay\s*:\s*([+-]?\d+\.?\d*)/i);
      const az = msgStr.match(/Az\s*:\s*([+-]?\d+\.?\d*)/i);
      const xm = msgStr.match(/X=([+-]?\d+\.?\d*)/);
      const ym = msgStr.match(/Y=([+-]?\d+\.?\d*)/);
      const zm = msgStr.match(/Z=([+-]?\d+\.?\d*)/);

      const x = ax ? parseFloat(ax[1]) : xm ? parseFloat(xm[1]) : 0;
      const y = ay ? parseFloat(ay[1]) : ym ? parseFloat(ym[1]) : 0;
      const z = az ? parseFloat(az[1]) : zm ? parseFloat(zm[1]) : 0;

      const rmsVm = msgStr.match(/RMS-V\s*:\s*([+-]?\d+\.?\d*)/i);
      const rmsLm = msgStr.match(/RMS-L\s*:\s*([+-]?\d+\.?\d*)/i);
      const sdVm = msgStr.match(/SD-V\s*:\s*([+-]?\d+\.?\d*)/i);
      const sdLm = msgStr.match(/SD-L\s*:\s*([+-]?\d+\.?\d*)/i);
      const p2pVm = msgStr.match(/P2P-V\s*:\s*([+-]?\d+\.?\d*)/i);
      const p2pLm = msgStr.match(/P2P-L\s*:\s*([+-]?\d+\.?\d*)/i);
      const pkm = msgStr.match(/PEAK\s*:\s*([+-]?\d+\.?\d*)/i);
      const fsm = msgStr.match(/FS\s*:\s*(\d+)/i);
      const winm = msgStr.match(/WINDOW\s*:\s*(\d+)/i);

      const rmsV = rmsVm ? parseFloat(rmsVm[1]) : null;
      const rmsL = rmsLm ? parseFloat(rmsLm[1]) : null;
      const sdV = sdVm ? parseFloat(sdVm[1]) : null;
      const sdL = sdLm ? parseFloat(sdLm[1]) : null;
      const p2pV = p2pVm ? parseFloat(p2pVm[1]) : null;
      const p2pL = p2pLm ? parseFloat(p2pLm[1]) : null;
      const peak = pkm ? parseFloat(pkm[1]) : null;
      const fs = fsm ? parseInt(fsm[1]) : null;
      const win = winm ? parseInt(winm[1]) : null;

      const gForce = Math.sqrt(x ** 2 + y ** 2 + z ** 2);

      console.log(
        `Parsed [${sensorSide}]: x=${x} y=${y} z=${z} peak=${peak} gForce=${gForce.toFixed(4)}`,
      );

console.log(`[DEBUG] Attempting to insert into monitoring_data, dbReady=${dbReady}, monitoringDataDB=${!!monitoringDataDB}`);

      // Insert into monitoring_data
      if (monitoringDataDB) {
        const doc = {
          _id: generateDescendingId(),
          timestamp: timestampTZ,
          type: "accelerometer",
          device_id: sensorSide,
          x_axis: x,
          y_axis: y,
          z_axis: z,
          gForce,
          rmsV,
          rmsL,
          sdV,
          sdL,
          p2pV,
          p2pL,
          peak,
          fs,
          window_ms: win,
        };
        await monitoringDataDB.insert(doc).catch((e) => {
          console.error("monitoring_data insert error:", e.message, doc);
        });
      }

      if (realtimeDataDB) {
        const doc = {
          _id: generateDescendingId(),
          timestamp: timestampTZ,
          sensor: sensorSide,
          x,
          y,
          z,
          gForce,
          rmsV,
          rmsL,
          sdV,
          sdL,
          p2pV,
          p2pL,
          peak,
        };
        await realtimeDataDB.insert(doc).catch((e) => {
          console.error("realtime_data insert error:", e.message, doc);
        });
      }

      const peakVal = peak || gForce;
      if (peakVal > 2) {
        const severity = peakVal > 15 ? "HIGH" : peakVal > 5 ? "MEDIUM" : "LOW";
        const pClass = getPClass(peakVal);
        const impact = {
          _id: generateDescendingId(),
          timestamp: timestampTZ,
          sensor: sensorSide,
          severity,
          peak_g: peakVal,
          gForce,
          rmsV,
          rmsL,
          sdV,
          sdL,
          p2pV,
          p2pL,
          x,
          y,
          z,
          fs,
          window_ms: win,
          distance_m: totalDistanceM,
          p_class: pClass,
        };

        peaksLog.push(impact);
        savePeaksLog(peaksLog);

        if (accelerometerEventsDB) {
          await accelerometerEventsDB.insert(impact).catch((e) => {
            console.error("accelerometerEvents insert error:", e.message, impact);
          });
        }

        io.emit("new-impact", impact);
        console.log(
          `IMPACT: ${peakVal.toFixed(3)}g (${severity}) on ${sensorSide}`,
        );

        computeStats(24)
          .then((stats) => {
            io.emit("stats-update", stats);
            console.log(
              `[stats-update] broadcast: total=${stats.total} max=${stats.maxPeak.toFixed(2)}g source=${stats.source}`,
            );
          })
          .catch((e) => console.error("stats broadcast error:", e.message));
      }

      io.emit("accelerometer-data", {
        sensor: sensorSide,
        x,
        y,
        z,
        gForce,
        rmsV,
        rmsL,
        sdV,
        sdL,
        p2pV,
        p2pL,
        peak,
        timestamp: timestampTZ,
      });

      console.log(
        `Broadcast: X=${x}, Y=${y}, Z=${z}, gForce=${gForce.toFixed(4)}g`,
      );
    } catch (error) {
      console.error("MQTT message error:", error);
    }
  });
}

// ── Start everything in order ────────────────────────────────────────────
async function main() {
  // 1. Initialize CouchDB
  await initCouchDB();
  // 2. Start MQTT (now DB is ready)
  await startMqtt();
  // 3. Start HTTP server
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local IP: ${LOCAL_IP}`);
    console.log(`Frontend: http://${LOCAL_IP}:${PORT}/index.html`);
    console.log(`CouchDB:  http://127.0.0.1:5984/_utils/`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
});

// ── Reset endpoint ────────────────────────────────────────────────────────
app.post("/api/reset", async (req, res) => {
  const saveToDb = req.body?.saveToDb === true;
  console.log(`[reset] requested — saveToDb=${saveToDb}`);

  try {
    if (!saveToDb) {
      const dbsToClear = [
        { name: "accelerometer_events", ref: () => accelerometerEventsDB },
        { name: "monitoring_data", ref: () => monitoringDataDB },
        { name: "realtime_data", ref: () => realtimeDataDB },
      ];

      for (const db of dbsToClear) {
        try {
          await nano.db.destroy(db.name);
          await nano.db.create(db.name);
          console.log(`[reset] Cleared DB: ${db.name}`);
        } catch (e) {
          console.error(`[reset] Failed to clear ${db.name}:`, e.message);
        }
      }

      accelerometerEventsDB = nano.use("accelerometer_events");
      monitoringDataDB = nano.use("monitoring_data");
      realtimeDataDB = nano.use("realtime_data");

      await ensureIndex(accelerometerEventsDB, ["timestamp"], "idx-timestamp");
      await ensureIndex(
        accelerometerEventsDB,
        ["timestamp", "severity"],
        "idx-timestamp-severity",
      );
      await ensureIndex(monitoringDataDB, ["timestamp"], "idx-timestamp");

      peaksLog = [];
      savePeaksLog(peaksLog);
      console.log("[reset] JSON fallback cleared");
    }

    const zeroStats = {
      total: 0,
      highSeverity: 0,
      medium: 0,
      low: 0,
      maxPeak: 0,
      avgPeak: 0,
      source: "reset",
    };
    io.emit("stats-update", zeroStats);
    io.emit("display-reset", { saveToDb });

    console.log(`[reset] Complete — saveToDb=${saveToDb}`);
    res.json({
      success: true,
      saveToDb,
      message: saveToDb
        ? "Display reset — DB preserved"
        : "Full reset — DB cleared",
    });
  } catch (e) {
    console.error("[reset] Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── CSV Export endpoint (unchanged) ───────────────────────────────────────
app.get("/api/impacts/export/csv", async (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const cutoff = new Date(Date.now() - hours * 3600000).toISOString();

  let docs = [];

  if (accelerometerEventsDB && dbReady) {
    try {
      const all = await accelerometerEventsDB.list({ include_docs: true });
      docs = all.rows
        .map((r) => r.doc)
        .filter(
          (d) =>
            d &&
            d.timestamp &&
            d.timestamp >= cutoff &&
            !d._id?.startsWith("_"),
        )
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (e) {
      console.error(
        "[csv] CouchDB read failed, using JSON fallback:",
        e.message,
      );
    }
  }

  if (!docs.length) {
    docs = peaksLog
      .filter((p) => p.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  console.log(`[csv] Exporting ${docs.length} records for last ${hours}h`);

  const headers = [
    "timestamp",
    "sensor",
    "severity",
    "p_class",
    "peak_g",
    "gForce",
    "rmsV",
    "rmsL",
    "sdV",
    "sdL",
    "p2pV",
    "p2pL",
    "x",
    "y",
    "z",
    "fs",
    "window_ms",
    "distance_m",
  ];

  const fmt = (v) => (v == null || v === undefined ? "" : String(v));

  const rows = docs.map((d) =>
    [
      fmt(d.timestamp),
      fmt(d.sensor),
      fmt(d.severity),
      fmt(d.p_class || getPClass(d.peak_g) || ""),
      fmt(d.peak_g != null ? (+d.peak_g).toFixed(6) : ""),
      fmt(d.gForce != null ? (+d.gForce).toFixed(6) : ""),
      fmt(d.rmsV != null ? (+d.rmsV).toFixed(3) : ""),
      fmt(d.rmsL != null ? (+d.rmsL).toFixed(3) : ""),
      fmt(d.sdV != null ? (+d.sdV).toFixed(3) : ""),
      fmt(d.sdL != null ? (+d.sdL).toFixed(3) : ""),
      fmt(d.p2pV != null ? (+d.p2pV).toFixed(3) : ""),
      fmt(d.p2pL != null ? (+d.p2pL).toFixed(3) : ""),
      fmt(d.x != null ? (+d.x).toFixed(3) : ""),
      fmt(d.y != null ? (+d.y).toFixed(3) : ""),
      fmt(d.z != null ? (+d.z).toFixed(3) : ""),
      fmt(d.fs != null ? d.fs : ""),
      fmt(d.window_ms != null ? d.window_ms : ""),
      fmt(d.distance_m != null ? d.distance_m : "0"),
    ].join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `impact_report_${dateStr}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  res.send(csv);
});
