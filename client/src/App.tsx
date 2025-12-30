import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UserManagement } from './pages/UserManagement';
import { Elections } from './pages/Elections';
import { ElectionResults } from './pages/ElectionResults';
import { ElectionCandidates } from './pages/ElectionCandidates';
import { ResultsEntry } from './pages/ResultsEntry';
import { ApprovalQueue } from './pages/ApprovalQueue';
import { MapDashboard } from './pages/MapDashboard';
import { DemographicsDashboard } from './pages/DemographicsDashboard';
import { IssuesDashboard } from './pages/IssuesDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import './App.css';

function App() {
  return (
    <BrowserRouter>
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
          path="/elections"
          element={
            <ProtectedRoute>
              <Layout>
                <Elections />
              </Layout>
            </ProtectedRoute>
          }
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
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <Layout>
                <MapDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/demographics"
          element={
            <ProtectedRoute>
              <Layout>
                <DemographicsDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/issues"
          element={
            <ProtectedRoute>
              <Layout>
                <IssuesDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
