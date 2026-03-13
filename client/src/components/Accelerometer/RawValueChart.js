import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, Typography } from '@mui/material';

const RawValueChart = ({ data }) => {
  console.log('RawValueChart received:', data?.length, 'points');
  
  if (!data || data.length === 0) {
    return (
      <Box sx={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="textSecondary">No raw data available</Typography>
      </Box>
    );
  }

  // Take last 50 samples for chart
  const chartData = data.slice(-50).map((item, index) => ({
    index: index,
    x_raw: item?.x_raw || 0,
    y_raw: item?.y_raw || 0,
    z_raw: item?.z_raw || 0,
    time: item?.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''
  }));

  return (
    <Box sx={{ width: '100%', height: 300 }}>
      <Typography variant="subtitle2" gutterBottom>Raw ADC Values History (last 50 samples)</Typography>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis dataKey="index" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <Box sx={{ bgcolor: 'background.paper', p: 1, border: '1px solid #444' }}>
                    <Typography variant="body2">Sample: {label}</Typography>
                    {payload.map((entry, i) => (
                      <Typography key={i} variant="body2" style={{ color: entry.color }}>
                        {entry.name}: {entry.value}
                      </Typography>
                    ))}
                  </Box>
                );
              }
              return null;
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="x_raw" stroke="#8884d8" name="X Raw" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="y_raw" stroke="#82ca9d" name="Y Raw" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="z_raw" stroke="#ffc658" name="Z Raw" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RawValueChart;
