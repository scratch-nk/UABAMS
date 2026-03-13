import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Typography,
  Chip,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const HighSeverityAlert = ({ alert, onClose }) => {
  return (
    <Alert 
      severity="error"
      sx={{ mb: 3 }}
      action={
        <IconButton
          aria-label="close"
          color="inherit"
          size="small"
          onClick={onClose}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      }
    >
      <AlertTitle sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
        HIGH SEVERITY INTERRUPT DETECTED
      </AlertTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant="body1">
          <strong>Time of Interrupt:</strong> {new Date(alert.timestamp).toLocaleString()}
        </Typography>
        <Typography variant="body1">
          <strong>Peak Acceleration:</strong> {alert.peak_g?.toFixed(3)} g
        </Typography>
        <Typography variant="body1">
          <strong>Location:</strong> {alert.location?.lat?.toFixed(6)}° N, {alert.location?.lng?.toFixed(6)}° E
        </Typography>
        <Typography variant="body1">
          <strong>Speed at Interrupt:</strong> {alert.speed?.toFixed(1)} km/h
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Chip 
            label="Section: CNB - ALD" 
            size="small" 
            sx={{ mr: 1, backgroundColor: 'rgba(255,255,255,0.1)' }}
          />
          <Chip 
            label="Railway: NCR" 
            size="small" 
            sx={{ mr: 1, backgroundColor: 'rgba(255,255,255,0.1)' }}
          />
          <Chip 
            label="Division: Northern" 
            size="small" 
            sx={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          />
        </Box>
      </Box>
    </Alert>
  );
};

export default HighSeverityAlert;
