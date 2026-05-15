import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

const hasSupabaseConfig =
  Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

function profileFromUser(sessionUser) {
  const meta = sessionUser.user_metadata || {};
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: meta.name || sessionUser.email?.split('@')[0] || 'User',
    role: meta.role || 'citizen',
    ward_id: meta.ward_id ? Number(meta.ward_id) : null,
    credits: 0,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const navigate = useNavigate();
  const profileFetchRef = useRef(0);

  const fetchProfile = useCallback(async (sessionUser) => {
    if (!sessionUser?.id) {
      setProfile(null);
      setProfileLoading(false);
      return null;
    }

    const fetchId = ++profileFetchRef.current;
    setProfileLoading(true);

    // Immediate fallback so UI never blocks on DB
    setProfile(profileFromUser(sessionUser));

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, wards(name)')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (fetchId !== profileFetchRef.current) return null;

      if (data) {
        setProfile(data);
        return data;
      }

      if (error) {
        console.warn('Profile fetch:', error.message);
      }

      const fallback = profileFromUser(sessionUser);
      const { data: inserted, error: upsertErr } = await supabase
        .from('users')
        .upsert(
          {
            id: fallback.id,
            email: fallback.email,
            name: fallback.name,
            role: fallback.role,
            ward_id: fallback.ward_id,
          },
          { onConflict: 'id' }
        )
        .select('*, wards(name)')
        .maybeSingle();

      if (fetchId !== profileFetchRef.current) return null;

      if (inserted) {
        setProfile(inserted);
        return inserted;
      }
      if (upsertErr) {
        console.warn('Profile upsert:', upsertErr.message);
      }
      return fallback;
    } catch (err) {
      console.error('Profile fetch failed:', err);
      return profileFromUser(sessionUser);
    } finally {
      if (fetchId === profileFetchRef.current) {
        setProfileLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    const finishLoading = () => {
      if (mounted) setLoading(false);
    };

    // Safety: never block UI more than 3s on auth
    const safetyTimer = window.setTimeout(finishLoading, 3000);

    const loadProfileDeferred = (sessionUser) => {
      window.setTimeout(() => {
        if (mounted && sessionUser) fetchProfile(sessionUser);
      }, 0);
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      if (error) console.warn('getSession:', error.message);

      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser) {
        loadProfileDeferred(sessionUser);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }

      window.clearTimeout(safetyTimer);
      finishLoading();
    }).catch((err) => {
      console.error('getSession failed:', err);
      if (mounted) {
        setUser(null);
        setProfile(null);
      }
      window.clearTimeout(safetyTimer);
      finishLoading();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProfileLoading(false);
        finishLoading();
        return;
      }

      if (sessionUser && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        loadProfileDeferred(sessionUser);
      }

      finishLoading();
    });

    return () => {
      mounted = false;
      window.clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  const refreshProfile = () => user && fetchProfile(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || 'citizen',
        loading,
        profileLoading,
        signOut,
        refreshProfile,
        supabaseConfigured: hasSupabaseConfig,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
