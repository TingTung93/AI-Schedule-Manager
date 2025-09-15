import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import RuleInput from './components/RuleInput';
import { authService } from './services/api';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ScheduleProvider } from './context/ScheduleContext';
import { NotificationProvider } from './context/NotificationContext';

// Debug tools setup
import { setupDevTools } from './utils/debugTools';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    setIsAuthenticated(authService.isAuthenticated());

    // Setup debug tools in development
    if (process.env.NODE_ENV === 'development') {
      setupDevTools();
    }
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        <NotificationProvider>
          <ScheduleProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <Router>
                <Routes>
                  <Route path="/" element={<Navigate to="/rules" replace />} />
                  <Route path="/rules" element={<RuleInput />} />
                  <Route path="/login" element={
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                      <h2>Login Page (To be implemented)</h2>
                      <button onClick={() => {
                        // Mock login for testing
                        localStorage.setItem('token', 'test-token');
                        localStorage.setItem('user', JSON.stringify({ email: 'test@example.com', role: 'manager' }));
                        setIsAuthenticated(true);
                        window.location.href = '/rules';
                      }}>
                        Mock Login
                      </button>
                    </div>
                  } />
                </Routes>
              </Router>
            </ThemeProvider>
          </ScheduleProvider>
        </NotificationProvider>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;