import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-6xl font-bold text-accent-cyan">404</h1>
      <p className="text-text-secondary">Page not found</p>
      <Link to="/dashboard" className="btn-primary flex items-center gap-2">
        <Home size={18} /> Back to Dashboard
      </Link>
    </div>
  );
}
