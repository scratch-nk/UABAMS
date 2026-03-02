import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
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
    <Box>
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
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorX" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="colorY" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.2}/>
            </linearGradient>
            <linearGradient id="colorZ" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ffc658" stopOpacity={0.2}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis 
            dataKey="bucket" 
            tickFormatter={(time) => new Date(time).toLocaleTimeString()}
            stroke="#888"
          />
          <YAxis stroke="#888" domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          <Area 
            type="monotone" 
            dataKey="avg_x" 
            name="X-Axis"
            stroke="#8884d8" 
            fillOpacity={1}
            fill="url(#colorX)" 
          />
          <Area 
            type="monotone" 
            dataKey="avg_y" 
            name="Y-Axis"
            stroke="#82ca9d" 
            fillOpacity={1}
            fill="url(#colorY)" 
          />
          <Area 
            type="monotone" 
            dataKey="avg_z" 
            name="Z-Axis"
            stroke="#ffc658" 
            fillOpacity={1}
            fill="url(#colorZ)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default AccelerometerGraph;
