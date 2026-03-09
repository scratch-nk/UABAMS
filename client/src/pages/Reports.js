import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Card,
  CardContent,
  CardActions
} from '@mui/material';  // Remove Paper from imports
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import BarChartIcon from '@mui/icons-material/BarChart';

const Reports = () => {
  const reports = [
    {
      title: 'Daily Impact Report',
      description: 'Summary of all impact events for the last 24 hours',
      icon: <BarChartIcon sx={{ fontSize: 40 }} />,
      type: 'daily'
    },
    {
      title: 'Exception Report',
      description: 'All events exceeding threshold levels',
      icon: <TableChartIcon sx={{ fontSize: 40 }} />,
      type: 'exception'
    },
    {
      title: 'Track Irregularities',
      description: 'Locations with repeated high impacts',
      icon: <PictureAsPdfIcon sx={{ fontSize: 40 }} />,
      type: 'track'
    }
  ];

  const handleGenerateReport = (type) => {
    console.log(`Generating ${type} report...`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>
      
      <Grid container spacing={3}>
        {reports.map((report, index) => (
          <Grid item xs={12} md={4} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  {report.icon}
                </Box>
                <Typography variant="h6" align="center" gutterBottom>
                  {report.title}
                </Typography>
                <Typography variant="body2" color="textSecondary" align="center">
                  {report.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button 
                  variant="contained" 
                  onClick={() => handleGenerateReport(report.type)}
                >
                  Generate Report
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Reports;
