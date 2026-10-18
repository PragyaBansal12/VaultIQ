import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Budgets from './pages/Budgets';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import AIAssistant from './pages/AIAssistant';
import Settings from './pages/Settings';
import HelpCenter from './pages/HelpCenter';
import Subscriptions from './pages/Subscriptions';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// A simple wrapper for protected routes
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  useEffect(() => {
    const applyTheme = (theme, accent) => {
      document.body.className = `theme-${theme} accent-${accent} antialiased`;
    };

    const loadAndApplyTheme = () => {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        const theme = user?.settings?.theme || 'dark';
        const accent = user?.settings?.accentColor || 'indigo';
        applyTheme(theme, accent);
      } catch (e) {}
    };

    loadAndApplyTheme();
    
    window.addEventListener('storage', loadAndApplyTheme);
    window.addEventListener('theme-changed', loadAndApplyTheme);
    
    const handlePreview = (e) => {
      try {
        const user = JSON.parse(localStorage.getItem('user'));
        let theme = user?.settings?.theme || 'dark';
        let accent = user?.settings?.accentColor || 'indigo';
        if (e.detail.field === 'theme') theme = e.detail.value;
        if (e.detail.field === 'accentColor') accent = e.detail.value;
        applyTheme(theme, accent);
      } catch (err) {}
    };
    window.addEventListener('theme-preview', handlePreview);

    return () => {
      window.removeEventListener('storage', loadAndApplyTheme);
      window.removeEventListener('theme-changed', loadAndApplyTheme);
      window.removeEventListener('theme-preview', handlePreview);
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/expenses"
          element={
            <ProtectedRoute>
              <Expenses />
            </ProtectedRoute>
          }
        />
        <Route path="/budgets"
          element={<ProtectedRoute><Budgets /></ProtectedRoute>}
        />
        <Route path="/analytics"
          element={<ProtectedRoute><Analytics /></ProtectedRoute>}
        />
        <Route path="/ai-assistant" 
          element={
            <ProtectedRoute>
              <AIAssistant />
            </ProtectedRoute>
          } 
        />
        <Route path="/reports"
          element={<ProtectedRoute><Reports /></ProtectedRoute>}
        />
        <Route path="/notifications"
          element={<ProtectedRoute><Notifications /></ProtectedRoute>}
        />
        <Route path="/subscriptions"
          element={
            <ProtectedRoute>
              <Subscriptions />
            </ProtectedRoute>
          }
        />
        <Route path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="/help-center"
          element={
            <ProtectedRoute>
              <HelpCenter />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;