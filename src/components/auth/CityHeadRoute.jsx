import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../shared/LoadingSpinner';

/** Renders children only when the signed-in user is City Head (role: city). */
export default function CityHeadRoute({ children }) {
  const { profile, profileLoading } = useAuth();

  if (profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (profile?.role !== 'city') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
