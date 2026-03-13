import React from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import AccelerometerGraph from '../components/Accelerometer/AccelerometerGraph';
import RideComfortHistogram from '../components/Graphs/RideComfortHistogram';
import SpeedGraph from '../components/Graphs/SpeedGraph';

const Graphs = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Analytics & Graphs
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Accelerometer g-Values
            </Typography>
            <Box sx={{ height: 'calc(100% - 40px)' }}>
              <AccelerometerGraph />
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Ride Comfort Index Distribution
            </Typography>
            <Box sx={{ height: 'calc(100% - 40px)' }}>
              <RideComfortHistogram />
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Speed Profile
            </Typography>
            <Box sx={{ height: 'calc(100% - 40px)' }}>
              <SpeedGraph />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Graphs;
