import React, { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Box, FormControl, Select, MenuItem, Typography } from '@mui/material';
import { fetchAccelerometerData } from '../../services/api';

const AccelerometerGraph = () => {
  const [data, setData] = useState([]);
  const [timeRange, setTimeRange] = useState('1h');
  // Remove the unused 'loading' state

  const loadData = useCallback(async () => {
    try {
      const result = await fetchAccelerometerData(timeRange);
      setData(result);
    } catch (error) {
      console.error('Error loading accelerometer data:', error);
    }
  }, [timeRange]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{ bgcolor: 'background.paper', p: 1.5, border: '1px solid #444', borderRadius: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Time: {new Date(label).toLocaleTimeString()}
          </Typography>
          {payload.map((entry, index) => (
            <Typography key={index} variant="body2" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(3)} g
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            displayEmpty
          >
            <MenuItem value="1h">Last Hour</MenuItem>
            <MenuItem value="24h">Last 24 Hours</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="bucket"
            tickFormatter={(time) => new Date(time).toLocaleTimeString()}
            stroke="#888"
          />
          <YAxis stroke="#888" domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <Line type="monotone" dataKey="avg_x" name="X-Axis" stroke="#8884d8" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="avg_y" name="Y-Axis" stroke="#82ca9d" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="avg_z" name="Z-Axis" stroke="#ffc658" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default AccelerometerGraph;
