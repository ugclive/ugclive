import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, diagnoseAuthState } from "@/integrations/supabase/client";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { SUPABASE_URL } from "@/config";

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
  clearAllStorageData: () => boolean;
};

// Enable debugging
const DEBUG_AUTH = false;

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
      
      // First try to get the existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('[AUTH] Error fetching profile:', error);
        
        // If the error is "not found", try to create a new profile
        if (error.code === 'PGRST116' || error.message?.includes('not found')) {
          logAuth('Profile not found, attempting to create one');
          
          try {
            // Get user details to use for profile creation
            const { data: userData } = await supabase.auth.getUser();
            const email = userData?.user?.email || '';
            const username = userData?.user?.user_metadata?.username || email?.split('@')[0] || 'user';
            
            // Create a default profile - retry up to 3 times with delay
            let profileCreated = false;
            let newProfile = null;
            let attempts = 0;
            
            while (!profileCreated && attempts < 3) {
              attempts++;
              
              try {
                // Wait a moment to ensure auth is fully processed
                if (attempts > 1) {
                  await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                  logAuth(`Retrying profile creation (attempt ${attempts})`);
                }
                
                // Refresh the session before trying profile creation
                if (attempts > 1) {
                  await refreshSession();
                }
                
                const { data: createdProfile, error: createError } = await supabase
                  .from('profiles')
                  .insert({
                    id: userId,
                    username: username,
                    email: email,
                    credits: 3, // Default starting credits
                    plan: 'free', // Default plan
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  })
                  .select()
                  .single();
                
                if (createError) {
                  console.error(`[AUTH] Error creating profile (attempt ${attempts}):`, createError);
                } else {
                  profileCreated = true;
                  newProfile = createdProfile;
                  logAuth('Successfully created new profile', newProfile);
                }
              } catch (createAttemptError) {
                console.error(`[AUTH] Exception during profile creation attempt ${attempts}:`, createAttemptError);
              }
            }
            
            if (!profileCreated) {
              logAuth('Failed to create profile after multiple attempts');
              return null;
            }
            
            return newProfile as Profile;
          } catch (profileCreationError) {
            console.error('[AUTH] Unexpected error during profile creation:', profileCreationError);
            return null;
          }
        }
        
        return null;
      }
      
      logAuth('Profile fetched successfully', data);
      return data as Profile;
    } catch (error) {
      console.error('[AUTH] Unexpected error fetching/creating profile:', error);
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

  // Add this after refreshSession function
  const validateAuthState = async (): Promise<boolean> => {
    try {
      logAuth('Validating auth state');
      
      // Get project ref from Supabase URL
      const getProjectRef = () => {
        try {
          const url = new URL(SUPABASE_URL);
          return url.hostname.split('.')[0];
        } catch {
          return 'unknown';
        }
      };
      
      const projectRef = getProjectRef();
      const storageKey = `sb-${projectRef}-auth-token`;
      
      // Check if we have a token in localStorage
      const token = localStorage.getItem(storageKey);
      if (!token) {
        logAuth('No auth token found in localStorage');
        return false;
      }
      
      // Try to parse the token to check it's not corrupted
      try {
        const parsedToken = JSON.parse(token);
        if (!parsedToken) {
          logAuth('Auth token is not valid JSON');
          return false;
        }
      } catch (e) {
        logAuth('Auth token is corrupted, clearing');
        localStorage.removeItem(storageKey);
        return false;
      }
      
      // Check if we can get a user with this token
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        logAuth('Token validation failed - invalid user');
        return false;
      }
      
      // Check if the token is close to expiry
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.expires_at) {
        const expiresAt = new Date(sessionData.session.expires_at * 1000);
        const now = new Date();
        const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60));
        
        logAuth(`Session expires in ${minutesUntilExpiry} minutes`);
        
        // If token expires in less than 10 minutes, refresh it
        if (minutesUntilExpiry < 10) {
          logAuth('Token expiring soon, refreshing');
          await refreshSession();
        }
      }
      
      logAuth('Auth state validation successful');
      return true;
    } catch (error) {
      console.error('[AUTH] Error validating auth state:', error);
      return false;
    }
  };
  
  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      try {
        logAuth('Initializing auth state');
        
        // First validate the auth state
        const isValid = await validateAuthState();
        if (!isValid) {
          logAuth('Auth state validation failed, clearing state');
          if (mounted) {
            updateState({ isLoading: false });
          }
          return;
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
          let profile = await fetchProfile(session.user.id);
          
          // If profile is still null after fetch, try to create one as a fallback
          if (!profile) {
            logAuth('Profile still null after fetch, attempting recovery');
            
            // Wait a moment to ensure any database triggers have completed
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try again with profile creation logic
            profile = await fetchProfile(session.user.id);
            
            if (!profile) {
              console.error('[AUTH] Failed to create profile after multiple attempts');
              toast.error('Error loading your profile. Please try logging in again.');
            }
          }
          
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
      
      // Clear any existing tokens first
      const projectRef = SUPABASE_URL.split('.')[0].replace('https://', '');
      const storageKey = `sb-${projectRef}-auth-token`;
      localStorage.removeItem(storageKey);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      // Force storage of the session token - sometimes Supabase doesn't do this correctly
      if (data.session) {
        // Store session token manually as a backup
        localStorage.setItem(storageKey, JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }));
        
        // After successful login, update auth state
        updateState({ session: data.session, user: data.session.user });
        
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
      } else {
        toast.error('Login successful but no session was created');
        return { error: 'No session created' };
      }
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
      
      // Get the project ref for the storage key
      const getProjectRef = () => {
        try {
          const url = new URL(SUPABASE_URL);
          return url.hostname.split('.')[0];
        } catch {
          return 'unknown';
        }
      };
      
      const projectRef = getProjectRef();
      const storageKey = `sb-${projectRef}-auth-token`;
      
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
        
        // Clear localStorage items
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('sb-') || key.includes('auth')) {
            localStorage.removeItem(key);
          }
        });
        
        // Specifically clear the project-specific auth token
        localStorage.removeItem(storageKey);
        
        // Also clear cookies for good measure
        document.cookie.split(';').forEach(cookie => {
          const name = cookie.split('=')[0].trim();
          if (name.includes('sb-') || name.includes('supabase') || name.includes('auth')) {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Lax`;
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
  
  // Utility function to clear all storage data - useful for troubleshooting
  const clearAllStorageData = () => {
    try {
      logAuth('Clearing all storage data');
      
      // Clear localStorage
      localStorage.clear();
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear cookies
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; SameSite=Lax`;
      });
      
      logAuth('All storage data cleared');
      return true;
    } catch (error) {
      console.error('Error clearing storage data:', error);
      return false;
    }
  };
  
  // Build context value
  const contextValue: AuthContextType = {
    ...state,
    signUp,
    login,
    signOut,
    refreshSession,
    updateProfile,
    diagnoseAuth,
    clearAllStorageData
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