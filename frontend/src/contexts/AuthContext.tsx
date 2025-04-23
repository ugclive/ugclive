import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { toast } from "@/components/ui/use-toast";
import { setSessionToken } from "@/services/api";

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
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'github' | 'google') => Promise<{ error?: string }>;
  refreshSession: () => Promise<boolean>;
  clearStorageData: () => void;
};

// Create AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      console.log(`Fetching profile for user ID: ${userId}`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      console.log('Profile fetched successfully');
      return data as Profile;
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
      return null;
    }
  };
  
  // Sign out function
  const signOut = async () => {
    try {
      console.log('Signing out user');
      
      const { error } = await supabase.auth.signOut();
      
      // Clear the API token on sign out
      setSessionToken(null);
      
      if (error) {
        console.error("Error during sign out:", error);
        toast({
          title: "Error",
          description: "Error signing out",
          variant: "destructive"
        });
      } else {
        // Clear auth state
        updateState({ session: null, user: null, profile: null });
        toast({
          title: "Success",
          description: "Signed out successfully"
        });
      }
    } catch (error) {
      console.error("Unexpected error during sign out:", error);
      toast({
        title: "Error",
        description: "Failed to sign out completely",
        variant: "destructive"
      });
    }
  };

  // OAuth sign-in function
  const signInWithOAuth = async (provider: 'github' | 'google') => {
    try {
      console.log(`Signing in with ${provider}`);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        console.error(`Error signing in with ${provider}:`, error);
        toast({
          title: "Authentication Error",
          description: error.message,
          variant: "destructive"
        });
        return { error: error.message };
      }
      
      return {};
    } catch (error: any) {
      console.error(`Unexpected error during ${provider} sign-in:`, error);
      toast({
        title: "Authentication Error",
        description: error.message || `Failed to sign in with ${provider}`,
        variant: "destructive"
      });
      return { error: error.message || `Failed to sign in with ${provider}` };
    }
  };

  // Session refresh function
  const refreshSession = async (): Promise<boolean> => {
    try {
      console.log('Refreshing session');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh error:', error);
        return false;
      }
      
      if (data.session) {
        updateState({ session: data.session, user: data.session.user });
        console.log('Session refreshed successfully');
        return true;
      } else {
        console.log('No session after refresh');
        return false;
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
      return false;
    }
  };

  // Clear storage data
  const clearStorageData = () => {
    try {
      console.log('Clearing auth storage data');
      
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear cookies
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Lax`;
      });
      
      return true;
    } catch (error) {
      console.error('Error clearing storage data:', error);
      return false;
    }
  };
  
  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      try {
        console.log('Initializing auth state');
        
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
          console.log('No active session found');
          if (mounted) {
            updateState({ isLoading: false });
          }
          return;
        }
        
        console.log('Active session found', {
          user: data.session.user.email
        });
        
        // Set the session token for API service
        setSessionToken(data.session.access_token);
        
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
        console.log(`Auth state changed: ${event}`, session ? 'Has session' : 'No session');
        
        if (session) {
          // Set the session token for API service
          setSessionToken(session.access_token);
          
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
          // Clear the session token for API service
          setSessionToken(null);
          
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
  
  // Build context value
  const contextValue: AuthContextType = {
    ...state,
    signOut,
    signInWithOAuth,
    refreshSession,
    clearStorageData
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
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