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
        const allowed = { '1h': true, '24h': true, '7d': true };
        if (!allowed[timeRange]) {
            return res.status(400).json({ error: 'Invalid time range. Use 1h, 24h, or 7d.' });
        }

        let bucketExpr, range;
        if (timeRange === '1h') {
            bucketExpr = `date_trunc('minute', time)`;
            range = '1 hour';
        } else if (timeRange === '24h') {
            bucketExpr = `date_trunc('hour', time) + floor(extract(minute from time) / 5) * interval '5 minutes'`;
            range = '24 hours';
        } else {
            bucketExpr = `date_trunc('hour', time)`;
            range = '7 days';
        }

        const query = `
            SELECT
                ${bucketExpr} as bucket,
                AVG(x_axis) as avg_x,
                AVG(y_axis) as avg_y,
                AVG(z_axis) as avg_z,
                MAX(x_axis) as max_x,
                MAX(y_axis) as max_y,
                MAX(z_axis) as max_z
            FROM monitoring_data
            WHERE time > NOW() - $1::interval
            GROUP BY bucket
            ORDER BY bucket DESC
        `;

        const { rows } = await pool.query(query, [range]);
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
                date_trunc('hour', timestamp) + floor(extract(minute from timestamp) / 5) * interval '5 minutes' as bucket,
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
