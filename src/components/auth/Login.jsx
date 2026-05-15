import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const DEMO_PASSWORD = 'demo123';

const DEMO_ACCOUNTS = [
  { email: 'citizen1@demo.com', label: 'Citizen' },
  { email: 'worker1@demo.com', label: 'Worker' },
  { email: 'officer1@demo.com', label: 'Officer' },
  { email: 'supervisor1@demo.com', label: 'Supervisor' },
  { email: 'city1@demo.com', label: 'City Head' },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signIn = async (loginEmail, loginPassword) => {
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    navigate('/dashboard');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    signIn(email.trim(), password);
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary">Sign in</h2>
        <p className="text-sm text-text-muted mt-1">Access your civic dashboard</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Work email
          </label>
          <input
            id="email"
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-sm text-danger-400 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Continue to dashboard'}
        </button>
      </form>

      <p className="text-center text-sm text-text-muted mt-6">
        New citizen?{' '}
        <Link to="/signup" className="text-brand-400 font-medium hover:text-brand-300">
          Register
        </Link>
      </p>

      <div className="mt-8 pt-6 border-t border-border-subtle">
        <p className="text-[11px] font-medium uppercase tracking-wider text-text-hint text-center mb-3">
          Quick demo access
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          {DEMO_ACCOUNTS.map(({ email: demoEmail, label }) => (
            <button
              key={demoEmail}
              type="button"
              onClick={() => handleDemoClick(demoEmail)}
              disabled={loading}
              className="rounded-lg border border-border-subtle bg-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-brand-500/40 hover:text-brand-400 transition-colors disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-text-hint text-center mt-2">Password: demo123</p>
      </div>
    </div>
  );

  function handleDemoClick(demoEmail) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    signIn(demoEmail, DEMO_PASSWORD);
  }
}
