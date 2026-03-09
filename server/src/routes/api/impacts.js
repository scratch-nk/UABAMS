const express = require('express');
const router = express.Router();
const { pool } = require('../../config/database');
const logger = require('../../utils/logger');

// Get all impacts with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        const query = `
            SELECT * FROM accelerometer_events 
            ORDER BY timestamp DESC 
            LIMIT $1 OFFSET $2
        `;
        
        const { rows } = await pool.query(query, [limit, offset]);
        
        // Get total count
        const countResult = await pool.query('SELECT COUNT(*) FROM accelerometer_events');
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            data: rows,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error fetching impacts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get impacts by severity
router.get('/severity/:level', async (req, res) => {
    try {
        const { level } = req.params;
        const { limit = 50 } = req.query;
        
        const query = `
            SELECT * FROM accelerometer_events 
            WHERE severity = $1 
            ORDER BY timestamp DESC 
            LIMIT $2
        `;
        
        const { rows } = await pool.query(query, [level.toUpperCase(), limit]);
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching impacts by severity:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get impact by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = 'SELECT * FROM accelerometer_events WHERE id = $1';
        const { rows } = await pool.query(query, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Impact not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        logger.error('Error fetching impact:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get impact statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const query = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as total_impacts,
                COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_severity,
                COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium_severity,
                COUNT(CASE WHEN severity = 'LOW' THEN 1 END) as low_severity,
                AVG(peak_g) as avg_peak_g,
                MAX(peak_g) as max_peak_g
            FROM accelerometer_events
            WHERE timestamp > NOW() - INTERVAL '7 days'
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
        `;
        
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching impact stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get impacts within a geographic area
router.post('/geofence', async (req, res) => {
    try {
        const { lat_min, lat_max, lng_min, lng_max, time_range = '24h' } = req.body;
        
        const query = `
            SELECT * FROM accelerometer_events 
            WHERE latitude BETWEEN $1 AND $2
            AND longitude BETWEEN $3 AND $4
            AND timestamp > NOW() - $5::interval
            ORDER BY timestamp DESC
        `;
        
        const { rows } = await pool.query(query, [
            lat_min, lat_max, 
            lng_min, lng_max, 
            time_range
        ]);
        
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching geofenced impacts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
