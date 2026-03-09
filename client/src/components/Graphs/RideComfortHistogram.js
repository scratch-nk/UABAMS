import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Box, Typography } from '@mui/material';
import { fetchComfortHistogram } from '../../services/api';

const RideComfortHistogram = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await fetchComfortHistogram();
      setData(result);
    } catch (error) {
      console.error('Error loading histogram:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBarColor = (range) => {
    const value = parseInt(range.split('-')[0]);
    if (value < 20) return '#00C851';
    if (value < 40) return '#33b5e5';
    if (value < 60) return '#ffbb33';
    if (value < 80) return '#ff8800';
    return '#ff4444';
  };

  if (loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="textSecondary">Loading...</Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
        <XAxis type="number" stroke="#888" />
        <YAxis 
          type="category" 
          dataKey="range" 
          stroke="#888"
          width={60}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <Box sx={{ bgcolor: 'background.paper', p: 1, border: '1px solid #444' }}>
                  <Typography variant="body2">
                    Range: {payload[0].payload.range}
                  </Typography>
                  <Typography variant="body2">
                    Occurrences: {payload[0].value}
                  </Typography>
                </Box>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="occurrences" fill="#8884d8" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default RideComfortHistogram;
