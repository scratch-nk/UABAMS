import React from 'react';
import { Paper, Box, Typography, Grid, Chip } from '@mui/material';

const RawValueDisplay = ({ data }) => {
  console.log('RawValueDisplay received:', data);
  
  if (!data) {
    return (
      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Raw ADC Values (ADXL345)
        </Typography>
        <Typography color="textSecondary" align="center">
          Waiting for data... (Check console for logs)
        </Typography>
      </Paper>
    );
  }

  // Format timestamp if available
  const lastUpdate = data.timestamp 
    ? new Date(data.timestamp).toLocaleTimeString() 
    : new Date().toLocaleTimeString();

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Raw ADC Values (ADXL345)
        </Typography>
        <Chip 
          label={`Last: ${lastUpdate}`}
          size="small"
          variant="outlined"
        />
      </Box>
      
      <Grid container spacing={3}>
        <Grid item xs={4}>
          <Box sx={{ 
            textAlign: 'center', 
            p: 2, 
            bgcolor: 'rgba(136, 132, 216, 0.1)', 
            borderRadius: 2,
            border: '1px solid #8884d8'
          }}>
            <Typography variant="caption" color="textSecondary" gutterBottom>
              X-Axis
            </Typography>
            <Typography variant="h3" sx={{ color: '#8884d8', fontWeight: 'bold' }}>
              {data.x_raw || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {data.x?.toFixed(3)} g
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={4}>
          <Box sx={{ 
            textAlign: 'center', 
            p: 2, 
            bgcolor: 'rgba(130, 202, 157, 0.1)', 
            borderRadius: 2,
            border: '1px solid #82ca9d'
          }}>
            <Typography variant="caption" color="textSecondary" gutterBottom>
              Y-Axis
            </Typography>
            <Typography variant="h3" sx={{ color: '#82ca9d', fontWeight: 'bold' }}>
              {data.y_raw || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {data.y?.toFixed(3)} g
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={4}>
          <Box sx={{ 
            textAlign: 'center', 
            p: 2, 
            bgcolor: 'rgba(255, 198, 88, 0.1)', 
            borderRadius: 2,
            border: '1px solid #ffc658'
          }}>
            <Typography variant="caption" color="textSecondary" gutterBottom>
              Z-Axis
            </Typography>
            <Typography variant="h3" sx={{ color: '#ffc658', fontWeight: 'bold' }}>
              {data.z_raw || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {data.z?.toFixed(3)} g
            </Typography>
          </Box>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="textSecondary">
          Scale: 1g = 256 LSB (±2g range)
        </Typography>
        <Chip 
          label={`Peak: ${data.peak_g?.toFixed(3)}g`}
          size="small"
          color={data.severity === 'HIGH' ? 'error' : data.severity === 'MEDIUM' ? 'warning' : 'success'}
        />
      </Box>
    </Paper>
  );
};

export default RawValueDisplay;
