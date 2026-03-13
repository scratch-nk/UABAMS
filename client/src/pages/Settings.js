import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Grid
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

const Settings = () => {
  const [settings, setSettings] = useState({
    serverUrl: 'http://localhost:5000',
    mqttHost: 'localhost',
    mqttPort: '1883',
    highThreshold: '16',
    mediumThreshold: '8',
    lowThreshold: '2',
    realtimeAlerts: true,
    autoRefresh: true,
    refreshInterval: '5'
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSave = () => {
    // Save settings logic
    console.log('Saving settings:', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Settings saved successfully!
        </Alert>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Connection Settings
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Server URL"
              name="serverUrl"
              value={settings.serverUrl}
              onChange={handleChange}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="MQTT Host"
              name="mqttHost"
              value={settings.mqttHost}
              onChange={handleChange}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="MQTT Port"
              name="mqttPort"
              value={settings.mqttPort}
              onChange={handleChange}
              margin="normal"
            />
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom>
          Threshold Settings
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="HIGH Threshold (g)"
              name="highThreshold"
              value={settings.highThreshold}
              onChange={handleChange}
              margin="normal"
              type="number"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="MEDIUM Threshold (g)"
              name="mediumThreshold"
              value={settings.mediumThreshold}
              onChange={handleChange}
              margin="normal"
              type="number"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="LOW Threshold (g)"
              name="lowThreshold"
              value={settings.lowThreshold}
              onChange={handleChange}
              margin="normal"
              type="number"
            />
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom>
          Display Settings
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.realtimeAlerts}
                  onChange={handleChange}
                  name="realtimeAlerts"
                />
              }
              label="Enable Real-time Alerts"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoRefresh}
                  onChange={handleChange}
                  name="autoRefresh"
                />
              }
              label="Auto-refresh Data"
            />
          </Grid>
          {settings.autoRefresh && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Refresh Interval (seconds)"
                name="refreshInterval"
                value={settings.refreshInterval}
                onChange={handleChange}
                type="number"
              />
            </Grid>
          )}
        </Grid>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            size="large"
          >
            Save Settings
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Settings;
