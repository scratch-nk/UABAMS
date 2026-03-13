import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  Paper
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import SensorsIcon from '@mui/icons-material/Sensors';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import SaveIcon from '@mui/icons-material/Save';
import SaveAsIcon from '@mui/icons-material/SaveAs';
import PrintIcon from '@mui/icons-material/Print';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import TimelineIcon from '@mui/icons-material/Timeline';
import MapIcon from '@mui/icons-material/Map';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import BuildIcon from '@mui/icons-material/Build';
import StorageIcon from '@mui/icons-material/Storage';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

// Styled Components
const MenuBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#1e1e1e',
  borderBottom: '1px solid #3c3c3c',
  boxShadow: 'none',
  position: 'relative',
}));

const MenuBarContent = styled(Toolbar)(({ theme }) => ({
  minHeight: '40px !important',
  padding: '0 8px',
  display: 'flex',
  justifyContent: 'space-between',
}));

const LeftMenuGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
}));

const RightMenuGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
}));

const MenuButton = styled(Box)(({ theme, active }) => ({
  padding: '6px 12px',
  fontSize: '0.9rem',
  color: active ? '#ffffff' : '#cccccc',
  backgroundColor: active ? '#3c3c3c' : 'transparent',
  borderRadius: '4px',
  cursor: 'default',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  '&:hover': {
    backgroundColor: '#3c3c3c',
    color: '#ffffff',
  }
}));

const StatusBar = styled(Box)(({ theme }) => ({
  backgroundColor: '#007acc',
  color: '#ffffff',
  padding: '2px 16px',
  fontSize: '0.75rem',
  display: 'flex',
  justifyContent: 'space-between',
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 1200,
}));

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  backgroundColor: '#1e1e1e',
  padding: '20px',
  overflow: 'auto',
  height: 'calc(100vh - 72px)', // Adjust based on menu + status bar
}));

const StyledMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    minWidth: '200px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  color: '#cccccc',
  fontSize: '0.9rem',
  padding: '6px 16px',
  '&:hover': {
    backgroundColor: '#3c3c3c',
  },
  '& .MuiListItemIcon-root': {
    color: '#cccccc',
    minWidth: '32px',
  },
}));

const ConnectionStatus = styled(Chip)(({ theme }) => ({
  backgroundColor: '#0f0f0f',
  color: '#9cdcf1',
  border: '1px solid #3c3c3c',
  height: '24px',
  '& .MuiChip-icon': {
    color: '#4ec9b0',
    fontSize: '16px',
  },
  '& .MuiChip-label': {
    fontSize: '0.75rem',
    padding: '0 8px',
  }
}));

