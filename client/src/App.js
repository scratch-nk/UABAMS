import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Import your pages
import Dashboard from './pages/Dashboard';
import Monitoring from './pages/Monitoring';
import Events from './pages/Events';
import Graphs from './pages/Graphs';
import Map from './pages/Map';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

// Import the new Desktop App Layout
import DesktopAppLayout from './components/Layout/DesktopAppLayout';

// Import your context providers
import { AlertProvider } from './context/AlertContext';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#1e1e1e',
      paper: '#252526',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 13,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AlertProvider>
        <Router>
          <DesktopAppLayout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/monitoring" element={<Monitoring />} />
              <Route path="/events" element={<Events />} />
              <Route path="/graphs" element={<Graphs />} />
              <Route path="/map" element={<Map />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </DesktopAppLayout>
        </Router>
      </AlertProvider>
    </ThemeProvider>
  );
}

export default App;
