# Data Flow: Embedded → Server → Frontend

## Overview

```
Embedded Device (STM32)
        │
        │  MQTT publish
        ▼
MQTT Broker (Mosquitto, port 1883)
        │
        │  MQTT subscribe
        ▼
Node.js Server (port 5000)
   ├── PostgreSQL (persist + query)
   ├── Socket.IO  (real-time push to browser)
   └── REST API   (on-demand fetch by browser)
        │
        │  WebSocket + HTTP
        ▼
React Frontend (port 3000)
```

---

## How the Server Works

The server is the central hub bridging the embedded device and the browser. Without it running, the frontend has nothing to connect to — no live data, no historical data, no API responses.

### Web Service Endpoints

| Service | Host | Explanation | Used by |
|---------|------|-------------|---------|
| REST API | `http://localhost:5000/api` | HTTP endpoints for fetching historical and aggregated data from PostgreSQL | Frontend (`client/src/services/api.js`) |
| Socket.IO | `http://localhost:5000` | Persistent WebSocket connection for pushing live sensor data to the browser as it arrives | Frontend (`client/src/hooks/useWebSocket.js`, `Dashboard.js`, `Monitoring.js`) |
| MQTT broker | `localhost:1883` | Message broker that receives publishes from the embedded device; the server subscribes here | Server (`server/src/services/mqttService.js`) |
| React dev server | `http://localhost:3000` | Serves the frontend during development | Browser |

Both the REST API and Socket.IO run on the **same Express/HTTP server** on port 5000. There is no separate WebSocket server.

### The Four Roles

**1. MQTT Subscriber**
Connects to the Mosquitto broker and listens for messages published by the embedded device. This is the entry point for all sensor data — nothing enters the system without it.

**2. Database Writer**
Persists every incoming MQTT message into PostgreSQL:
- All raw readings → `monitoring_data`
- Impact events (peak_g > 2) → `accelerometer_events`

**3. Real-time Broadcaster**
The moment an MQTT message arrives, it is pushed to all connected browsers over Socket.IO — no polling, no delay.

**4. REST API**
Serves historical and aggregated data from PostgreSQL on demand: graphs, impact lists, GPS history, comfort index, and stats.

```
Embedded device
      │ MQTT
      ▼
   Server  ──── writes ────▶ PostgreSQL
      │                          │
      │ Socket.IO (live)         │ SQL queries (history)
      │                          │
      └──────────▶ Browser ◀─────┘
                   REST API
```

---

## 1. Embedded Device → MQTT Broker

The STM32 bridge publishes JSON payloads to the broker.

**Topic:** `sensor/railway/accelerometer/{device_id}`
(prefix configurable via `MQTT_TOPIC_PREFIX` in `server/.env`)

**Payload shape:**
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "device_id": "stm32",
  "x": 0.12,
  "y": -0.05,
  "z": 9.81,
  "peak_g": 1.2,
  "severity": "NORMAL"
}
```

**Severity levels** (`server/src/utils/severityCalculator.js`):
| peak_g | severity |
|--------|----------|
| ≥ 15g  | HIGH     |
| ≥ 5g   | MEDIUM   |
| ≥ 2g   | LOW      |
| < 2g   | NORMAL   |

---

## 2. Server: MQTT → Database + WebSocket

**File:** `server/src/services/mqttService.js`

On every incoming MQTT message:

```
mqttService.js
│
├─ JSON.parse(message)
│
├─ INSERT INTO monitoring_data        ← all readings, raw
│    (time, device_id, x_axis, y_axis, z_axis)
│
├─ if peak_g > 2:
│    INSERT INTO accelerometer_events ← impacts only
│    (timestamp, peak_g, severity, x/y/z, device_id)
│
│    if severity === 'HIGH':
│      io.emit('high-severity-alert', { timestamp, peak_g, severity, device_id })
│
└─ io.emit('sensor-data', {
       deviceType: 'accelerometer',
       deviceId: data.device_id,
       data: <full payload>
   })
