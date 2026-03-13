import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TablePagination
} from '@mui/material';
import { fetchImpacts } from '../services/api';

const Events = () => {
  const [impacts, setImpacts] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const loadImpacts = useCallback(async () => {
    try {
      const data = await fetchImpacts(page + 1, rowsPerPage);
      setImpacts(data.data || data);
      setTotal(data.pagination?.total || data.length);
    } catch (error) {
      console.error('Error loading impacts:', error);
    }
  }, [page, rowsPerPage]);

  useEffect(() => {
    loadImpacts();
  }, [loadImpacts]);

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Events History
      </Typography>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Peak (g)</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Speed (km/h)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {impacts.map((impact) => (
              <TableRow key={impact.id}>
                <TableCell>
                  {new Date(impact.timestamp).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={impact.severity}
                    color={getSeverityColor(impact.severity)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{impact.peak_g?.toFixed(3)}</TableCell>
                <TableCell>
                  {impact.latitude?.toFixed(6)}, {impact.longitude?.toFixed(6)}
                </TableCell>
                <TableCell>{impact.speed?.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>
    </Box>
  );
};

export default Events;
