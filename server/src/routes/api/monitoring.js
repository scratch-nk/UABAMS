const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');

// Get real-time monitoring data
router.get('/realtime', async (req, res) => {
    try {
        const query = `
            SELECT * FROM monitoring_data 
            WHERE time > NOW() - INTERVAL '5 minutes'
            ORDER BY time DESC
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get accelerometer data for graphs
router.get('/accelerometer/:timeRange', async (req, res) => {
    try {
        const { timeRange } = req.params;
        let interval = '1 minute';
        let range = '1 hour';
        
        if (timeRange === '1h') { interval = '1 minute'; range = '1 hour'; }
        else if (timeRange === '24h') { interval = '5 minutes'; range = '24 hours'; }
        else if (timeRange === '7d') { interval = '1 hour'; range = '7 days'; }
        
        const query = `
            SELECT 
                time_bucket($1::interval, time) as bucket,
                AVG(x_axis) as avg_x,
                AVG(y_axis) as avg_y,
                AVG(z_axis) as avg_z,
                MAX(x_axis) as max_x,
                MAX(y_axis) as max_y,
                MAX(z_axis) as max_z
            FROM monitoring_data
            WHERE time > NOW() - $2::interval
            GROUP BY bucket
            ORDER BY bucket DESC
        `;
        
        const { rows } = await pool.query(query, [interval, range]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get ride comfort index data
router.get('/ride-comfort', async (req, res) => {
    try {
        const query = `
            SELECT 
                time_bucket('5 minutes', timestamp) as bucket,
                AVG(index_value) as avg_comfort,
                COUNT(*) as samples
            FROM ride_comfort_index
            WHERE timestamp > NOW() - INTERVAL '24 hours'
            GROUP BY bucket
            ORDER BY bucket DESC
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get comfort index histogram
router.get('/comfort-histogram', async (req, res) => {
    try {
        const query = `
            SELECT 
                CASE 
                    WHEN index_value BETWEEN 0 AND 10 THEN '0-10'
                    WHEN index_value BETWEEN 10 AND 20 THEN '10-20'
                    WHEN index_value BETWEEN 20 AND 30 THEN '20-30'
                    WHEN index_value BETWEEN 30 AND 40 THEN '30-40'
                    WHEN index_value BETWEEN 40 AND 50 THEN '40-50'
                    WHEN index_value BETWEEN 50 AND 60 THEN '50-60'
                    WHEN index_value BETWEEN 60 AND 70 THEN '60-70'
                    WHEN index_value BETWEEN 70 AND 80 THEN '70-80'
                    WHEN index_value BETWEEN 80 AND 90 THEN '80-90'
                    ELSE '90-100'
                END as range,
                COUNT(*) as occurrences
            FROM ride_comfort_index
            WHERE timestamp > NOW() - INTERVAL '24 hours'
            GROUP BY range
            ORDER BY range
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
