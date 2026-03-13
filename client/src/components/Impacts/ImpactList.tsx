import React from 'react';
import {
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Chip,
    Box,
    Typography
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';

interface Impact {
    id: number;
    timestamp: string;
    peak_g: number;
    severity: string;
    latitude: number;
    longitude: number;
    speed: number;
}

interface ImpactListProps {
    impacts: Impact[];
}

const ImpactList: React.FC<ImpactListProps> = ({ impacts }) => {
    const getSeverityIcon = (severity: string) => {
        switch(severity) {
            case 'HIGH': return <ErrorIcon sx={{ color: '#ff4444' }} />;
            case 'MEDIUM': return <WarningIcon sx={{ color: '#ffbb33' }} />;
            default: return <InfoIcon sx={{ color: '#00C851' }} />;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch(severity) {
            case 'HIGH': return 'error';
            case 'MEDIUM': return 'warning';
            default: return 'success';
        }
    };

    return (
        <List>
            {impacts.map((impact) => (
                <ListItem key={impact.id} divider>
                    <ListItemIcon>
                        {getSeverityIcon(impact.severity)}
                    </ListItemIcon>
                    <ListItemText
                        primary={
                            <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="subtitle1">
                                    Impact Detected — {impact.severity}
                                </Typography>
                                <Chip 
                                    label={`${impact.peak_g.toFixed(3)} g`}
                                    size="small"
                                    color={getSeverityColor(impact.severity) as any}
                                />
                            </Box>
                        }
                        secondary={
                            <>
                                <Typography variant="body2" component="span">
                                    Time: {new Date(impact.timestamp).toLocaleTimeString()}
                                </Typography>
                                <br />
                                <Typography variant="body2" component="span">
                                    GPS: {impact.latitude.toFixed(6)}°, {impact.longitude.toFixed(6)}°
                                </Typography>
                                <br />
                                <Typography variant="body2" component="span">
                                    Speed: {impact.speed} km/h
                                </Typography>
                            </>
                        }
                    />
                </ListItem>
            ))}
        </List>
    );
};

export default ImpactList;
