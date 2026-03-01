const mqtt = require('mqtt');
const { pool } = require('../config/database');

let mqttClient;
let io;

const initMQTT = (socketIO) => {
    io = socketIO;
    
    const clientId = `railway_backend_${Math.random().toString(16).slice(3)}`;
    
    mqttClient = mqtt.connect({
        host: process.env.MQTT_HOST || 'localhost',
        port: parseInt(process.env.MQTT_PORT) || 1883,
        clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
    });

    mqttClient.on('connect', () => {
        console.log('✅ MQTT connected');
        
        // Subscribe to accelerometer topics
        const prefix = process.env.MQTT_TOPIC_PREFIX || 'sensor/railway';
        mqttClient.subscribe(`${prefix}/accelerometer/#`, (err) => {
            if (!err) {
                console.log('✅ Subscribed to accelerometer topics');
            } else {
                console.error('❌ Failed to subscribe:', err);
            }
        });
    });

    mqttClient.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`📨 MQTT message received: ${topic}`);
            
            // Process accelerometer data
            if (topic.includes('accelerometer')) {
                await processAccelerometerData(data, topic);
            }

            // Emit to all connected WebSocket clients
            if (io) {
                io.emit('sensor-data', {
                    deviceType: 'accelerometer',
                    deviceId: data.device_id || 'stm32',
                    data: data
                });
                console.log('🔄 Emitted to WebSocket clients');
            }

        } catch (error) {
            console.error('❌ Error processing MQTT message:', error);
        }
    });

    mqttClient.on('error', (error) => {
        console.error('❌ MQTT error:', error);
    });

    return mqttClient;
};

const processAccelerometerData = async (data, topic) => {
    try {
        // Store in monitoring_data table
        await pool.query(`
            INSERT INTO monitoring_data (time, device_id, x_axis, y_axis, z_axis)
            VALUES ($1, $2, $3, $4, $5)
        `, [new Date(data.timestamp), data.device_id || 'stm32', data.x, data.y, data.z]);

        console.log('✅ Data stored in monitoring_data');

        // Check if it's an impact (peak_g > 2)
        if (data.peak_g > 2) {
            const result = await pool.query(`
                INSERT INTO accelerometer_events 
                (timestamp, peak_g, severity, x_axis, y_axis, z_axis, device_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [new Date(data.timestamp), data.peak_g, data.severity, data.x, data.y, data.z, data.device_id]);

            console.log(`✅ Impact stored: ${data.peak_g}g (${data.severity})`);

            // Emit high severity alert if needed
            if (data.severity === 'HIGH' && io) {
                const impact = result.rows[0];
                io.emit('high-severity-alert', {
                    timestamp: impact.timestamp,
                    peak_g: impact.peak_g,
                    severity: impact.severity,
                    device_id: impact.device_id
                });
                console.log('🚨 High severity alert emitted!');
            }
        }

    } catch (error) {
        console.error('❌ Error storing accelerometer data:', error);
    }
};

module.exports = { initMQTT };
