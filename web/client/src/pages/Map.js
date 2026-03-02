import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import GeolocationMap from '../components/Map/GeolocationMap';
import { fetchImpacts } from '../services/api';

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.warn('Map render failed:', error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="textSecondary">Map unavailable — upgrade react-leaflet to v5 for React 19</Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

const MapPage = () => {
  const [impacts, setImpacts] = useState([]);
  // Remove unused trackData

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const impactsData = await fetchImpacts();
      setImpacts(impactsData.data || impactsData);
    } catch (error) {
      console.error('Error loading map data:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Track Map
      </Typography>
      
      <Paper sx={{ p: 2, height: '70vh' }}>
        <MapErrorBoundary>
          <GeolocationMap impacts={impacts} />
        </MapErrorBoundary>
      </Paper>
    </Box>
  );
};

export default MapPage;
