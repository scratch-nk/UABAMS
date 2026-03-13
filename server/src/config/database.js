const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'railway_monitoring',
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'admin123',
    max: 20,
    idleTimeoutMillis: 30000,
});

const connectDB = async () => {
    try {
        await pool.connect();
        console.log('Database connected successfully');
        
        // Create tables if they don't exist
        await createTables();
        
    } catch (error) {
        console.error('Database connection error:', error);
        throw error;
    }
};

const createTables = async () => {
    const queries = `
        CREATE TABLE IF NOT EXISTS monitoring_data (
            time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            device_id VARCHAR(50),
            x_axis FLOAT,
            y_axis FLOAT,
            z_axis FLOAT
        );

        CREATE TABLE IF NOT EXISTS accelerometer_events (
            id BIGSERIAL PRIMARY KEY,
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            peak_g FLOAT NOT NULL,
            severity VARCHAR(10),
            x_axis FLOAT,
            y_axis FLOAT,
            z_axis FLOAT,
            device_id VARCHAR(50)
        );

        CREATE INDEX IF NOT EXISTS idx_monitoring_time ON monitoring_data(time DESC);
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON accelerometer_events(timestamp DESC);
    `;

    try {
        await pool.query(queries);
        console.log('Tables created successfully');
    } catch (error) {
        console.error('Error creating tables:', error);
    }
};

module.exports = { pool, connectDB };
