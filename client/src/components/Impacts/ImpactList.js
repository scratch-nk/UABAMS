import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Box,
  Typography,
  Skeleton,
  Divider
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SpeedIcon from '@mui/icons-material/Speed';
import LocationOnIcon from '@mui/icons-material/LocationOn';

const ImpactList = ({ impacts, loading }) => {
  const getSeverityIcon = (severity) => {
    switch(severity) {
      case 'HIGH': return <ErrorIcon sx={{ color: '#ff4444' }} />;
      case 'MEDIUM': return <WarningIcon sx={{ color: '#ffbb33' }} />;
      case 'LOW': return <InfoIcon sx={{ color: '#00C851' }} />;
      default: return <InfoIcon sx={{ color: '#33b5e5' }} />;
    }
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'success';
      default: return 'default';
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <List>
        {[1, 2, 3, 4, 5].map((i) => (
          <ListItem key={i} divider>
            <ListItemIcon>
              <Skeleton variant="circular" width={24} height={24} />
            </ListItemIcon>
            <ListItemText
              primary={<Skeleton width="60%" />}
              secondary={<Skeleton width="80%" />}
            />
          </ListItem>
        ))}
      </List>
    );
  }

  return (
    <List>
      {impacts.map((impact, index) => (
        <React.Fragment key={impact.id}>
          <ListItem alignItems="flex-start" sx={{ py: 2 }}>
            <ListItemIcon>
              {getSeverityIcon(impact.severity)}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography variant="subtitle1" component="span">
                    Impact Detected — {impact.severity}
                  </Typography>
                  <Chip 
                    label={`${impact.peak_g?.toFixed(3)} g`}
                    size="small"
                    color={getSeverityColor(impact.severity)}
                  />
                </Box>
              }
              secondary={
                <>
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <AccessTimeIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    <Typography variant="body2" component="span">
                      Time: {formatTime(impact.timestamp)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <LocationOnIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    <Typography variant="body2" component="span">
                      GPS: {impact.latitude?.toFixed(6)}° N, {impact.longitude?.toFixed(6)}° E
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    <SpeedIcon fontSize="small" sx={{ opacity: 0.7 }} />
                    <Typography variant="body2" component="span">
                      Speed: {impact.speed?.toFixed(1)} km/h
                    </Typography>
                  </Box>

                  {/* Add raw values display if available */}
                  {impact.x_raw && (
                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                      <Typography variant="caption" color="textSecondary">
                        Raw: X:{impact.x_raw} Y:{impact.y_raw} Z:{impact.z_raw}
                      </Typography>
                    </Box>
                  )}
                </>
              }
            />
          </ListItem>
          {index < impacts.length - 1 && <Divider variant="inset" component="li" />}
        </React.Fragment>
      ))}
      
      {impacts.length === 0 && (
        <ListItem>
          <ListItemText
            primary={
              <Typography color="textSecondary" align="center">
                No impact events detected
              </Typography>
            }
          />
        </ListItem>
      )}
    </List>
  );
};

export default ImpactList;
