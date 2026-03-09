import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Alert,
    AlertTitle
} from '@mui/material';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import Map from '../Map/Map';
import ImpactList from '../Impacts/ImpactList';

interface Impact {
    id: number;
    timestamp: string;
    peak_g: number;
    severity: string;
    latitude: number;
    longitude: number;
    speed: number;
}

const MonitoringDashboard: React.FC = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [impacts, setImpacts] = useState<Impact[]>([]);
    const [realtimeData, setRealtimeData] = useState<any[]>([]);
    const [highSeverityAlert, setHighSeverityAlert] = useState<Impact | null>(null);

    useEffect(() => {
        const newSocket = io('http://localhost:5000');
        setSocket(newSocket);

        // Fetch initial impacts
        fetchImpacts();

        // Listen for real-time sensor data
        newSocket.on('sensor-data', (data) => {
            if (data.topic.includes('accelerometer')) {
                setRealtimeData(prev => [...prev.slice(-50), {
                    time: new Date().toLocaleTimeString(),
                    value: data.data.z // Assuming Z-axis for vertical acceleration
                }]);
                
                // Check for high severity
                if (data.data.z > 15) {
                    setHighSeverityAlert({
                        id: Date.now(),
                        timestamp: new Date().toISOString(),
                        peak_g: data.data.z,
                        severity: 'HIGH',
                        latitude: data.data.lat,
                        longitude: data.data.lng,
                        speed: data.data.speed
                    });
                }
            }
        });

        return () => {
            newSocket.close();
        };
    }, []);

    const fetchImpacts = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/impacts');
            const data = await response.json();
            setImpacts(data);
        } catch (error) {
            console.error('Error fetching impacts:', error);
        }
    };

    return (
        <Box sx={{ flexGrow: 1, p: 3 }}>
            {/* High Severity Alert */}
            {highSeverityAlert && (
                <Alert 
                    severity="error" 
                    sx={{ mb: 3 }}
                    onClose={() => setHighSeverityAlert(null)}
                >
                    <AlertTitle>HIGH SEVERITY INTERRUPT DETECTED</AlertTitle>
                    <Typography>
                        Peak Acceleration: {highSeverityAlert.peak_g.toFixed(3)}g | 
                        Location: {highSeverityAlert.latitude.toFixed(6)}°, {highSeverityAlert.longitude.toFixed(6)}° |
                        Speed: {highSeverityAlert.speed} km/h
                    </Typography>
                </Alert>
            )}

            <Grid container spacing={3}>
                {/* Accelerometer Graph */}
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Accelerometer g-Values (Real-time)
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={realtimeData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis domain={[0, 25]} />
                                <Tooltip />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#8884d8" 
                                    fill="#8884d8" 
                                    fillOpacity={0.3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Ride Comfort Index */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Ride Comfort Index
                        </Typography>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={[
                                    { range: '0-10', value: 5 },
                                    { range: '10-20', value: 12 },
                                    { range: '20-30', value: 8 },
                                    // Add more data
                                ]}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="range" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#82ca9d" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>

                {/* Map */}
                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 2, height: 400 }}>
                        <Typography variant="h6" gutterBottom>
                            Geolocation Map
                        </Typography>
                        <Map impacts={impacts} />
                    </Paper>
                </Grid>

                {/* Impact Events List */}
                <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 2, height: 400, overflow: 'auto' }}>
                        <Typography variant="h6" gutterBottom>
                            Accelerometer Triggered Events
                        </Typography>
                        <ImpactList impacts={impacts} />
                    </Paper>
                </Grid>

                {/* Speed Graph */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Speed (km/h) — Continuous
                        </Typography>
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart
                                data={impacts.map(impact => ({
                                    time: new Date(impact.timestamp).toLocaleTimeString(),
                                    speed: impact.speed
                                }))}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis domain={[80, 100]} />
                                <Tooltip />
                                <Line type="monotone" dataKey="speed" stroke="#ff7300" />
                            </LineChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default MonitoringDashboard;
