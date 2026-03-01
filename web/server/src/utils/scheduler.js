const cron = require('node-cron');
const { pool } = require('../config/database');
const logger = require('./logger');

const initScheduler = () => {
    // Calculate and store ride comfort index every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            await calculateRideComfortIndex();
        } catch (error) {
            logger.error('Error calculating ride comfort index:', error);
        }
    });

    // Clean up old data daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
        try {
            await cleanupOldData();
        } catch (error) {
            logger.error('Error cleaning up old data:', error);
        }
    });

    // Generate hourly summary
    cron.schedule('0 * * * *', async () => {
        try {
            await generateHourlySummary();
        } catch (error) {
            logger.error('Error generating hourly summary:', error);
        }
    });

    logger.info('Cron jobs scheduled');
};

const calculateRideComfortIndex = async () => {
    // Get recent accelerometer data
    const query = `
        SELECT
            date_trunc('minute', time) as minute,
            AVG(x_axis) as avg_x,
            AVG(y_axis) as avg_y,
            AVG(z_axis) as avg_z,
            STDDEV(x_axis) as std_x,
            STDDEV(y_axis) as std_y,
            STDDEV(z_axis) as std_z
        FROM monitoring_data
        WHERE time > NOW() - INTERVAL '5 minutes'
        GROUP BY minute
    `;
    
    const { rows } = await pool.query(query);
    
    for (const row of rows) {
        // Calculate comfort index (lower is better)
        // Based on vibration levels and smoothness
        const vibrationMagnitude = Math.sqrt(
            Math.pow(row.std_x || 0, 2) + 
            Math.pow(row.std_y || 0, 2) + 
            Math.pow(row.std_z || 0, 2)
        );
        
        const comfortIndex = Math.min(100, vibrationMagnitude * 10);
        
        // Store in database
        await pool.query(`
            INSERT INTO ride_comfort_index (timestamp, index_value, category)
            VALUES ($1, $2, $3)
        `, [
            row.minute,
            comfortIndex,
            getComfortCategory(comfortIndex)
        ]);
    }
};

const getComfortCategory = (index) => {
    if (index < 20) return 'Excellent';
    if (index < 40) return 'Good';
    if (index < 60) return 'Average';
    if (index < 80) return 'Poor';
    return 'Very Poor';
};

const cleanupOldData = async () => {
    // Keep raw monitoring data for 30 days
    await pool.query(`
        DELETE FROM monitoring_data 
        WHERE time < NOW() - INTERVAL '30 days'
    `);
    
    // Keep GPS tracking for 90 days
    await pool.query(`
        DELETE FROM gps_tracking 
        WHERE timestamp < NOW() - INTERVAL '90 days'
    `);
    
    logger.info('Old data cleaned up');
};

const generateHourlySummary = async () => {
    await pool.query(`
        INSERT INTO hourly_summaries (hour, total_impacts, max_g)
        SELECT
            date_trunc('hour', timestamp) as hour,
            COUNT(*) as total_impacts,
            MAX(peak_g) as max_g
        FROM accelerometer_events
        WHERE timestamp > NOW() - INTERVAL '1 hour'
        GROUP BY hour
    `);
};

module.exports = { initScheduler };
