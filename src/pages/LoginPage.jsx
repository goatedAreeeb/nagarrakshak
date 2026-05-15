import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import Login from '../components/auth/Login';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-void px-4 py-12">
      <div className="absolute inset-0 bg-mesh-gradient pointer-events-none" />
      <Link
        to="/"
        className="absolute left-4 top-4 flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        Back to home
      </Link>
      <div className="relative w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white mb-4">
            <Shield className="h-7 w-7 text-void" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">NagarRakshak</h1>
          <p className="text-[15px] text-text-muted mt-1">Hyderabad civic platform</p>
        </div>
        <Login />
      </div>
    </div>
  );
}