```

---

## 3. Server: WebSocket — Initial Data on Connect

**File:** `server/src/services/websocketService.js`

When a browser connects via Socket.IO, the server immediately sends:

| Event              | Source table          | Content                          |
|--------------------|-----------------------|----------------------------------|
| `initial-impacts`  | `accelerometer_events`| Last 50 impacts, DESC by time    |
| `initial-locations`| `gps_tracking`        | Last 1 hour of GPS positions     |
| `latest-readings`  | both tables           | Latest g-force, severity, speed  |

The client can also request data on demand:

| Client emits              | Server responds with  |
|---------------------------|-----------------------|
| `request-recent-impacts`  | `recent-impacts`      |
| `request-location-history`| `location-history`    |

---

## 4. Server: REST API Endpoints

Base URL: `http://localhost:5000/api`

### Impacts — `server/src/routes/api/impacts.js`
| Method | Path                          | Description                  |
|--------|-------------------------------|------------------------------|
| GET    | `/impacts`                    | Paginated impact events       |
| GET    | `/impacts/severity/:level`    | Filter by HIGH / MEDIUM / LOW |
| GET    | `/impacts/:id`                | Single impact by ID           |
| GET    | `/impacts/stats/summary`      | 7-day aggregated stats        |
| POST   | `/impacts/geofence`           | Query impacts by area         |

### Monitoring — `server/src/routes/api/monitoring.js`
| Method | Path                              | Description                               |
|--------|-----------------------------------|-------------------------------------------|
| GET    | `/monitoring/realtime`            | Raw readings from last 5 minutes          |
| GET    | `/monitoring/accelerometer/:range`| Bucketed averages (`1h`, `24h`, `7d`)     |
| GET    | `/monitoring/ride-comfort`        | 5-min comfort index buckets, last 24h     |
| GET    | `/monitoring/comfort-histogram`   | Distribution across 10-point bands, 24h   |

**Bucket sizes for `/monitoring/accelerometer/:range`:**
| range | bucket size |
|-------|-------------|
| `1h`  | 1 minute    |
| `24h` | 5 minutes   |
| `7d`  | 1 hour      |

### GPS — `server/src/routes/api/gps.js`
| Method | Path                   | Description                        |
|--------|------------------------|------------------------------------|
| GET    | `/gps/current`         | Latest GPS fix                     |
| GET    | `/gps/history/:range`  | Track history (`1h`, `24h`, `7d`)  |
| GET    | `/gps/track`           | 1-min bucketed track with speed    |

---

## 5. Server: Background Jobs

**File:** `server/src/utils/scheduler.js`

| Schedule       | Job                     | What it does                                              |
|----------------|-------------------------|-----------------------------------------------------------|
| Every 5 min    | `calculateRideComfortIndex` | Reads last 5 min of `monitoring_data`, calculates vibration magnitude → stores in `ride_comfort_index` |
| Every hour     | `generateHourlySummary` | Aggregates impact count + max G → stores in `hourly_summaries` |
| Daily at 02:00 | `cleanupOldData`        | Deletes `monitoring_data` > 30 days, `gps_tracking` > 90 days |

---

## 6. Frontend: Receiving Data

### WebSocket hook — `client/src/hooks/useWebSocket.js`

Central Socket.IO connection. Listens for:

| Event                | Stored as      | Used by                  |
|----------------------|----------------|--------------------------|
| `sensor-data`        | `lastMessage`  | Dashboard, Monitoring    |
| `high-severity-alert`| `lastMessage`  | AlertContext             |
| `gps-update`         | `lastMessage`  | Map page                 |
| `initial-impacts`    | `lastMessage`  | Dashboard, Monitoring    |

> **Note:** `Dashboard.js` and `Monitoring.js` each open their own `io()` connection directly rather than using this hook.

### API service — `client/src/services/api.js`