const DesktopAppLayout = ({ children, activePage = 'dashboard' }) => {
  const navigate = useNavigate();
  const [menuState, setMenuState] = useState({
    file: null,
    dashboard: null,
    session: null,
    systems: null,
    configuration: null,
  });

  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));

  // Update time every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMenuOpen = (menu, event) => {
    setMenuState({ ...menuState, [menu]: event.currentTarget });
  };

  const handleMenuClose = (menu) => {
    setMenuState({ ...menuState, [menu]: null });
  };

  const handleNavigation = (path) => {
    navigate(path);
    // Close all menus
    setMenuState({
      file: null,
      dashboard: null,
      session: null,
      systems: null,
      configuration: null,
    });
  };

  // File menu items
  const fileMenuItems = [
    { label: 'Open', icon: <FileOpenIcon fontSize="small" />, action: () => console.log('Open file') },
    { label: 'Save', icon: <SaveIcon fontSize="small" />, action: () => console.log('Save file') },
    { label: 'Save As', icon: <SaveAsIcon fontSize="small" />, action: () => console.log('Save as') },
    { divider: true },
    { label: 'Print', icon: <PrintIcon fontSize="small" />, action: () => console.log('Print') },
    { divider: true },
    { label: 'Exit', icon: <ExitToAppIcon fontSize="small" />, action: () => console.log('Exit') },
  ];

  // Dashboard menu items
  const dashboardMenuItems = [
    { label: 'Main Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/dashboard' },
    { label: 'Monitoring View', icon: <MonitorHeartIcon fontSize="small" />, path: '/monitoring' },
    { label: 'Events Log', icon: <TimelineIcon fontSize="small" />, path: '/events' },
  ];

  // Session menu items
  const sessionMenuItems = [
    { label: 'New Session', icon: <StorageIcon fontSize="small" />, action: () => console.log('New session') },
    { label: 'Load Session', icon: <FileOpenIcon fontSize="small" />, action: () => console.log('Load session') },
    { label: 'Save Session', icon: <SaveIcon fontSize="small" />, action: () => console.log('Save session') },
    { divider: true },
    { label: 'Session Properties', action: () => console.log('Session properties') },
  ];

  // Systems menu items
  const systemsMenuItems = [
    { label: 'Accelerometer System', icon: <SensorsIcon fontSize="small" />, path: '/monitoring' },
    { label: 'GPS Tracking', icon: <MapIcon fontSize="small" />, path: '/map' },
    { label: 'Data Logger', icon: <StorageIcon fontSize="small" />, action: () => console.log('Data logger') },
  ];

  // Configuration menu items
  const configMenuItems = [
    { label: 'Settings', icon: <SettingsIcon fontSize="small" />, path: '/settings' },
    { label: 'Reports Configuration', icon: <DescriptionIcon fontSize="small" />, path: '/reports' },
    { label: 'System Preferences', icon: <BuildIcon fontSize="small" />, action: () => console.log('Preferences') },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#1e1e1e' }}>
      {/* Main Menu Bar */}
      <MenuBar position="static">
        <MenuBarContent>
          <LeftMenuGroup>
            {/* File Menu */}
            <MenuButton 
              active={menuState.file !== null}
              onClick={(e) => handleMenuOpen('file', e)}
            >
              File <KeyboardArrowDownIcon fontSize="small" />
            </MenuButton>
            <StyledMenu
                anchorEl={menuState.file}
                open={Boolean(menuState.file)}
                onClose={() => handleMenuClose('file')}
              >
                {fileMenuItems.map((item, index) => 
                  item.divider ? (
                    <Divider key={index} sx={{ backgroundColor: '#3c3c3c', my: 0.5 }} />
                  ) : (
                    <StyledMenuItem key={item.label} onClick={item.action}>
                      {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                      <ListItemText>{item.label}</ListItemText>
                    </StyledMenuItem>
                  )
                )}
              </StyledMenu>

            {/* Dashboard Menu */}
            <MenuButton 
              active={menuState.dashboard !== null}
              onClick={(e) => handleMenuOpen('dashboard', e)}
            >
              Dashboard <KeyboardArrowDownIcon fontSize="small" />
            </MenuButton>
            <StyledMenu
              anchorEl={menuState.dashboard}
              open={Boolean(menuState.dashboard)}
              onClose={() => handleMenuClose('dashboard')}
            >
              {dashboardMenuItems.map((item) => (
                <StyledMenuItem key={item.label} onClick={() => item.path ? handleNavigation(item.path) : item.action()}>
                  {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                  <ListItemText>{item.label}</ListItemText>
                </StyledMenuItem>
              ))}
            </StyledMenu>

            {/* Session Menu */}
            <MenuButton 
              active={menuState.session !== null}
              onClick={(e) => handleMenuOpen('session', e)}
            >
              Session <KeyboardArrowDownIcon fontSize="small" />
            </MenuButton>
            <StyledMenu
              anchorEl={menuState.session}
              open={Boolean(menuState.session)}
              onClose={() => handleMenuClose('session')}
            >
              {sessionMenuItems.map((item, index) => 
                item.divider ? (
                  <Divider key={index} sx={{ backgroundColor: '#3c3c3c', my: 0.5 }} />
                ) : (
                  <StyledMenuItem key={item.label} onClick={item.action}>
                    {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                    <ListItemText>{item.label}</ListItemText>
                  </StyledMenuItem>
                )
              )}
            </StyledMenu>

            {/* Systems Menu */}
            <MenuButton 
              active={menuState.systems !== null}
              onClick={(e) => handleMenuOpen('systems', e)}
            >
              Systems <KeyboardArrowDownIcon fontSize="small" />
            </MenuButton>
            <StyledMenu
              anchorEl={menuState.systems}
              open={Boolean(menuState.systems)}
              onClose={() => handleMenuClose('systems')}
            >
              {systemsMenuItems.map((item) => (
                <StyledMenuItem key={item.label} onClick={() => item.path ? handleNavigation(item.path) : item.action()}>
                  {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                  <ListItemText>{item.label}</ListItemText>
                </StyledMenuItem>
              ))}
            </StyledMenu>

            {/* Configuration Menu */}
            <MenuButton 
              active={menuState.configuration !== null}
              onClick={(e) => handleMenuOpen('configuration', e)}
            >
              Configuration <KeyboardArrowDownIcon fontSize="small" />
            </MenuButton>
            <StyledMenu
              anchorEl={menuState.configuration}
              open={Boolean(menuState.configuration)}
              onClose={() => handleMenuClose('configuration')}
            >
              {configMenuItems.map((item) => (
                <StyledMenuItem key={item.label} onClick={() => item.path ? handleNavigation(item.path) : item.action()}>
                  {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                  <ListItemText>{item.label}</ListItemText>
                </StyledMenuItem>
              ))}
            </StyledMenu>
          </LeftMenuGroup>

          <RightMenuGroup>
            <ConnectionStatus
              icon={<SensorsIcon />}
              label="LIVE"
              size="small"
            />
            <Typography variant="caption" sx={{ color: '#9cdcf1' }}>
              {time}
            </Typography>
            <IconButton size="small" sx={{ color: '#cccccc', p: 0.5 }}>
              <AccountCircleIcon fontSize="small" />
            </IconButton>
          </RightMenuGroup>
        </MenuBarContent>
      </MenuBar>

      {/* Content Area */}
      <ContentArea>
        {children}
      </ContentArea>

      {/* Status Bar */}
      <StatusBar>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <span>MTJ-AGC UP (26)</span>
          <span>RT23105011</span>
          <span>ZITMS • 9001</span>
        </Box>
        <Box sx={{ display: 'flex', gap: 3 }}>
          <span>Ready</span>
          <span>Ln 1, Col 1</span>
          <span>UTF-8</span>
        </Box>
      </StatusBar>
    </Box>
  );
};

export default DesktopAppLayout;
