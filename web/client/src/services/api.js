import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Impacts API
export const fetchImpacts = async (page = 1, limit = 50) => {
  try {
    const response = await api.get('/impacts', { params: { page, limit } });
    return response.data.data || response.data;
  } catch (error) {
    console.error('Error fetching impacts:', error);
    throw error;
  }
};

export const fetchImpactsBySeverity = async (severity, limit = 50) => {
  try {
    const response = await api.get(`/impacts/severity/${severity}`, { params: { limit } });
    return response.data;
  } catch (error) {
    console.error('Error fetching impacts by severity:', error);
    throw error;
  }
};

export const fetchImpactStats = async () => {
  try {
    const response = await api.get('/impacts/stats/summary');
    return response.data;
  } catch (error) {
    console.error('Error fetching impact stats:', error);
    throw error;
  }
};

// Monitoring API
export const fetchAccelerometerData = async (timeRange = '1h') => {
  try {
    const response = await api.get(`/monitoring/accelerometer/${timeRange}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching accelerometer data:', error);
    throw error;
  }
};

export const fetchRealtimeData = async () => {
  try {
    const response = await api.get('/monitoring/realtime');
    return response.data;
  } catch (error) {
    console.error('Error fetching realtime data:', error);
    throw error;
  }
};

export const fetchComfortHistogram = async () => {
  try {
    const response = await api.get('/monitoring/comfort-histogram');
    return response.data;
  } catch (error) {
    console.error('Error fetching comfort histogram:', error);
    throw error;
  }
};

export const fetchRideComfort = async () => {
  try {
    const response = await api.get('/monitoring/ride-comfort');
    return response.data;
  } catch (error) {
    console.error('Error fetching ride comfort:', error);
    throw error;
  }
};

// GPS API
export const fetchCurrentLocation = async () => {
  try {
    const response = await api.get('/gps/current');
    return response.data;
  } catch (error) {
    console.error('Error fetching current location:', error);
    throw error;
  }
};

export const fetchLocationHistory = async (timeRange = '1h') => {
  try {
    const response = await api.get(`/gps/history/${timeRange}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching location history:', error);
    throw error;
  }
};

export const fetchTrackData = async () => {
  try {
    const response = await api.get('/gps/track');
    return response.data;
  } catch (error) {
    console.error('Error fetching track data:', error);
    throw error;
  }
};

// Speed data for graph
export const fetchSpeedData = async () => {
  try {
    const response = await api.get('/gps/track');
    return response.data;
  } catch (error) {
    console.error('Error fetching speed data:', error);
    throw error;
  }
};

export default api;
