import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [wardId, setWardId] = useState('');
  const [wards, setWards] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('wards')
      .select('id, name')
      .order('name')
      .then(({ data }) => setWards(data || []));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          name: trimmedName,
          ward_id: wardId || null,
          role: 'citizen',
        },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (!authData.user) {
      setLoading(false);
      setError('Could not create account. Please try again.');
      return;
    }

    // Profile row is created by DB trigger (handle_new_user). If session exists, upsert ward/name.
    if (authData.session) {
      const { error: profileError } = await supabase.from('users').upsert(
        {
          id: authData.user.id,
          email: trimmedEmail,
          name: trimmedName,
          role: 'citizen',
          ward_id: wardId ? Number(wardId) : null,
        },
        { onConflict: 'id' }
      );

      if (profileError && !/duplicate|violates row-level security/i.test(profileError.message)) {
        setLoading(false);
        setError(profileError.message);
        return;
      }
    }

    setLoading(false);

    if (authData.session) {
      navigate('/dashboard');
    } else {
      navigate('/login', {
        state: {
          message:
            'Account created. Check your email to confirm, then sign in. If you already confirmed, sign in now.',
        },
      });
    }
  };

  return (
    <div className="card w-full max-w-md shadow-card">
      <div className="flex flex-col items-center text-center mb-8">
        <Shield className="w-12 h-12 text-accent-cyan mb-3" strokeWidth={1.5} />
        <h1 className="text-xl font-semibold text-text-primary">NagarRakshak Hyderabad</h1>
        <p className="text-sm text-text-secondary mt-1">Register as a citizen</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm text-text-secondary mb-1.5">
            Full name
          </label>
          <input
            id="name"
            type="text"
            className="input-field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoComplete="name"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm text-text-secondary mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-text-secondary mb-1.5">
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
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="ward" className="block text-sm text-text-secondary mb-1.5">
            Ward
          </label>
          <select
            id="ward"
            className="input-field"
            value={wardId}
            onChange={(e) => setWardId(e.target.value)}
            required
          >
            <option value="">Select your ward</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-text-secondary mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-accent-cyan hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
