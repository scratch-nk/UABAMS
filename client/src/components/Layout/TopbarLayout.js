import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Avatar
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import SensorsIcon from '@mui/icons-material/Sensors';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import EventIcon from '@mui/icons-material/Event';
import BarChartIcon from '@mui/icons-material/BarChart';
import MapIcon from '@mui/icons-material/Map';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const TopBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#2d2d2d',
  borderBottom: '2px solid #3c3c3c',
  boxShadow: 'none',
}));

const TopBarContent = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  minHeight: '64px',
  padding: '0 24px',
}));

const Logo = styled(Typography)(({ theme }) => ({
  color: '#4ec9b0',
  fontWeight: 'bold',
  fontSize: '1.5rem',
  marginRight: '32px',
  cursor: 'pointer',
}));

const NavTabs = styled(Tabs)(({ theme }) => ({
  flex: 1,
  '& .MuiTab-root': {
    color: '#cccccc',
    fontSize: '0.95rem',
    fontWeight: 500,
    minWidth: 'auto',
    padding: '12px 16px',
    textTransform: 'none',
    '&.Mui-selected': {
      color: '#4ec9b0',
    },
    '&:hover': {
      color: '#ffffff',
    }
  },
  '& .MuiTabs-indicator': {
    backgroundColor: '#4ec9b0',
    height: '3px',
  }
}));

const RightSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  marginLeft: 'auto',
}));

const ConnectionStatus = styled(Chip)(({ theme }) => ({
  backgroundColor: '#1a1a1a',
  color: '#9cdcf1',
  border: '1px solid #3c3c3c',
  '& .MuiChip-icon': {
    color: '#4ec9b0',
  }
}));

const MobileMenuButton = styled(IconButton)(({ theme }) => ({
  display: 'none',
  color: '#cccccc',
  '@media (max-width: 900px)': {
    display: 'flex',
  },
}));

const DesktopTabs = styled(Box)(({ theme }) => ({
  display: 'flex',
  '@media (max-width: 900px)': {
    display: 'none',
  },
}));

const MainContent = styled(Box)(({ theme }) => ({
  flex: 1,
  backgroundColor: '#1e1e1e',
  minHeight: 'calc(100vh - 64px)',
  overflow: 'auto',
}));

const TopbarLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));

  // Update time every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Define navigation tabs
  const tabs = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { label: 'Monitoring', icon: <MonitorHeartIcon />, path: '/monitoring' },
    { label: 'Events', icon: <EventIcon />, path: '/events' },
    { label: 'Graphs', icon: <BarChartIcon />, path: '/graphs' },
    { label: 'Map', icon: <MapIcon />, path: '/map' },
    { label: 'Reports', icon: <DescriptionIcon />, path: '/reports' },
    { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  // Get current tab value based on path
  const getCurrentTab = () => {
    const path = location.pathname;
    const index = tabs.findIndex(tab => tab.path === path);
    return index === -1 ? 0 : index;
  };

  const handleTabChange = (event, newValue) => {
    navigate(tabs[newValue].path);
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleMobileNav = (path) => {
    navigate(path);
    handleMobileMenuClose();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Navigation Bar */}
      <TopBar position="static">
        <TopBarContent>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Logo onClick={() => navigate('/dashboard')}>RailMonitor</Logo>
            
            {/* Mobile Menu Button */}
            <MobileMenuButton
              onClick={handleMobileMenuOpen}
            >
              <MenuIcon />
            </MobileMenuButton>

            {/* Desktop Tabs */}
            <DesktopTabs>
              <NavTabs value={getCurrentTab()} onChange={handleTabChange}>
                {tabs.map((tab, index) => (
                  <Tab key={index} icon={tab.icon} label={tab.label} iconPosition="start" />
                ))}
              </NavTabs>
            </DesktopTabs>
          </Box>

          <RightSection>
            <ConnectionStatus
              icon={<SensorsIcon />}
              label="Live"
              variant="outlined"
            />
            <Typography variant="body2" sx={{ color: '#9cdcf1' }}>
              {time}
            </Typography>
            <IconButton sx={{ color: '#cccccc' }}>
              <AccountCircleIcon />
            </IconButton>
          </RightSection>
        </TopBarContent>
      </TopBar>

      {/* Mobile Menu */}
      <Menu
        anchorEl={mobileMenuAnchor}
        open={Boolean(mobileMenuAnchor)}
        onClose={handleMobileMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: '#2d2d2d',
            color: '#cccccc',
            width: '200px',
          }
        }}
      >
        {tabs.map((tab, index) => (
          <MenuItem 
            key={index} 
            onClick={() => handleMobileNav(tab.path)}
            selected={location.pathname === tab.path}
            sx={{
              '&.Mui-selected': {
                backgroundColor: '#3a3a3a',
                color: '#4ec9b0',
              },
              '&:hover': {
                backgroundColor: '#3a3a3a',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {tab.icon}
              <Typography>{tab.label}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* Main Content Area */}
      <MainContent>
        {children}
      </MainContent>
    </Box>
  );
};

export default TopbarLayout;
