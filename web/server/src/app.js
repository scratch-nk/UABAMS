const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const dotenv = require('dotenv');

dotenv.config();

const { connectDB } = require('./config/database');
const { initMQTT } = require('./services/mqttService');
const { initWebSocket } = require('./services/websocketService');
const { initScheduler } = require('./utils/scheduler');

// Import routes
const impactRoutes = require('./routes/api/impacts');
const monitoringRoutes = require('./routes/api/monitoring');
const gpsRoutes = require('./routes/api/gps');
//const reportRoutes = require('./routes/api/reports');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/impacts', impactRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/gps', gpsRoutes);
//app.use('/api/reports', reportRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Initialize services
const startServer = async () => {
    try {
        // Connect to database
        await connectDB();
        console.log('Database connected');

        // Initialize MQTT
        initMQTT(io);
        console.log('MQTT service initialized');

        // Initialize WebSocket
        initWebSocket(io);
        console.log('WebSocket service initialized');

        // Initialize cron jobs
        initScheduler();
        console.log('Scheduler initialized');

        // Start server
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing connections...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
