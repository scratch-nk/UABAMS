-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Accelerometer events table
CREATE TABLE IF NOT EXISTS accelerometer_events (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    peak_g FLOAT NOT NULL,
    severity VARCHAR(10) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'NORMAL')),
    latitude FLOAT,
    longitude FLOAT,
    speed FLOAT,
    x_axis FLOAT,
    y_axis FLOAT,
    z_axis FLOAT,
    temperature FLOAT,
    km_marker VARCHAR(20),
    division VARCHAR(50),
    railway_zone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on timestamp for faster queries
CREATE INDEX idx_acc_events_timestamp ON accelerometer_events(timestamp DESC);
CREATE INDEX idx_acc_events_severity ON accelerometer_events(severity);
CREATE INDEX idx_acc_events_location ON accelerometer_events(latitude, longitude);

-- Continuous monitoring data (time-series)
CREATE TABLE IF NOT EXISTS monitoring_data (
    time TIMESTAMPTZ NOT NULL,
    device_id VARCHAR(50),
    x_axis FLOAT,
    y_axis FLOAT,
    z_axis FLOAT,
    temperature FLOAT,
    vibration FLOAT
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('monitoring_data', 'time', if_not_exists => TRUE);

-- Create index on device_id
CREATE INDEX idx_monitoring_device ON monitoring_data(device_id, time DESC);

-- GPS tracking table
CREATE TABLE IF NOT EXISTS gps_tracking (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    speed FLOAT,
    heading FLOAT,
    accuracy FLOAT,
    altitude FLOAT
);

CREATE INDEX idx_gps_timestamp ON gps_tracking(timestamp DESC);

-- Ride comfort index table
CREATE TABLE IF NOT EXISTS ride_comfort_index (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    index_value FLOAT NOT NULL,
    category VARCHAR(20),
    train_speed FLOAT,
    section VARCHAR(100)
);

CREATE INDEX idx_comfort_timestamp ON ride_comfort_index(timestamp DESC);

-- Track irregularities table
CREATE TABLE IF NOT EXISTS track_irregularities (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location_lat FLOAT,
    location_lng FLOAT,
    severity VARCHAR(10),
    g_value FLOAT,
    speed FLOAT,
    description TEXT,
    km_marker VARCHAR(20),
    division VARCHAR(50),
    railway_zone VARCHAR(50),
    inspected BOOLEAN DEFAULT FALSE,
    inspection_notes TEXT
);

CREATE INDEX idx_irregularities_timestamp ON track_irregularities(timestamp DESC);
CREATE INDEX idx_irregularities_severity ON track_irregularities(severity);
CREATE INDEX idx_irregularities_inspected ON track_irregularities(inspected);

-- Hourly summaries table
CREATE TABLE IF NOT EXISTS hourly_summaries (
    hour TIMESTAMPTZ PRIMARY KEY,
    total_impacts INTEGER DEFAULT 0,
    high_severity_count INTEGER DEFAULT 0,
    medium_severity_count INTEGER DEFAULT 0,
    low_severity_count INTEGER DEFAULT 0,
    max_g FLOAT,
    avg_g FLOAT,
    avg_speed FLOAT,
    max_speed FLOAT,
    distance_covered FLOAT
);

-- Create continuous aggregates for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_summary
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 day', timestamp) AS day,
    COUNT(*) as total_impacts,
    COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_severity,
    COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium_severity,
    COUNT(CASE WHEN severity = 'LOW' THEN 1 END) as low_severity,
    AVG(peak_g) as avg_peak_g,
    MAX(peak_g) as max_peak_g
FROM accelerometer_events
GROUP BY day;

CREATE USER admin WITH PASSWORD 'admin123';
CREATE DATABASE railway_monitoring;
GRANT ALL PRIVILEGES ON DATABASE railway_monitoring TO admin;

-- Add sample data for testing
INSERT INTO accelerometer_events (timestamp, peak_g, severity, latitude, longitude, speed)
VALUES 
    (NOW() - INTERVAL '5 minutes', 7.378, 'MEDIUM', 28.613030, 77.210199, 93.4),
    (NOW() - INTERVAL '10 minutes', 16.855, 'HIGH', 28.613040, 77.210347, 93.6),
    (NOW() - INTERVAL '15 minutes', 2.970, 'LOW', 28.613567, 77.209967, 95.1),
    (NOW() - INTERVAL '20 minutes', 7.926, 'MEDIUM', 28.613351, 77.210007, 94.9),
    (NOW() - INTERVAL '25 minutes', 19.768, 'HIGH', 28.613697, 77.210048, 96.8);
