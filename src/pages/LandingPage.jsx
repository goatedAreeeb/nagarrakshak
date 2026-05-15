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
    <div className="landing-shell grid h-screen min-h-0 w-full grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
      <div className="landing-story-panel relative z-10 min-h-0 min-w-0 overflow-hidden">
        <StoryPanel onSectionChange={setActiveSection} />
      </div>

      <div className="landing-map-panel relative z-0 hidden min-h-0 min-w-0 lg:block">
        <LandingMapPanel activeSection={activeSection} />
      </div>

      <header className="landing-glass-header pointer-events-none fixed inset-x-0 top-0 z-50 flex h-20 items-center justify-between px-6 md:h-24 md:px-12">
        <Link to="/" className="pointer-events-auto group flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-lp-surface/80 shadow-lg ring-1 ring-cyan-500/20 backdrop-blur-md md:h-12 md:w-12">
            <img
              src="/images/logo.png"
              alt="Nagar Rakshak"
              className="h-9 w-9 object-contain opacity-90 transition-opacity group-hover:opacity-100"
            />
          </div>
          <div>
            <p className="landing-display text-lg font-bold uppercase tracking-[0.18em] text-white md:text-xl">
              Nagar Rakshak
            </p>
            <p className="landing-mono mt-0.5 text-[9px] uppercase tracking-[0.35em] text-slate-400">
              Hyderabad Civic Command
            </p>
          </div>
        </Link>

        <div className="pointer-events-auto flex items-center gap-2 md:gap-3">
          <Link
            to="/signup"
            className="landing-mono border border-white/25 bg-white/5 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-200 backdrop-blur-md transition-all hover:border-white/50 hover:bg-white/10 md:px-5 md:py-3"
          >
            Register
          </Link>
          <Link
            to="/login"
            className="landing-mono border border-white bg-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-black shadow-[0_0_32px_rgba(255,255,255,0.15)] transition-all hover:bg-slate-100 md:px-6 md:py-3"
          >
            Sign In
          </Link>
        </div>
      </header>
    </div>
  );
}
