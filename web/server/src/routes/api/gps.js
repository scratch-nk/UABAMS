const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');

// Get current location
router.get('/current', async (req, res) => {
    try {
        const query = `
            SELECT * FROM gps_tracking 
            ORDER BY timestamp DESC 
            LIMIT 1
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get location history
router.get('/history/:timeRange', async (req, res) => {
    try {
        const { timeRange } = req.params;
        let interval = '1 hour';
        
        if (timeRange === '1h') interval = '1 hour';
        else if (timeRange === '24h') interval = '24 hours';
        else if (timeRange === '7d') interval = '7 days';
        
        const query = `
            SELECT * FROM gps_tracking 
            WHERE timestamp > NOW() - $1::interval
            ORDER BY timestamp DESC
        `;
        
        const { rows } = await pool.query(query, [interval]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get track map data
router.get('/track', async (req, res) => {
    try {
        const query = `
            SELECT
                date_trunc('minute', timestamp) as time,
                AVG(latitude) as lat,
                AVG(longitude) as lng,
                AVG(speed) as avg_speed,
                MAX(speed) as max_speed
            FROM gps_tracking
            WHERE timestamp > NOW() - INTERVAL '1 hour'
            GROUP BY time
            ORDER BY time
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
