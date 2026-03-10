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
  Divider,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Area
} from 'recharts';
import { io } from 'socket.io-client';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningIcon from '@mui/icons-material/Warning';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TimelineIcon from '@mui/icons-material/Timeline';
import SensorsIcon from '@mui/icons-material/Sensors';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import { formatTimeIST } from '../utils/dateUtils';

// ==================== TAB PANEL COMPONENT ====================
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// ==================== MAIN DASHBOARD COMPONENT ====================
const Dashboard = () => {
  const [latestData, setLatestData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [mainTabValue, setMainTabValue] = useState(0); // 0: Management, 1: Operator
  const [managementTabValue, setManagementTabValue] = useState(0); // 0: Sensor Values, 1: Graphs
  const [stats, setStats] = useState({
    impactsToday: 0,
    highSeverity: 0,
    avgPeak: 0,
    maxPeak: 0
  });

  // WebSocket connection
  useEffect(() => {
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
        setLatestData(data.data);
      }
    });
    
    socket.on('initial-impacts', (data) => {
      if (data && data.length > 0) {
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
      setIsConnected(false);
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleMainTabChange = (event, newValue) => {
    setMainTabValue(newValue);
  };

  const handleManagementTabChange = (event, newValue) => {
    setManagementTabValue(newValue);
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'HIGH': return '#ff4444';
      case 'MEDIUM': return '#ffbb33';
      case 'LOW': return '#00C851';
      default: return '#33b5e5';
    }
  };

  // ==================== ACCELERATION VS CHAINAGE GRAPH COMPONENT ====================
  const AccelerationVsChainage = () => {
    const [data, setData] = useState([]);
    const [peakData, setPeakData] = useState([]);
    const [rawData, setRawData] = useState([]);
    const [maxPoints] = useState(200);
    const [currentChainage, setCurrentChainage] = useState(0);

    // Initialize with some historical data
    useEffect(() => {
      const initialData = [];
      const initialPeakData = [];
      const initialRawData = [];
      
      for (let i = 0; i < 100; i++) {
        const chainage = i * 10;
        const point = generateDataPoint(chainage);
        initialData.push(point);
        
        const rawPoint = {
          chainage: chainage,
          time: new Date(Date.now() - (100 - i) * 2000).toLocaleTimeString(),
          accel1_x: Math.floor(Math.random() * 200 + 50),
          accel1_y: Math.floor(Math.random() * 200 - 100),
          accel1_z: Math.floor(Math.random() * 200 + 200),
          accel2_x: Math.floor(Math.random() * 200 + 40),
          accel2_y: Math.floor(Math.random() * 200 - 90),
          accel2_z: Math.floor(Math.random() * 200 + 190),
        };
        initialRawData.push(rawPoint);
        
        if (point.accel1_lateral > 5 || point.accel1_vertical > 5 || 
            point.accel2_lateral > 5 || point.accel2_vertical > 5) {
          initialPeakData.push({
            chainage: chainage,
            distance: chainage / 1000,
            accel1_lateral: point.accel1_lateral > 5 ? point.accel1_lateral : null,
            accel1_vertical: point.accel1_vertical > 5 ? point.accel1_vertical : null,
            accel2_lateral: point.accel2_lateral > 5 ? point.accel2_lateral : null,
            accel2_vertical: point.accel2_vertical > 5 ? point.accel2_vertical : null,
          });
        }
      }
      
      setData(initialData);
      setRawData(initialRawData);
      setPeakData(initialPeakData);
      setCurrentChainage(100 * 10);

      const interval = setInterval(() => {
        addNewDataPoint();
      }, 2000);

      return () => clearInterval(interval);
    }, []);

    const generateDataPoint = (chainage) => {
      const km = chainage / 1000;
      
      const accel1_lateral = 
        0.8 * Math.sin(km * 6) * Math.exp(-km * 0.3) + 
        0.4 * Math.sin(km * 25) * 0.5 +
        (chainage === 450 ? 6.2 : 0) +
        (chainage === 820 ? 7.8 : 0) +
        (chainage === 1250 ? 5.8 : 0) +
        (chainage === 1680 ? 6.2 : 0) +
        0.1 * Math.random();
      
      const accel1_vertical = 
        1.2 * Math.sin(km * 5 + 0.5) * Math.exp(-km * 0.2) + 
        0.6 * Math.cos(km * 30) * 0.3 +
        (chainage === 380 ? 5.9 : 0) +
        (chainage === 710 ? 7.4 : 0) +
        (chainage === 1420 ? 5.4 : 0) +
        (chainage === 1890 ? 6.9 : 0) +
        0.15 * Math.random();
      
      const accel2_lateral = 
        0.6 * Math.cos(km * 7) * Math.exp(-km * 0.4) + 
        0.3 * Math.sin(km * 20) * 0.6 +
        (chainage === 390 ? 5.7 : 0) +
        (chainage === 850 ? 7.1 : 0) +
        (chainage === 1310 ? 5.5 : 0) +
        (chainage === 1720 ? 6.8 : 0) +
        0.1 * Math.random();
      
      const accel2_vertical = 
        1.0 * Math.cos(km * 6) * Math.exp(-km * 0.25) + 
        0.5 * Math.sin(km * 35) * 0.4 +
        (chainage === 410 ? 5.6 : 0) +
        (chainage === 780 ? 7.2 : 0) +
        (chainage === 1380 ? 5.3 : 0) +
        (chainage === 1810 ? 6.7 : 0) +
        0.12 * Math.random();
      
      return {
        chainage: chainage,
        accel1_lateral: Number(Math.max(0.1, Math.abs(accel1_lateral)).toFixed(3)),
        accel1_vertical: Number(Math.max(0.1, Math.abs(accel1_vertical)).toFixed(3)),
        accel2_lateral: Number(Math.max(0.1, Math.abs(accel2_lateral)).toFixed(3)),
        accel2_vertical: Number(Math.max(0.1, Math.abs(accel2_vertical)).toFixed(3)),
        km: (chainage / 1000).toFixed(2)
      };
    };

    const addNewDataPoint = () => {
      setCurrentChainage(prev => {
        const newChainage = prev + 10;
        const newPoint = generateDataPoint(newChainage);
        
        setData(prevData => {
          const newData = [...prevData, newPoint];
          return newData.length > maxPoints ? newData.slice(-maxPoints) : newData;
        });
        
        setRawData(prevRaw => {
          const newRawPoint = {
            chainage: newChainage,
            time: new Date().toLocaleTimeString(),
            accel1_x: Math.floor(Math.random() * 200 + 50),
            accel1_y: Math.floor(Math.random() * 200 - 100),
            accel1_z: Math.floor(Math.random() * 200 + 200),
            accel2_x: Math.floor(Math.random() * 200 + 40),
            accel2_y: Math.floor(Math.random() * 200 - 90),
            accel2_z: Math.floor(Math.random() * 200 + 190),
          };
          const newRawData = [...prevRaw, newRawPoint];
          return newRawData.length > maxPoints ? newRawData.slice(-maxPoints) : newRawData;
        });
        
        if (newPoint.accel1_lateral > 5 || newPoint.accel1_vertical > 5 || 
            newPoint.accel2_lateral > 5 || newPoint.accel2_vertical > 5) {
          setPeakData(prevPeak => {
            const newPeakPoint = {
              chainage: newChainage,
              distance: newChainage / 1000,
              accel1_lateral: newPoint.accel1_lateral > 5 ? newPoint.accel1_lateral : null,
              accel1_vertical: newPoint.accel1_vertical > 5 ? newPoint.accel1_vertical : null,
              accel2_lateral: newPoint.accel2_lateral > 5 ? newPoint.accel2_lateral : null,
              accel2_vertical: newPoint.accel2_vertical > 5 ? newPoint.accel2_vertical : null,
            };
            const newPeakData = [...prevPeak, newPeakPoint];
            return newPeakData.length > 50 ? newPeakData.slice(-50) : newPeakData;
          });
        }
        
        return newChainage;
      });
    };

    const recentData = data.slice(-50);
    const currentPeaks = {
      accel1: Math.max(
        ...recentData.map(d => Math.max(d.accel1_lateral, d.accel1_vertical))
      ),
      accel2: Math.max(
        ...recentData.map(d => Math.max(d.accel2_lateral, d.accel2_vertical))
      )
    };

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ color: 'white' }}>
            Real-time Sensor Data
          </Typography>
          <Chip icon={<SensorsIcon />} label="Live: Adding every 2s" color="success" variant="outlined" />
        </Box>
        
        {/* Graph 1: Acceleration vs Chain-age */}
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', mb: 3 }}>
          <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
            Acceleration vs Chain-age
          </Typography>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ color: '#ff4444', fontWeight: 'bold' }}>
                Accelerometer 1
              </Typography>
              <Chip label={`Peak: ${currentPeaks.accel1.toFixed(2)}g`} size="small" sx={{ bgcolor: '#ff4444', color: 'white' }} />
            </Box>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="chainage" stroke="#888" tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 8]} stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#2d2d2d' }} />
                <Line type="monotone" dataKey="accel1_lateral" stroke="#ff4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="accel1_vertical" stroke="#ff8888" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ color: '#4444ff', fontWeight: 'bold' }}>
                Accelerometer 2
              </Typography>
              <Chip label={`Peak: ${currentPeaks.accel2.toFixed(2)}g`} size="small" sx={{ bgcolor: '#4444ff', color: 'white' }} />
            </Box>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="chainage" stroke="#888" tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 8]} stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#2d2d2d' }} />
                <Line type="monotone" dataKey="accel2_lateral" stroke="#4444ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="accel2_vertical" stroke="#8888ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Graph 2: Raw Values vs Time */}
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e', mb: 3 }}>
          <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
            Raw Values vs Time
          </Typography>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ color: '#ff4444', mb: 1 }}>Accelerometer 1</Typography>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={rawData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="time" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 500]} stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#2d2d2d' }} />
                <Line type="monotone" dataKey="accel1_x" stroke="#ff4444" strokeWidth={2} dot={false} name="X-axis" />
                <Line type="monotone" dataKey="accel1_y" stroke="#44ff44" strokeWidth={2} dot={false} name="Y-axis" />
                <Line type="monotone" dataKey="accel1_z" stroke="#4444ff" strokeWidth={2} dot={false} name="Z-axis" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#4444ff', mb: 1 }}>Accelerometer 2</Typography>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={rawData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="time" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 500]} stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#2d2d2d' }} />
                <Line type="monotone" dataKey="accel2_x" stroke="#ff8888" strokeWidth={2} dot={false} name="X-axis" />
                <Line type="monotone" dataKey="accel2_y" stroke="#88ff88" strokeWidth={2} dot={false} name="Y-axis" />
                <Line type="monotone" dataKey="accel2_z" stroke="#8888ff" strokeWidth={2} dot={false} name="Z-axis" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        {/* Graph 3: Peak Values vs Distance */}
        <Paper sx={{ p: 2, bgcolor: '#1e1e1e' }}>
          <Typography variant="h6" sx={{ color: 'white', mb: 2 }}>
            Peak Values vs Distance (>5g Events)
          </Typography>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ color: '#ff4444', mb: 1 }}>Accelerometer 1</Typography>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={peakData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="distance" stroke="#888" tickFormatter={(v) => `${v.toFixed(1)}k`} tick={{ fontSize: 10 }} />
                <YAxis domain={[5, 8]} stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#2d2d2d' }} />
                <Line type="monotone" dataKey="accel1_lateral" stroke="#ff4444" strokeWidth={2} dot={{ r: 4 }} name="Lateral" />
                <Line type="monotone" dataKey="accel1_vertical" stroke="#ff8888" strokeWidth={2} dot={{ r: 4 }} name="Vertical" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#4444ff', mb: 1 }}>Accelerometer 2</Typography>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={peakData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="distance" stroke="#888" tickFormatter={(v) => `${v.toFixed(1)}k`} tick={{ fontSize: 10 }} />
                <YAxis domain={[5, 8]} stroke="#888" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#2d2d2d' }} />
                <Line type="monotone" dataKey="accel2_lateral" stroke="#4444ff" strokeWidth={2} dot={{ r: 4 }} name="Lateral" />
                <Line type="monotone" dataKey="accel2_vertical" stroke="#8888ff" strokeWidth={2} dot={{ r: 4 }} name="Vertical" />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 1, borderTop: '1px solid #333' }}>
          <Typography variant="caption" color="textSecondary">Accel 1 | Accel 2</Typography>
          <Typography variant="caption" color="textSecondary">Last: {new Date().toLocaleTimeString()}</Typography>
        </Box>
      </Box>
    );
  };

  // ==================== QUICK STATISTICS COMPONENT ====================
  const QuickStatistics = () => (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>Quick Statistics</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1e1e1e' }}>
            <TimelineIcon sx={{ fontSize: 30, color: '#8884d8', mb: 1 }} />
            <Typography variant="h6">{stats.impactsToday}</Typography>
            <Typography variant="body2" color="textSecondary">Impacts Today</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1e1e1e' }}>
            <WarningIcon sx={{ fontSize: 30, color: '#ff4444', mb: 1 }} />
            <Typography variant="h6">{stats.highSeverity}</Typography>
            <Typography variant="body2" color="textSecondary">High Severity</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1e1e1e' }}>
            <SpeedIcon sx={{ fontSize: 30, color: '#00C851', mb: 1 }} />
            <Typography variant="h6">{stats.avgPeak.toFixed(2)}g</Typography>
            <Typography variant="body2" color="textSecondary">Avg Peak</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#1e1e1e' }}>
            <AnalyticsIcon sx={{ fontSize: 30, color: '#ffbb33', mb: 1 }} />
            <Typography variant="h6">{stats.maxPeak.toFixed(2)}g</Typography>
            <Typography variant="body2" color="textSecondary">Max Peak</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  // ==================== MAIN RENDER ====================
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          Railway Monitoring System
        </Typography>
        <Chip
          icon={<SensorsIcon />}
          label={isConnected ? 'Live Data: Connected' : 'Connecting...'}
          color={isConnected ? 'success' : 'error'}
          variant="outlined"
        />
      </Box>

      {/* Main Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={mainTabValue} onChange={handleMainTabChange}>
          <Tab icon={<AdminPanelSettingsIcon />} label="MANAGEMENT DASHBOARD" />
          <Tab icon={<PersonIcon />} label="OPERATOR DASHBOARD" />
        </Tabs>
      </Box>

      {/* Management Dashboard */}
      <TabPanel value={mainTabValue} index={0}>
        {/* Management Sub-tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={managementTabValue} onChange={handleManagementTabChange}>
            <Tab icon={<SensorsIcon />} label="SENSOR VALUES" />
            <Tab icon={<ShowChartIcon />} label="GRAPHS" />
          </Tabs>
        </Box>

        {/* Sensor Values Tab */}
        <TabPanel value={managementTabValue} index={0}>
          <Grid container spacing={3}>
            {/* Live Accelerometer Readings */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, background: 'linear-gradient(45deg, #1a237e 30%, #0d47a1 90%)' }}>
                <Typography variant="h5" gutterBottom sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SensorsIcon />
                  Live Accelerometer Readings
                </Typography>
                
                {latestData ? (
                  <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ color: '#8884d8', mb: 1 }}>X-Axis</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                            <Typography variant="h2" sx={{ color: '#8884d8', fontWeight: 'bold' }}>
                              {latestData.x_raw || 0}
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>raw</Typography>
                          </Box>
                          <Typography variant="h4" sx={{ color: '#8884d8' }}>
                            {latestData.x?.toFixed(3)} g
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ color: '#82ca9d', mb: 1 }}>Y-Axis</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                            <Typography variant="h2" sx={{ color: '#82ca9d', fontWeight: 'bold' }}>
                              {latestData.y_raw || 0}
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>raw</Typography>
                          </Box>
                          <Typography variant="h4" sx={{ color: '#82ca9d' }}>
                            {latestData.y?.toFixed(3)} g
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card sx={{ bgcolor: 'rgba(255,255,255,0.1)' }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ color: '#ffc658', mb: 1 }}>Z-Axis</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                            <Typography variant="h2" sx={{ color: '#ffc658', fontWeight: 'bold' }}>
                              {latestData.z_raw || 0}
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>raw</Typography>
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
                        fontWeight: 'bold'
                      }}
                    />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Last updated: {latestData.timestamp ? formatTimeIST(latestData.timestamp) : 'N/A'}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* GPS Values */}
            <Grid item xs={12}>
              <Paper sx={{ p: 3, bgcolor: '#1e1e1e' }}>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GpsFixedIcon color="primary" />
                  GPS Values
                </Typography>
                
                <TableContainer component={Paper} sx={{ bgcolor: '#2d2d2d', mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Parameter</TableCell>
                        <TableCell>Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Latitude</TableCell>
                        <TableCell>28.613567° N (Placeholder)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Longitude</TableCell>
                        <TableCell>77.209967° E (Placeholder)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Speed</TableCell>
                        <TableCell>95.1 km/h (Placeholder)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Altitude</TableCell>
                        <TableCell>216 m (Placeholder)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Satellites</TableCell>
                        <TableCell>12 (Placeholder)</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
          <QuickStatistics />
        </TabPanel>

        {/* Graphs Tab */}
        <TabPanel value={managementTabValue} index={1}>
          <AccelerationVsChainage />
          <QuickStatistics />
        </TabPanel>
      </TabPanel>

      {/* Operator Dashboard */}
      <TabPanel value={mainTabValue} index={1}>
        <Paper sx={{ p: 4, bgcolor: '#1e1e1e', textAlign: 'center' }}>
          <AssessmentIcon sx={{ fontSize: 60, color: '#8884d8', mb: 2 }} />
          <Typography variant="h5" gutterBottom>Operator Dashboard</Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            High-level overview for operators. Quick access to critical information.
          </Typography>
          
          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, bgcolor: '#2d2d2d' }}>
                <Typography variant="h4">{stats.impactsToday}</Typography>
                <Typography color="textSecondary">Total Impacts Today</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, bgcolor: '#2d2d2d' }}>
                <Typography variant="h4" sx={{ color: '#ff4444' }}>{stats.highSeverity}</Typography>
                <Typography color="textSecondary">High Severity Events</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, bgcolor: '#2d2d2d' }}>
                <Typography variant="h4">{stats.maxPeak.toFixed(2)}g</Typography>
                <Typography color="textSecondary">Maximum Peak</Typography>
              </Paper>
            </Grid>
          </Grid>
          
          <Grid container spacing={2} sx={{ mt: 3 }}>
            <Grid item xs={6}>
              <Button variant="contained" fullWidth startIcon={<WarningIcon />}>
                View Alerts
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button variant="outlined" fullWidth startIcon={<AssessmentIcon />}>
                Daily Report
              </Button>
            </Grid>
          </Grid>
        </Paper>
        <QuickStatistics />
      </TabPanel>
    </Box>
  );
};

export default Dashboard;
