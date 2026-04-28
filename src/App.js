import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useOrganization } from './hooks/useOrganization';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Layout from './components/layout/Layout';
import { ToastProvider } from './components/ui/Toast';

// Pages
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import NewAudit from './pages/NewAudit';
import AuditHistory from './pages/AuditHistory';
import CandidateDetail from './pages/CandidateDetail';
import Monitoring from './pages/Monitoring';
import ComplianceReports from './pages/ComplianceReports';
import Settings from './pages/Settings';
import Remediation from './pages/Remediation';
import NotFound from './pages/NotFound';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { organization, orgLoading } = useOrganization();

  if (loading || orgLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!organization) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Layout>{children}</Layout>;
}

// Root Route Component
function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <ToastProvider>
    <Router>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        
        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/new-audit"
          element={
            <ProtectedRoute>
              <NewAudit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit/:auditId"
          element={
            <ProtectedRoute>
              <AuditHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit/:auditId/candidate/:candidateId"
          element={
            <ProtectedRoute>
              <CandidateDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute>
              <Monitoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ComplianceReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/remediation"
          element={
            <ProtectedRoute>
              <Remediation />
            </ProtectedRoute>
          }
        />
        {/* 404 Catch-all */}
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <NotFound />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
    </ToastProvider>
  );
}

export default App;
