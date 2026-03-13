const calculateSeverity = (gValue) => {
    if (gValue >= 15) {
        return 'HIGH';
    } else if (gValue >= 5) {
        return 'MEDIUM';
    } else if (gValue >= 2) {
        return 'LOW';
    } else {
        return 'NORMAL';
    }
};

const getSeverityColor = (severity) => {
    switch(severity) {
        case 'HIGH': return '#ff4444';
        case 'MEDIUM': return '#ffbb33';
        case 'LOW': return '#00C851';
        default: return '#33b5e5';
    }
};

const getSeverityThresholds = () => {
    return {
        HIGH: { min: 15, max: Infinity },
        MEDIUM: { min: 5, max: 15 },
        LOW: { min: 2, max: 5 },
        NORMAL: { min: 0, max: 2 }
    };
};

module.exports = { 
    calculateSeverity, 
    getSeverityColor,
    getSeverityThresholds 
};
