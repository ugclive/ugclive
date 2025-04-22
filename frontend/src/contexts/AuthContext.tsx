import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, diagnoseAuthState } from "@/integrations/supabase/client";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { toast } from "sonner";

// Types
export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  plan: 'free' | 'pro' | 'ultra';
  credits: number;
  created_at?: string;
  updated_at?: string;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: AuthError | Error | null;
};

type AuthContextType = AuthState & {
  signUp: (email: string, password: string, username?: string) => Promise<{ error?: string }>;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string, profile?: Profile }>;
  diagnoseAuth: () => Promise<any>;
};

// Enable debugging
const DEBUG_AUTH = true;

// Create AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Setup an auth debugging tool
const logAuth = (message: string, data?: any) => {
  if (DEBUG_AUTH) {
    console.log(`[AUTH] ${message}`, data !== undefined ? data : '');
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Auth state
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    error: null
  });

  // Update state helper
  const updateState = (newState: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...newState }));
  };
  
  // Fetch user profile helper
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      logAuth(`Fetching profile for user ID: ${userId}`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      logAuth('Profile fetched successfully', data);
      return data as Profile;
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      return null;
    }
  };
  
  // Session refresh function
  const refreshSession = async (): Promise<boolean> => {
    try {
      logAuth('Manually refreshing session');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        return false;
      }
      
      if (data.session) {
        updateState({ session: data.session, user: data.session.user });
        logAuth('Session refreshed successfully');
        return true;
      } else {
        logAuth('No session after refresh');
        return false;
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
      return false;
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      try {
        logAuth('Initializing auth state');
        
        // First check local storage for debugging
        if (DEBUG_AUTH) {
          const token = localStorage.getItem('sb-yoqsadxajmnqhhkajiyk-auth-token');
          logAuth(`Auth token in localStorage: ${token ? 'Present' : 'Not found'}`);
        }
        
        // Get current session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            updateState({ isLoading: false, error });
          }
          return;
        }
        
        if (!data.session) {
          logAuth('No active session found');
          if (mounted) {
            updateState({ isLoading: false });
          }
          return;
        }
        
        logAuth('Active session found', {
          user: data.session.user.email,
          expires: new Date(data.session.expires_at! * 1000).toLocaleString()
        });
        
        // Fetch user profile
        const profile = await fetchProfile(data.session.user.id);
        
        if (mounted) {
          updateState({
            session: data.session,
            user: data.session.user,
            profile,
            isLoading: false
          });
        }
      } catch (error) {
        console.error('Unexpected error during auth initialization:', error);
        if (mounted) {
          updateState({ isLoading: false, error: error as Error });
        }
      }
    };
    
    initAuth();
    
    // Setup auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logAuth(`Auth state changed: ${event}`, session ? 'Has session' : 'No session');
        
        if (session) {
          if (mounted) {
            updateState({ session, user: session.user, isLoading: true });
          }
          
          // Fetch profile after auth changes with session
          const profile = await fetchProfile(session.user.id);
          
          if (mounted) {
            updateState({ profile, isLoading: false });
          }
        } else {
          // No session means we should clear the state
          if (mounted) {
            updateState({ session: null, user: null, profile: null, isLoading: false });
          }
        }
      }
    );
    
    // Cleanup
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  
  // Sign up function
  const signUp = async (email: string, password: string, username?: string) => {
    try {
      logAuth('Signing up new user', { email, username });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username }
        }
      });
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      toast.success('Registration successful! Please check your email for verification.');
      return {};
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast.error(error.message || 'Failed to sign up');
      return { error: error.message || 'Failed to sign up' };
    }
  };
  
  // Login function
  const login = async (email: string, password: string) => {
    try {
      logAuth('Attempting login', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      // After successful login, update auth state
      updateState({ session: data.session, user: data.session!.user });
      
      // Try to extend the session
      try {
        await supabase.auth.updateUser({
          data: { extended_session: true }
        });
        
        // Refresh to apply changes
        await refreshSession();
      } catch (sessionError) {
        console.error("Error extending session:", sessionError);
      }
      
      toast.success('Logged in successfully');
      return {};
    } catch (error: any) {
      console.error('Error logging in:', error);
      toast.error(error.message || 'Failed to log in');
      return { error: error.message || 'Failed to log in' };
    }
  };
  
  // Sign out function
  const signOut = async () => {
    try {
      logAuth('Signing out user');
      
      // Thorough sign out
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error("Error during sign out:", error);
        toast.error('Error signing out');
      } else {
        // Clear auth state
        updateState({ session: null, user: null, profile: null });
        toast.success('Signed out successfully');
        
        // Clear storage items
        logAuth('Clearing auth storage items');
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('sb-') || key.includes('auth')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.error("Unexpected error during sign out:", error);
      toast.error('Failed to sign out completely');
    }
  };
  
  // Update profile function
  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!state.user) return { error: 'You must be logged in to update your profile' };
      
      logAuth('Updating user profile', updates);
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', state.user.id)
        .select()
        .single();
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      updateState({ profile: data as Profile });
      toast.success('Profile updated successfully');
      return { profile: data as Profile };
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
      return { error: error.message || 'Failed to update profile' };
    }
  };
  
  // Run auth diagnostics
  const diagnoseAuth = async () => {
    return await diagnoseAuthState();
  };
  
  // Build context value
  const contextValue: AuthContextType = {
    ...state,
    signUp,
    login,
    signOut,
    refreshSession,
    updateProfile,
    diagnoseAuth
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {/* Debug UI for development */}
      {DEBUG_AUTH && state.user && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '5px',
          fontSize: '10px',
          borderRadius: '3px',
          zIndex: 9999
        }}>
          Auth: {state.user.email}<br />
          {state.profile ? `Credits: ${state.profile.credits}` : 'No profile'}
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};