Axios instance pointing at `VITE_API_URL` (default `http://localhost:5000/api`).

| Function                | Endpoint                              |
|-------------------------|---------------------------------------|
| `fetchImpacts()`        | GET `/impacts`                        |
| `fetchImpactsBySeverity()`| GET `/impacts/severity/:level`      |
| `fetchImpactStats()`    | GET `/impacts/stats/summary`          |
| `fetchAccelerometerData()`| GET `/monitoring/accelerometer/:range`|
| `fetchRealtimeData()`   | GET `/monitoring/realtime`            |
| `fetchRideComfort()`    | GET `/monitoring/ride-comfort`        |
| `fetchComfortHistogram()`| GET `/monitoring/comfort-histogram`  |
| `fetchCurrentLocation()`| GET `/gps/current`                   |
| `fetchLocationHistory()`| GET `/gps/history/:range`            |
| `fetchTrackData()`      | GET `/gps/track`                      |

---

## 7. Frontend: Pages and What They Display

### `Dashboard.js`
- Opens its own Socket.IO connection on mount
- `sensor-data` → updates live X / Y / Z / peak_g / severity display
- `initial-impacts` → calculates daily stats (impacts today, high severity count, avg/max G)
- Polls no REST endpoints — entirely WebSocket driven

### `Monitoring.js`
- Opens its own Socket.IO connection on mount
- `sensor-data` → appends to raw data history (last 100 points) and impact list
- `initial-impacts` → seeds the impact list on first load
- On mount also calls `fetchImpacts()` as a REST fallback
- Child components each fetch their own data:

| Component              | Data source                        |
|------------------------|------------------------------------|
| `ImpactList`           | Props from Monitoring state         |
| `AccelerometerGraph`   | `fetchAccelerometerData(timeRange)` |
| `SpeedGraph`           | `fetchSpeedData()` → `/gps/track`  |
| `RideComfortHistogram` | `fetchComfortHistogram()`           |
| `RawValueDisplay`      | Props from Monitoring state         |
| `RawValueChart`        | Local state built from WebSocket    |
| `GeolocationMap`       | Props from Monitoring state         |

### `Map.js`
- Calls `fetchCurrentLocation()` and `fetchLocationHistory()` on mount

### `Events.js`
- Calls `fetchImpacts()` with pagination

---

## 8. Database Tables

| Table                  | Written by          | Read by                          |
|------------------------|---------------------|----------------------------------|
| `monitoring_data`      | `mqttService`       | `monitoring.js` routes, scheduler|
| `accelerometer_events` | `mqttService`       | `impacts.js` routes, websocket   |
| `gps_tracking`         | *(bridge, TBD)*     | `gps.js` routes, websocket       |
| `ride_comfort_index`   | scheduler           | `monitoring.js` routes           |
| `hourly_summaries`     | scheduler           | *(future reporting)*             |

---

## 9. Environment Variables

### `server/.env`
| Variable            | Default                  | Used in              |
|---------------------|--------------------------|----------------------|
| `PORT`              | `5000`                   | `app.js`             |
| `DB_HOST/PORT/NAME` | `localhost/5432/railway_monitoring` | `database.js` |
| `DB_USER/PASSWORD`  | `admin/admin123`         | `database.js`        |
| `MQTT_HOST`         | `localhost`              | `mqttService.js`     |
| `MQTT_PORT`         | `1883`                   | `mqttService.js`     |
| `MQTT_TOPIC_PREFIX` | `sensor/railway`         | `mqttService.js`     |
| `CORS_ORIGIN`       | `http://localhost:3000`  | `app.js`             |

### `client/.env`
| Variable          | Default                    | Used in            |
|-------------------|----------------------------|--------------------|
| `VITE_API_URL`    | `http://localhost:5000/api`| `services/api.js`  |
| `VITE_SOCKET_URL` | `http://localhost:5000`    | `hooks/useWebSocket.js` |
