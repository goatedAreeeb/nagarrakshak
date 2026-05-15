import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StoryPanel from '../components/landing/StoryPanel';
import LandingMapPanel from '../components/landing/LandingMapPanel';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState(0);

  if (loading) {
    return (
      <div className="landing-shell flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="landing-shell flex h-screen w-full overflow-hidden text-gray-300">
      <div className="relative z-10 h-full w-[55%] min-w-0">
        <StoryPanel onSectionChange={setActiveSection} />
      </div>

      <div className="relative z-0 hidden h-full w-[45%] min-w-0 lg:block">
        <LandingMapPanel activeSection={activeSection} />
      </div>

      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex h-24 items-center justify-between bg-gradient-to-b from-background via-background/90 to-transparent px-6 md:px-12">
        <Link to="/" className="pointer-events-auto group flex items-center gap-5">
          <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-white/5 bg-surface shadow-2xl">
            <img
              src="/images/logo.png"
              alt="Nagar Rakshak"
              className="h-10 w-10 object-contain opacity-80 transition-opacity group-hover:opacity-100"
            />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-[0.2em] text-white/90 transition-colors group-hover:text-white md:text-2xl">
              Nagar Rakshak
            </h1>
            <div className="flex items-center gap-2">
              <div className="h-px w-6 bg-white/20" />
              <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-gray-500">
                Hyderabad Civic Command
              </p>
            </div>
          </div>
        </Link>

        <div className="pointer-events-auto flex items-center gap-3">
          <Link
            to="/login"
            className="border border-white bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-black shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all hover:bg-gray-200"
          >
            Sign In
          </Link>
        </div>
      </header>
    </div>
  );
}
