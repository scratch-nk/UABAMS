import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Chip,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import SpeedIcon from '@mui/icons-material/Speed';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { io } from 'socket.io-client';  // Add this import

import ImpactList from '../components/Impacts/ImpactList';
import GeolocationMap from '../components/Map/GeolocationMap';
import AccelerometerGraph from '../components/Accelerometer/AccelerometerGraph';
import RideComfortHistogram from '../components/Graphs/RideComfortHistogram';
import SpeedGraph from '../components/Graphs/SpeedGraph';
import HighSeverityAlert from '../components/Impacts/HighSeverityAlert';
import RawValueDisplay from '../components/Accelerometer/RawValueDisplay';
import RawValueChart from '../components/Accelerometer/RawValueChart';
import { fetchImpacts } from '../services/api';

const Monitoring = () => {
  const [impacts, setImpacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highSeverityAlert, setHighSeverityAlert] = useState(null);
  const [latestRawData, setLatestRawData] = useState(null);
  const [rawDataHistory, setRawDataHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Define handleSensorData ONLY ONCE
  const handleSensorData = (data) => {
    console.log('🔵 handleSensorData called with:', data);
    
    if (data?.deviceType === 'accelerometer') {
      console.log('🟢 Accelerometer data:', data.data);
      setLatestRawData(data.data);
      setRawDataHistory(prev => [...prev.slice(-99), data.data]);
      
      if (data.data?.peak_g > 2) {
        const newImpact = {
          id: Date.now(),
          timestamp: data.data.timestamp,
          peak_g: data.data.peak_g,
          severity: data.data.severity,
          latitude: data.data.latitude,
          longitude: data.data.longitude,
          speed: data.data.speed,
          x_raw: data.data.x_raw,
          y_raw: data.data.y_raw,
          z_raw: data.data.z_raw
        };
        setImpacts(prev => [newImpact, ...prev.slice(0, 49)]);
      }
    }
  };

  // WebSocket connection
  useEffect(() => {
    console.log('🔌 Setting up WebSocket connection...');
    
    const socket = io('http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected! Socket ID:', socket.id);
      setIsConnected(true);
    });
    
    socket.on('connect_error', (error) => {
      console.log('❌ WebSocket connection error:', error);
      setIsConnected(false);
    });
    
    socket.on('sensor-data', (data) => {
      console.log('📡 Received sensor data:', data);
      handleSensorData(data);
    });
    
    socket.on('initial-impacts', (data) => {
      console.log('📊 Initial impacts:', data);
      if (data && data.length > 0) {
        setImpacts(data);
      }
    });
    
    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });
    
    return () => {
      console.log('🔌 Disconnecting WebSocket...');
      socket.disconnect();
    };
  }, []); // Empty dependency array

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const data = await fetchImpacts();
      setImpacts(data);
    } catch (error) {
      console.error('Error loading impacts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Remove any SECOND handleSensorData function if it exists below this line!
  // There should be ONLY ONE handleSensorData function in the entire file

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header with connection status */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          MONITORING
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            icon={<SpeedIcon />}
            label={`Connected: ${isConnected ? '✅' : '❌'}`}
            color={isConnected ? 'success' : 'error'}
            variant="outlined"
          />
          <Tooltip title="Refresh">
            <IconButton onClick={loadInitialData}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* High Severity Alert */}
      {highSeverityAlert && (
        <HighSeverityAlert 
          alert={highSeverityAlert} 
          onClose={() => setHighSeverityAlert(null)}
        />
      )}

      <Grid container spacing={3}>
        {/* Left Column - Events and Impacts */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '600px', overflow: 'auto', mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon color="warning" />
              Accelerometer Triggered Events
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <ImpactList impacts={impacts} loading={loading} />
          </Paper>

          {/* Exception Report Summary */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Exception Report - Acceleration above Level 2
            </Typography>
            <Box sx={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #444' }}>Date</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #444' }}>KM From</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #444' }}>Axle Box Left</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #444' }}>Axle Box Right</th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #444' }}>Peak (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {impacts.filter(i => i.peak_g > 2).slice(0, 5).map((impact) => (
                    <tr key={impact.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #333' }}>
                        {new Date(impact.timestamp).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #333' }}>
                        {impact.km_marker || '--'}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #333' }}>
                        {impact.peak_g.toFixed(2)}g
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #333' }}>
                        {impact.peak_g.toFixed(2)}g
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #333' }}>
                        <Chip 
                          label={impact.severity}
                          size="small"
                          color={impact.severity === 'HIGH' ? 'error' : impact.severity === 'MEDIUM' ? 'warning' : 'success'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        </Grid>

        {/* Right Column - Maps and Graphs */}
        <Grid item xs={12} md={7}>
          {/* Map */}
          <Paper sx={{ p: 2, height: '400px', mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOnIcon color="primary" />
              Geolocation Map
            </Typography>
            <Box sx={{ height: 'calc(100% - 40px)' }}>
              <GeolocationMap impacts={impacts} />
            </Box>
          </Paper>

          {/* Accelerometer Graph */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Accelerometer g-Values (Stacked Area)
            </Typography>
            <Box sx={{ height: 250 }}>
              <AccelerometerGraph />
            </Box>
          </Paper>

          {/* Raw Values Display */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <RawValueDisplay data={latestRawData} />
          </Paper>

          {/* Raw Values History Chart */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <RawValueChart data={rawDataHistory} />
          </Paper>

          {/* Speed Graph and Comfort Index */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Speed (km/h) — Continuous
                </Typography>
                <Box sx={{ height: 200 }}>
                  <SpeedGraph />
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Ride Comfort Index
                </Typography>
                <Box sx={{ height: 200 }}>
                  <RideComfortHistogram />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Monitoring;

