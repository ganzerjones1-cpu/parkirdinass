import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User, UserWithEmployee, UserRole } from '../types/database';

const AUTH_EMAIL_SUFFIX = '@garasi.ttuid';

interface SignInResult {
  error: Error | null;
  user: UserWithEmployee | null;
}

interface AuthContextType {
  user: User | null;
  userWithEmployee: UserWithEmployee | null;
  loading: boolean;
  role: UserRole | null;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPegawai: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userWithEmployee, setUserWithEmployee] = useState<UserWithEmployee | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserDetails = async (authId: string): Promise<UserWithEmployee | null> => {
    const { data: freshUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .maybeSingle();

    if (userError || !freshUser) return null;

    const { data: employeeData } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', freshUser.id)
      .maybeSingle();

    return { ...freshUser, employee: employeeData } as UserWithEmployee;
  };

  useEffect(() => {
    let mounted = true;

    // On mount, restore session if one exists.
    // onAuthStateChange fires INITIAL_SESSION once on subscribe. We fetch user
    // details (if logged in) and only then set loading=false, so the app never
    // sees loading=false + user=null simultaneously (which redirects to login).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT') {
          if (!mounted) return;
          setUser(null);
          setUserWithEmployee(null);
          setLoading(false);
          return;
        }

        if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            const details = await fetchUserDetails(session.user.id);
            if (mounted) {
              if (details) {
                setUser(details as User);
                setUserWithEmployee(details);
              }
              setLoading(false);
            }
          } else {
            if (mounted) setLoading(false);
          }
          return;
        }

        // SIGNED_IN / TOKEN_REFRESHED: update user data if available.
        // Never clear state or touch loading — signIn() owns the login flow.
        if (session?.user) {
          const details = await fetchUserDetails(session.user.id);
          if (details && mounted) {
            setUser(details as User);
            setUserWithEmployee(details);
          }
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string): Promise<SignInResult> => {
    try {
      setLoading(true);

      const email = `${username}${AUTH_EMAIL_SUFFIX}`;

      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setLoading(false);
        return { error: new Error('Username atau password salah'), user: null };
      }

      if (!authData.user) {
        setLoading(false);
        return { error: new Error('Login gagal. Silakan coba lagi.'), user: null };
      }

      // Fetch user details directly — don't rely on onAuthStateChange.
      const details = await fetchUserDetails(authData.user.id);

      if (!details) {
        // Auth succeeded but no matching row in public.users
        await supabase.auth.signOut();
        setLoading(false);
        return {
          error: new Error('Data pengguna tidak ditemukan. Hubungi admin.'),
          user: null,
        };
      }

      setUser(details as User);
      setUserWithEmployee(details);
      setLoading(false);

      return { error: null, user: details };
    } catch (error) {
      setLoading(false);
      return { error: error as Error, user: null };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserWithEmployee(null);
  };

  const refreshUserData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const details = await fetchUserDetails(session.user.id);
    if (details) {
      setUser(details as User);
      setUserWithEmployee(details);
    }
  };

  const role = user?.role || null;
  const isAdmin = role === 'admin_parkir' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const isPegawai = role === 'user_pegawai';

  return (
    <AuthContext.Provider
      value={{
        user,
        userWithEmployee,
        loading,
        role,
        signIn,
        signOut,
        refreshUserData,
        isAdmin,
        isSuperAdmin,
        isPegawai,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
