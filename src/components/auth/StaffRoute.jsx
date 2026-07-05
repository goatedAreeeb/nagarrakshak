import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../shared/LoadingSpinner';

const DEFAULT_ALLOWED = ['mp_staff', 'mp', 'analyst', 'district_authority_liaison', 'administrator'];

/** Renders children only when the signed-in user's role_v2 is in `allow`
 *  (default: any MP-office/staff role — excludes plain citizens). */
export default function StaffRoute({ children, allow = DEFAULT_ALLOWED }) {
  const { profile, profileLoading, roleV2 } = useAuth();

  if (profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!profile || !allow.includes(roleV2)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
