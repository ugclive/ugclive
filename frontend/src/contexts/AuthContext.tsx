import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, STORAGE_KEY, diagnoseAuthState } from "@/lib/supabase";
import { Session, User, AuthError } from "@supabase/supabase-js";
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

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isLoadingProfile: boolean;
  error: AuthError | Error | null;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'github' | 'google') => Promise<{ error?: string }>;
  refreshSession: () => Promise<boolean>;
  recoverSession: () => Promise<boolean>;
  isAdmin: boolean;
};

// Create AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for cached profile
const PROFILE_STORAGE_KEY = 'ugclive-user-profile';
// Profile fetch timeout in milliseconds
const PROFILE_FETCH_TIMEOUT = 3000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [error, setError] = useState<AuthError | Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Helper function to determine admin status
  const determineAdminStatus = (email: string | null | undefined): boolean => {
    return typeof email === 'string' && 
      (email.endsWith('@ugclive.com') || 
       email.endsWith('@ugcl.dev') ||
       email.endsWith('@liveavatar.ai'));
  };
  
  // Function to clean up corrupted auth state
  const cleanupAuthState = () => {
    try {
      console.log('[AuthContext] Checking for corrupted auth state');
      
      // Check if token is valid JSON
      const token = localStorage.getItem(STORAGE_KEY);
      if (token) {
        try {
          JSON.parse(token);
          return false; // Token is valid
        } catch (e) {
          console.error('[AuthContext] Corrupted token found, cleaning up');
          localStorage.removeItem(STORAGE_KEY);
          return true; // Token was corrupted and cleaned
        }
      }
      return false; // No token found
    } catch (error) {
      console.error('[AuthContext] Error cleaning up auth state:', error);
      return false;
    }
  };
  
  // Cache profile in localStorage for quicker loading
  const cacheProfile = (profileData: Profile | null) => {
    try {
      if (profileData) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileData));
      } else {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
      }
    } catch (error) {
      console.error('[AuthContext] Error caching profile:', error);
    }
  };
  
  // Get cached profile
  const getCachedProfile = (userId: string): Profile | null => {
    try {
      const cached = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Profile;
        // Only use cached profile if it matches current user
        if (parsed && parsed.id === userId) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('[AuthContext] Error loading cached profile:', error);
    }
    return null;
  };
  
  // Function to fetch user profile from Supabase with timeout
  const fetchProfile = async (userId: string) => {
    if (!userId) {
      console.error('[AuthContext] Attempted to fetch profile without userId');
      return null;
    }
    
    try {
      setIsLoadingProfile(true);
      console.log(`[AuthContext] Fetching profile for user ${userId}`);
      
      // Try to use cached profile first for faster loading
      const cachedProfile = getCachedProfile(userId);
      if (cachedProfile) {
        console.log('[AuthContext] Using cached profile while fetching fresh data');
        setProfile(cachedProfile);
        setIsAdmin(determineAdminStatus(cachedProfile.email || user?.email));
      }
      
      // Create a timeout promise
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Profile fetch timeout'));
        }, PROFILE_FETCH_TIMEOUT);
      });
      
      // Create the fetch profile promise
      const fetchProfilePromise = new Promise<Profile | null>(async (resolve) => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (error) {
            console.error('[AuthContext] Error fetching profile:', error);
            resolve(null);
            return;
          }
          
          console.log('[AuthContext] Profile fetched successfully');
          resolve(data as Profile);
        } catch (error) {
          console.error('[AuthContext] Unexpected error fetching profile:', error);
          resolve(null);
        }
      });
      
      // Race between timeout and fetch
      try {
        const profileData = await Promise.race([fetchProfilePromise, timeoutPromise]) as Profile | null;
        
        if (profileData) {
          // Handle successful fetch
          const isAdmin = determineAdminStatus(profileData.email || user?.email);
          
          setProfile(profileData);
          setIsAdmin(isAdmin);
          cacheProfile(profileData);
          return profileData;
        } else if (cachedProfile) {
          // If fetch failed but we have a cached profile, keep using it
          console.log('[AuthContext] Using cached profile due to fetch failure');
          return cachedProfile;
        }
        return null;
      } catch (error) {
        // Timeout occurred
        console.warn('[AuthContext] Profile fetch timed out after 3 seconds');
        
        if (cachedProfile) {
          console.log('[AuthContext] Using cached profile due to timeout');
          return cachedProfile;
        }
        
        return null;
      }
    } catch (error) {
      console.error('[AuthContext] Error in profile fetch process:', error);
      return null;
    } finally {
      setIsLoadingProfile(false);
    }
  };
  
  // Function to refresh the session
  const refreshSession = async (): Promise<boolean> => {
    try {
      console.log('[AuthContext] Refreshing session');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('[AuthContext] Session refresh error:', error);
        return false;
      }
      
      if (data.session) {
        console.log('[AuthContext] Session refreshed successfully');
        setSession(data.session);
        setUser(data.session.user);
        setSessionToken(data.session.access_token);
        return true;
      }
      
      console.log('[AuthContext] No session after refresh');
      return false;
    } catch (error) {
      console.error('[AuthContext] Unexpected error refreshing session:', error);
      return false;
    }
  };
  
  // Advanced recovery for broken auth states
  const recoverSession = async (): Promise<boolean> => {
    console.log('[AuthContext] Attempting session recovery');
    
    try {
      // First try standard refresh
      const refreshSucceeded = await refreshSession();
      if (refreshSucceeded) return true;
      
      // Next, try to get user directly
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        console.log('[AuthContext] Found user but no session, forcing refresh');
        
        // We have a user but broken session, try one more refresh
        const { data } = await supabase.auth.refreshSession();
        if (data.session) {
          console.log('[AuthContext] Recovery succeeded');
          setSession(data.session);
          setUser(data.session.user);
          setSessionToken(data.session.access_token);
          return true;
        }
      }
      
      // If we reach here, recovery failed
      console.log('[AuthContext] Recovery failed, clearing auth state');
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setSessionToken(null);
      cleanupAuthState();
      return false;
    } catch (error) {
      console.error('[AuthContext] Error during recovery:', error);
      return false;
    }
  };
  
  // Function to sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      console.log('[AuthContext] Signing out user');
      
      // Clear local state first
      setSessionToken(null);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[AuthContext] Error during sign out:', error);
        toast({
          title: "Error signing out",
          description: error.message,
          variant: "destructive"
        });
      } else {
        // Clear all state
        setSession(null);
        setUser(null);
        setProfile(null);
        cacheProfile(null); // Clear cached profile
        
        toast({
          title: "Signed out",
          description: "You have been signed out successfully"
        });
      }
    } catch (error) {
      console.error('[AuthContext] Unexpected error during sign out:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to sign in with OAuth
  const signInWithOAuth = async (provider: 'github' | 'google') => {
    try {
      console.log(`[AuthContext] Signing in with ${provider}`);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        console.error(`[AuthContext] Error signing in with ${provider}:`, error);
        toast({
          title: "Sign in failed",
          description: error.message,
          variant: "destructive"
        });
        return { error: error.message };
      }
      
      return {};
    } catch (error: any) {
      console.error(`[AuthContext] Unexpected error during ${provider} sign-in:`, error);
      return { error: error.message || `Failed to sign in with ${provider}` };
    }
  };
  
  // Initialize auth state
  useEffect(() => {
    // Don't run this effect more than once
    if (isInitialized) return;
    
    const initialize = async () => {
      try {
        console.log('[AuthContext] Initializing auth');
        setIsLoading(true);
        
        // Check for corrupted auth state first
        cleanupAuthState();
        
        // Get initial session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthContext] Error getting initial session:', error);
          setError(error);
          setIsLoading(false);
          return;
        }
        
        if (data.session) {
          console.log('[AuthContext] Found initial session');
          setSession(data.session);
          setUser(data.session.user);
          setSessionToken(data.session.access_token);
          
          // Get user profile
          await fetchProfile(data.session.user.id);
          
          // Log expiry time
          if (data.session.expires_at) {
            const expiresAt = new Date(data.session.expires_at * 1000);
            console.log(`[AuthContext] Session expires at ${expiresAt.toLocaleString()}`);
          }
        } else {
          console.log('[AuthContext] No initial session found');
        }
      } catch (error) {
        console.error('[AuthContext] Error during initialization:', error);
        setError(error as Error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };
    
    initialize();
  }, []);
  
  // Set up auth state change listener
  useEffect(() => {
    // Only set up listener once initialization is complete
    if (!isInitialized) return;
    
    console.log('[AuthContext] Setting up auth state listener');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AuthContext] Auth state changed: ${event}`);
        
        // Update session and user state
        setSession(session);
        setUser(session?.user ?? null);
        
        // Update API token
        setSessionToken(session?.access_token ?? null);
        
        // Handle specific events
        switch (event) {
          case 'SIGNED_IN':
            console.log('[AuthContext] User signed in');
            if (session?.user) {
              await fetchProfile(session.user.id);
            }
            break;
            
          case 'SIGNED_OUT':
            console.log('[AuthContext] User signed out');
            setProfile(null);
            cacheProfile(null);
            break;
            
          case 'TOKEN_REFRESHED':
            console.log('[AuthContext] Token refreshed');
            break;
            
          case 'USER_UPDATED':
            console.log('[AuthContext] User updated');
            if (session?.user) {
              await fetchProfile(session.user.id);
            }
            break;
        }
      }
    );
    
    // Clean up subscription on unmount
    return () => {
      console.log('[AuthContext] Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, [isInitialized]);
  
  // Refresh session periodically to prevent expiration
  useEffect(() => {
    if (!session || !isInitialized) return;
    
    // Refresh token if it expires in less than 10 minutes
    const checkTokenExpiration = async () => {
      if (!session?.expires_at) return;
      
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const minutesUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 60000);
      
      // Refresh if token expires in less than 10 minutes
      if (minutesUntilExpiry < 10) {
        console.log(`[AuthContext] Token expires in ${minutesUntilExpiry} minutes, refreshing`);
        await refreshSession();
      }
    };
    
    // Check immediately
    checkTokenExpiration();
    
    // Set up interval to check every 5 minutes
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [session, isInitialized]);
  
  // Set up network status listener to refresh session when coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('[AuthContext] Network connection restored, refreshing session');
      if (session) refreshSession();
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => window.removeEventListener('online', handleOnline);
  }, [session]);
  
  // Context value with all auth state and functions
  const value = {
    session,
    user,
    profile,
    isLoading,
    isLoadingProfile,
    error,
    signOut,
    signInWithOAuth,
    refreshSession,
    recoverSession,
    isAdmin
  };
  
  // Provide auth context to children
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}