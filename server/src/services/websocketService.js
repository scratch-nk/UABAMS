const { pool } = require('../config/database');

let io;

const initWebSocket = (socketIO) => {
    io = socketIO;

    io.on('connection', (socket) => {
        console.log('✅ Client connected:', socket.id);

        // Send initial data
        sendInitialData(socket);

        // Handle client requests
        socket.on('request-recent-impacts', async () => {
            const impacts = await getRecentImpacts();
            socket.emit('recent-impacts', impacts);
        });

        socket.on('request-location-history', async (timeRange) => {
            const locations = await getLocationHistory(timeRange);
            socket.emit('location-history', locations);
        });

        socket.on('subscribe-severity', (severity) => {
            socket.join(`severity-${severity}`);
        });

        socket.on('unsubscribe-severity', (severity) => {
            socket.leave(`severity-${severity}`);
        });

        socket.on('disconnect', () => {
            console.log('❌ Client disconnected:', socket.id);
        });
    });
};

const sendInitialData = async (socket) => {
    try {
        // Get recent impacts
        const impacts = await getRecentImpacts();
        socket.emit('initial-impacts', impacts);

        // Get recent GPS positions
        const locations = await getLocationHistory('1h');
        socket.emit('initial-locations', locations);

        // Get latest readings
        const latestReadings = await getLatestReadings();
        socket.emit('latest-readings', latestReadings);

    } catch (error) {
        console.error('Error sending initial data:', error);
    }
};

const getRecentImpacts = async () => {
    const query = `
        SELECT * FROM accelerometer_events 
        ORDER BY timestamp DESC 
        LIMIT 50
    `;
    const { rows } = await pool.query(query);
    return rows;
};

const getLocationHistory = async (timeRange) => {
    let interval = "1 hour";
    if (timeRange === '24h') interval = "24 hours";
    else if (timeRange === '7d') interval = "7 days";

    const query = `
        SELECT * FROM gps_tracking 
        WHERE timestamp > NOW() - $1::interval
        ORDER BY timestamp DESC
    `;
    const { rows } = await pool.query(query, [interval]);
    return rows;
};

const getLatestReadings = async () => {
    const query = `
        SELECT 
            (SELECT peak_g FROM accelerometer_events ORDER BY timestamp DESC LIMIT 1) as latest_g,
            (SELECT severity FROM accelerometer_events ORDER BY timestamp DESC LIMIT 1) as latest_severity,
            (SELECT speed FROM gps_tracking ORDER BY timestamp DESC LIMIT 1) as current_speed,
            (SELECT COUNT(*) FROM accelerometer_events WHERE timestamp > NOW() - INTERVAL '1 hour') as impacts_last_hour,
            (SELECT COUNT(*) FROM accelerometer_events WHERE severity = 'HIGH' AND timestamp > NOW() - INTERVAL '1 hour') as high_severity_last_hour
    `;
    const { rows } = await pool.query(query);
    return rows[0];
};

const broadcastHighSeverity = (impact) => {
    if (io) {
        io.to('severity-HIGH').emit('high-severity-alert', impact);
    }
};

module.exports = { initWebSocket, broadcastHighSeverity };
