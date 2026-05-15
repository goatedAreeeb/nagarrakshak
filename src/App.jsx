import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoadingSpinner from './components/shared/LoadingSpinner';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ComplaintPage from './pages/ComplaintPage';
import FeedPage from './pages/FeedPage';
import MapPage from './pages/MapPage';
import BillboardPage from './pages/BillboardPage';
import BillboardPublishPage from './pages/BillboardPublishPage';
import LeadershipPage from './pages/LeadershipPage';
import CityHeadRoute from './components/auth/CityHeadRoute';
import CityAnalyticsPage from './pages/CityAnalyticsPage';
import NotFoundPage from './pages/NotFoundPage';
import LandingPage from './pages/LandingPage';
import { CityNoticesProvider } from './contexts/CityNoticesContext';

function ProtectedRoute({ children, citizenOnly = false }) {
  const { user, profile, loading, profileLoading, supabaseConfigured } = useAuth();

  if (!supabaseConfigured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-0 px-6 text-center">
        <p className="text-danger-400 font-medium">Supabase is not configured</p>
        <p className="text-sm text-text-muted mt-2 max-w-md">
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart the dev server.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-void">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-text-muted">Loading your session…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (citizenOnly && profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (citizenOnly && profile && profile.role !== 'citizen') {
    return <Navigate to="/dashboard" replace />;
  }

  return <CityNoticesProvider userZone={profile?.zone}>{children}</CityNoticesProvider>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/report"
        element={
          <ProtectedRoute citizenOnly>
            <ComplaintPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <FeedPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leadership"
        element={
          <ProtectedRoute>
            <LeadershipPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billboard"
        element={
          <ProtectedRoute>
            <BillboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billboard/publish"
        element={
          <ProtectedRoute>
            <CityHeadRoute>
              <BillboardPublishPage />
            </CityHeadRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/city/analytics"
        element={
          <ProtectedRoute>
            <CityHeadRoute>
              <CityAnalyticsPage />
            </CityHeadRoute>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
