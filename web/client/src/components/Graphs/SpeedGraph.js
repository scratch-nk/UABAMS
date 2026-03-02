import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Box, Typography } from '@mui/material';
import { fetchSpeedData } from '../../services/api';

const SpeedGraph = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await fetchSpeedData();
      setData(result);
    } catch (error) {
      console.error('Error loading speed data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="textSecondary">Loading...</Typography>
      </Box>
    );
  }

  const avgSpeed = data.length > 0
    ? data.reduce((acc, curr) => acc + (curr.avg_speed || 0), 0) / data.length
    : 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
        <XAxis 
          dataKey="time" 
          tickFormatter={formatTime}
          stroke="#888"
        />
        <YAxis 
          domain={['dataMin - 5', 'dataMax + 5']}
          stroke="#888"
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <Box sx={{ bgcolor: 'background.paper', p: 1, border: '1px solid #444' }}>
                  <Typography variant="body2">
                    Time: {formatTime(label)}
                  </Typography>
                  <Typography variant="body2" color="#ff7300">
                    Speed: {payload[0].value?.toFixed(1)} km/h
                  </Typography>
                </Box>
              );
            }
            return null;
          }}
        />
        <ReferenceLine 
          y={avgSpeed} 
          stroke="#ffbb33" 
          strokeDasharray="3 3"
          label={{ value: 'Avg', position: 'right', fill: '#ffbb33' }}
        />
        <Line 
          type="monotone" 
          dataKey="avg_speed" 
          stroke="#ff7300" 
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SpeedGraph;
