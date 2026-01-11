import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useOnlineStatusListener } from './hooks/useOnlineStatus';
import { useConnectionStatusListener } from './hooks/useConnectionStatusListener';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UserManagement } from './pages/UserManagement';
import { AuditLogViewer } from './pages/AuditLogViewer';
import { Profile } from './pages/Profile';
import { Elections } from './pages/Elections';
import { ElectionResults } from './pages/ElectionResults';
import { ElectionCandidates } from './pages/ElectionCandidates';
import { CandidateProfile } from './pages/CandidateProfile';
import { ResultsEntry } from './pages/ResultsEntry';
import { ApprovalQueue } from './pages/ApprovalQueue';
import { MapDashboard } from './pages/MapDashboard';
import { DemographicsHome } from './pages/DemographicsHome';
import { DemographicsMap } from './pages/DemographicsMap';
import { DemographicsStats } from './pages/DemographicsStats';
import { IncidentsHome } from './pages/IncidentsHome';
import { IncidentsMap } from './pages/IncidentsMap';
import { IncidentsStats } from './pages/IncidentsStats';
import { BroadcastApp } from './pages/BroadcastApp';
import { PastElectionsDashboard } from './pages/PastElectionsDashboard';
import { CurrentElectionDashboard } from './pages/CurrentElectionDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { KeyboardShortcutsProvider } from './components/KeyboardShortcutsProvider';
import './App.css';

function App() {
  // Track online/offline status globally for basemap auto-switching
  useOnlineStatusListener();
  // Track connection status for sync indicator
  useConnectionStatusListener();

  return (
    <BrowserRouter>
      <KeyboardShortcutsProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRole={['admin']}>
              <Layout>
                <UserManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <ProtectedRoute requiredRole={['admin']}>
              <Layout>
                <AuditLogViewer />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/elections/past"
          element={
            <ProtectedRoute>
              <Layout>
                <PastElectionsDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/elections/2026"
          element={
            <ProtectedRoute>
              <Layout>
                <CurrentElectionDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/elections/browse"
          element={
            <ProtectedRoute>
              <Layout>
                <Elections />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/elections/map"
          element={
            <ProtectedRoute>
              <Layout>
                <MapDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Legacy route - redirect to past elections */}
        <Route
          path="/elections"
          element={<Navigate to="/elections/past" replace />}
        />
        <Route
          path="/elections/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ElectionResults />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/elections/:id/candidates"
          element={
            <ProtectedRoute requiredRole={['editor', 'admin']}>
              <Layout>
                <ElectionCandidates />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/elections/:electionId/candidates/:candidateId"
          element={
            <ProtectedRoute requiredRole={['editor', 'admin']}>
              <Layout>
                <CandidateProfile />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/elections/:id/enter-results"
          element={
            <ProtectedRoute requiredRole={['operator', 'editor', 'admin']}>
              <Layout>
                <ResultsEntry />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/approval-queue"
          element={
            <ProtectedRoute requiredRole={['editor', 'admin']}>
              <Layout>
                <ApprovalQueue />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Legacy route - redirect to elections map */}
        <Route
          path="/map"
          element={<Navigate to="/elections/map" replace />}
        />
        <Route
          path="/demographics"
          element={
            <ProtectedRoute>
              <Layout>
                <DemographicsHome />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/demographics/map"
          element={
            <ProtectedRoute>
              <Layout>
                <DemographicsMap />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/demographics/stats"
          element={
            <ProtectedRoute>
              <Layout>
                <DemographicsStats />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/incidents"
          element={
            <ProtectedRoute>
              <Layout>
                <IncidentsHome />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/incidents/map"
          element={
            <ProtectedRoute>
              <Layout>
                <IncidentsMap />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/incidents/stats"
          element={
            <ProtectedRoute>
              <Layout>
                <IncidentsStats />
              </Layout>
            </ProtectedRoute>
          }
        />
        {/* Legacy route - redirect issues to incidents */}
        <Route
          path="/issues"
          element={<Navigate to="/incidents" replace />}
        />
        <Route
          path="/issues/*"
          element={<Navigate to="/incidents" replace />}
        />
        <Route
          path="/broadcast"
          element={
            <ProtectedRoute>
              <BroadcastApp />
            </ProtectedRoute>
          }
        />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </KeyboardShortcutsProvider>
    </BrowserRouter>
  );
}

export default App;
