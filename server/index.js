const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const cors = require('cors');

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

require('dotenv').config();

// =============================
// PostgreSQL Connection
// =============================
const pool = new Pool({
    user: 'admin',
    host: 'localhost',
    database: 'railway_monitoring',
    password: 'admin123',
    port: 5432,
});

// =============================
// MQTT Connection
// =============================
const mqttClient = mqtt.connect('mqtt://192.168.0.125:1883');

mqttClient.on('connect', () => {
    console.log("MQTT Connected");
    mqttClient.subscribe('sensor/railway/accelerometer/stm32');
});

// =============================
// MQTT Message Handling
// =============================
mqttClient.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log("MQTT Received:", topic, data);

        const now = new Date();

        // ================= LEFT SENSOR =================
        if (topic.includes('left')) {
            await pool.query(
                `INSERT INTO monitoring_data 
                (time, device_id, x_axis, y_axis, z_axis, vibration)
                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    now,
                    'left_sensor',
                    data.x,
                    data.y,
                    data.z,
                    data.peak_g
                ]
            );
        }

        // ================= RIGHT SENSOR =================
        if (topic.includes('right')) {
            await pool.query(
                `INSERT INTO monitoring_data 
                (time, device_id, x_axis, y_axis, z_axis, vibration)
                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    now,
                    'right_sensor',
                    data.x,
                    data.y,
                    data.z,
                    data.peak_g
                ]
            );
        }

        // ================= ALERT EVENT =================
        if (topic.includes('alert')) {
            await pool.query(
                `INSERT INTO accelerometer_events
                (timestamp, peak_g, severity, x_axis, y_axis, z_axis)
                VALUES ($1,$2,$3,$4,$5,$6)`,
                [
                    now,
                    data.peak_g,
                    data.severity,
                    data.x,
                    data.y,
                    data.z
                ]
            );
        }

        // ================= GPS DATA =================
        if (topic.includes('gps')) {
            await pool.query(
                `INSERT INTO gps_tracking
                (timestamp, latitude, longitude, speed)
                VALUES ($1,$2,$3,$4)`,
                [
                    now,
                    data.latitude,
                    data.longitude,
                    data.speed
                ]
            );
        }

        // Emit to dashboard
        io.emit('sensor-data', { topic, data });

    } catch (error) {
        console.error("MQTT Processing Error:", error);
    }
});

// =============================
// API Endpoints
// =============================

// Get last 50 events
app.get('/api/impacts', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM accelerometer_events ORDER BY timestamp DESC LIMIT 50'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get monitoring data
app.get('/api/monitoring', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM monitoring_data ORDER BY time DESC LIMIT 200'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================
// WebSocket
// =============================
io.on('connection', (socket) => {
    console.log("Dashboard Connected");

    socket.on('disconnect', () => {
        console.log("Dashboard Disconnected");
    });
});

// =============================
// Start Server
// =============================
const PORT = 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
