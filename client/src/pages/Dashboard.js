import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { io } from 'socket.io-client';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningIcon from '@mui/icons-material/Warning';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TimelineIcon from '@mui/icons-material/Timeline';
import SensorsIcon from '@mui/icons-material/Sensors';
import { formatTimeIST } from '../utils/dateUtils';

const Dashboard = () => {
  const [latestData, setLatestData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    impactsToday: 0,
    highSeverity: 0,
    avgPeak: 0,
    maxPeak: 0
  });

  useEffect(() => {
    console.log('Dashboard: Setting up WebSocket connection...');
    
    const socket = io('http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('Dashboard: WebSocket connected');
      setIsConnected(true);
    });
    
    socket.on('connect_error', (error) => {
      console.log('Dashboard: Connection error:', error);
      setIsConnected(false);
    });
    
    socket.on('sensor-data', (data) => {
      if (data?.deviceType === 'accelerometer') {
        console.log('Dashboard: New accelerometer data', data.data);
        setLatestData(data.data);
      }
    });
    
    socket.on('initial-impacts', (data) => {
      if (data && data.length > 0) {
        // Calculate stats from last 24 hours
        const last24h = data.filter(d => 
          new Date(d.timestamp) > new Date(Date.now() - 24*60*60*1000)
        );
        
        setStats({
          impactsToday: last24h.length,
          highSeverity: last24h.filter(d => d.severity === 'HIGH').length,
          avgPeak: last24h.reduce((acc, d) => acc + d.peak_g, 0) / (last24h.length || 1),
          maxPeak: Math.max(...last24h.map(d => d.peak_g), 0)
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Dashboard: WebSocket disconnected');
      setIsConnected(false);
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'HIGH': return '#ff4444';
      case 'MEDIUM': return '#ffbb33';
      case 'LOW': return '#00C851';
      default: return '#33b5e5';
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header with connection status */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Dashboard
        </Typography>
        <Chip
          icon={<SensorsIcon />}
          label={isConnected ? 'Live Data: Connected' : 'Connecting...'}
          color={isConnected ? 'success' : 'error'}
          variant="outlined"
          sx={{ fontSize: '1rem', py: 2, px: 1 }}
        />
      </Box>

      {/* Live Accelerometer Readings */}
      <Paper sx={{ p: 3, mb: 4, background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)' }}>
        <Typography variant="h5" gutterBottom sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AnalyticsIcon />
          Live Accelerometer Readings
        </Typography>
        
        {latestData ? (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* X-Axis */}
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#8884d8', mb: 1 }}>X-Axis</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <Typography variant="h2" sx={{ color: '#8884d8', fontWeight: 'bold' }}>
                      {latestData.x_raw}
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      raw
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: '#8884d8' }}>
                    {latestData.x?.toFixed(3)} g
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Y-Axis */}
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#82ca9d', mb: 1 }}>Y-Axis</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <Typography variant="h2" sx={{ color: '#82ca9d', fontWeight: 'bold' }}>
                      {latestData.y_raw}
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      raw
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: '#82ca9d' }}>
                    {latestData.y?.toFixed(3)} g
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Z-Axis */}
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#ffc658', mb: 1 }}>Z-Axis</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <Typography variant="h2" sx={{ color: '#ffc658', fontWeight: 'bold' }}>
                      {latestData.z_raw}
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      raw
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: '#ffc658' }}>
                    {latestData.z?.toFixed(3)} g
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2, color: 'white' }}>Waiting for sensor data...</Typography>
          </Box>
        )}
        
        {latestData && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Chip 
              label={`Peak: ${latestData.peak_g?.toFixed(3)}g`}
              sx={{ 
                bgcolor: getSeverityColor(latestData.severity),
                color: 'black',
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}
            />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Last updated: {latestData.timestamp ? formatTimeIST(latestData.timestamp) : 'N/A'}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1e1e1e' }}>
            <TimelineIcon sx={{ fontSize: 40, color: '#8884d8', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {stats.impactsToday}
            </Typography>
            <Typography variant="body2" color="textSecondary">Impacts Today</Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1e1e1e' }}>
            <WarningIcon sx={{ fontSize: 40, color: '#ff4444', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {stats.highSeverity}
            </Typography>
            <Typography variant="body2" color="textSecondary">High Severity</Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1e1e1e' }}>
            <SpeedIcon sx={{ fontSize: 40, color: '#00C851', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {stats.avgPeak.toFixed(2)}g
            </Typography>
            <Typography variant="body2" color="textSecondary">Avg Peak</Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1e1e1e' }}>
            <AnalyticsIcon sx={{ fontSize: 40, color: '#ffbb33', mb: 1 }} />
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {stats.maxPeak.toFixed(2)}g
            </Typography>
            <Typography variant="body2" color="textSecondary">Max Peak</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Impacts Preview */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Recent Impacts
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {stats.impactsToday > 0 ? (
          <Typography>
            View detailed impacts in the <strong>Monitoring</strong> or <strong>Events</strong> tab.
          </Typography>
        ) : (
          <Typography color="textSecondary">
            No impacts detected in the last 24 hours. The system is operating normally.
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default Dashboard;
