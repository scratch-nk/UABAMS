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

// Import the new Topbar Layout
import TopbarLayout from './components/Layout/TopbarLayout';

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
      default: '#0a1929',
      paper: '#1e293b',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AlertProvider>
        <Router>
          <TopbarLayout>  {/* This wraps all pages with the topbar */}
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
          </TopbarLayout>
        </Router>
      </AlertProvider>
    </ThemeProvider>
  );
}

export default App;
