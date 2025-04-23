import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
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
  hasHydrated: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  
  // Use ref to cache session for faster access and avoid redundant fetches
  const sessionCache = useRef<Session | null>(null);
  // Track auth state initialization
  const authStateInitialized = useRef<boolean>(false);
  // Track if UI was hydrated from cache to prevent overriding
  const hydratedFromCache = useRef<boolean>(false);
  // Track last session update timestamp to debounce multiple updates
  const lastSessionUpdateTime = useRef<number>(0);
  
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
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    if (!userId) {
      console.error('[AuthContext] Attempted to fetch profile without userId');
      return null;
    }
    
    // Try to use cached profile first for faster loading
    const cachedProfile = getCachedProfile(userId);
    if (cachedProfile) {
      // Set profile state if it's not already set to this profile
      // This makes the function more idempotent and reduces rerenders
      if (!profile || profile.id !== cachedProfile.id) {
        console.log('[AuthContext] Using cached profile');
        setProfile(cachedProfile);
        setIsAdmin(determineAdminStatus(cachedProfile.email || user?.email));
      }
      
      // If we've recently fetched this profile, don't fetch again
      // This prevents UI jank when switching tabs
      const lastUpdateTime = cachedProfile.updated_at ? new Date(cachedProfile.updated_at).getTime() : 0;
      const now = Date.now();
      if (lastUpdateTime && now - lastUpdateTime < 5 * 60 * 1000) { // 5 minutes
        console.log('[AuthContext] Skipping profile fetch - recently updated');
        return cachedProfile;
      }
    }
    
    try {
      setIsLoadingProfile(true);
      console.log(`[AuthContext] Fetching profile for user ${userId}`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Profile fetch timeout'));
        }, PROFILE_FETCH_TIMEOUT);
      });
      
      // Create the fetch profile promise - but don't await here yet
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
      
      // Start the fetch in the background but don't block UI hydration
      // The race is wrapped in a Promise.race with a timeout
      Promise.race([fetchProfilePromise, timeoutPromise])
        .then((profileData: Profile | null) => {
          if (profileData) {
            // Only update if this is newer than what we have
            const currentProfileUpdateTime = profile?.updated_at ? new Date(profile.updated_at).getTime() : 0;
            const newProfileUpdateTime = profileData.updated_at ? new Date(profileData.updated_at).getTime() : 0;
            
            if (!profile || !currentProfileUpdateTime || newProfileUpdateTime > currentProfileUpdateTime) {
              console.log('[AuthContext] Updating profile with fresh data');
              setProfile(profileData);
              setIsAdmin(determineAdminStatus(profileData.email || user?.email));
              cacheProfile(profileData);
            }
          }
        })
        .catch(error => {
          console.warn('[AuthContext] Background profile fetch failed:', error);
        })
        .finally(() => {
          setIsLoadingProfile(false);
        });
      
      // Return the cached profile immediately while the fetch happens in background
      return cachedProfile || null;
      
    } catch (error) {
      console.error('[AuthContext] Error in profile fetch process:', error);
      setIsLoadingProfile(false);
      return cachedProfile || null;
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
        updateAuthState(data.session, false); // Don't override hydrated UI state
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
          updateAuthState(data.session, false); // Don't override hydrated UI state
          return true;
        }
      }
      
      // If we reach here, recovery failed
      console.log('[AuthContext] Recovery failed, clearing auth state');
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      sessionCache.current = null;
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
      sessionCache.current = null;
      hydratedFromCache.current = false;
      
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
  
  // Helper for updating auth state with debouncing and hydration protection
  const updateAuthState = (newSession: Session | null, allowOverrideHydration: boolean = true) => {
    // Don't override hydrated UI state unless explicitly allowed
    if (hydratedFromCache.current && !allowOverrideHydration) {
      console.log('[AuthContext] Skipping updateAuthState - UI already hydrated from cache');
      
      // Still update the session cache for future use
      if (newSession) {
        sessionCache.current = newSession;
      }
      return;
    }
    
    // Debounce multiple rapid session updates (can happen during tab switches)
    const now = Date.now();
    if (now - lastSessionUpdateTime.current < 300) { // 300ms debounce
      console.log('[AuthContext] Debouncing rapid session update');
      return;
    }
    
    lastSessionUpdateTime.current = now;
    
    if (!newSession) {
      setSession(null);
      setUser(null);
      sessionCache.current = null;
      setSessionToken(null);
      return;
    }
    
    // Check if this is actually a different session to avoid unnecessary renders
    const isNewSession = !session || 
      session.access_token !== newSession.access_token || 
      session.refresh_token !== newSession.refresh_token;
    
    if (isNewSession) {
      console.log('[AuthContext] Updating session state');
      setSession(newSession);
      setUser(newSession.user);
      sessionCache.current = newSession;
      setSessionToken(newSession.access_token);
      
      // Log expiry time
      if (newSession.expires_at) {
        const expiresAt = new Date(newSession.expires_at * 1000);
        console.log(`[AuthContext] Session expires at ${expiresAt.toLocaleString()}`);
      }
    } else {
      console.log('[AuthContext] Skipping session update - unchanged session');
    }
  };
  
  // Fast hydration and auth initialization
  useEffect(() => {
    // Only run once
    if (authStateInitialized.current) return;
    authStateInitialized.current = true;
    
    console.log('[AuthContext] Starting auth initialization');
    setIsLoading(true);
    
    // Check for and clean up corrupted auth state
    cleanupAuthState();
    
    // PRIORITY 1: Fast hydration from localStorage - must happen before anything else
    try {
      console.log('[AuthContext] Attempting fast hydration from localStorage');
      
      // Check if we have a session in localStorage
      const cachedSessionStr = localStorage.getItem(STORAGE_KEY);
      const cachedProfileStr = localStorage.getItem(PROFILE_STORAGE_KEY);
      
      if (cachedSessionStr && cachedProfileStr) {
        try {
          // Parse cached data
          const cachedSession = JSON.parse(cachedSessionStr);
          const cachedProfile = JSON.parse(cachedProfileStr);
          
          // Validate cached session data structure
          if (cachedSession && 
              typeof cachedSession === 'object' && 
              cachedSession.access_token && 
              cachedSession.user?.id) {
            
            console.log('[AuthContext] Valid cached session and profile found, hydrating UI');
            
            // Set session-related state
            setSession(cachedSession);
            setUser(cachedSession.user);
            sessionCache.current = cachedSession;
            setSessionToken(cachedSession.access_token);
            
            // Set profile data and admin status
            setProfile(cachedProfile);
            setIsAdmin(determineAdminStatus(cachedProfile.email || cachedSession.user?.email));
            
            // Mark as hydrated to prevent overriding
            hydratedFromCache.current = true;
            
            // Stop loading immediately - don't wait for API responses
            setIsLoading(false);
            
            console.log('[AuthContext] UI hydrated from cache, continuing background refresh');
          }
        } catch (e) {
          console.error('[AuthContext] Error parsing cached session data:', e);
        }
      } else {
        console.log('[AuthContext] No cached session and profile found');
      }
    } catch (e) {
      console.error('[AuthContext] Error during fast hydration:', e);
    }
    
    // PRIORITY 2: Set up auth state change listener that won't block UI
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log(`[AuthContext] Auth state changed: ${event}`);
        
        if (newSession) {
          // Use the respectHydration flag to avoid overriding already hydrated UI
          updateAuthState(newSession, false);
          
          // Start profile fetch in the background without awaiting
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            if (newSession.user) {
              // Don't await - fetch profile in background to avoid blocking UI
              fetchProfile(newSession.user.id);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] User signed out');
          // Always apply sign out even if hydrated
          updateAuthState(null, true);
          setProfile(null);
          cacheProfile(null);
          hydratedFromCache.current = false;
        }
        
        // Set loading to false after processing auth change if still loading
        if (isLoading && !hydratedFromCache.current) {
          setIsLoading(false);
        }
      }
    );
    
    // PRIORITY 3: Background session fetch that won't override hydrated UI
    const getInitialSession = async () => {
      try {
        // If already hydrated from cache or we have a session, don't block UI
        if (hydratedFromCache.current || sessionCache.current) {
          // Still refresh the session in the background
          refreshSession();
          return;
        }
        
        // Otherwise, fetch session from Supabase
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthContext] Error getting initial session:', error);
          setError(error);
          setIsLoading(false);
          return;
        }
        
        if (data.session) {
          console.log('[AuthContext] Found initial session via getSession');
          updateAuthState(data.session, !hydratedFromCache.current);
          
          // Start profile fetch but don't await it if UI is already hydrated
          if (data.session.user && !hydratedFromCache.current) {
            fetchProfile(data.session.user.id);
          }
        } else {
          console.log('[AuthContext] No initial session found via getSession');
        }
        
        // Set loading to false after getSession completes if still loading
        if (isLoading && !hydratedFromCache.current) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[AuthContext] Error during initialization:', error);
        setError(error as Error);
        
        // Ensure loading is set to false even on error
        if (isLoading) {
          setIsLoading(false);
        }
      }
    };
    
    // Start background session fetch
    getInitialSession();
    
    // Clean up subscription on unmount
    return () => {
      console.log('[AuthContext] Cleaning up auth state listener');
      subscription.unsubscribe();
    };
  }, []);
  
  // Auto-refresh session when it's about to expire
  useEffect(() => {
    if (!session) return;
    
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
    
    // Check immediately but don't block
    checkTokenExpiration();
    
    // Set up interval to check every 5 minutes
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [session]);
  
  // Set up network status listener to refresh session when coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('[AuthContext] Network connection restored, refreshing session');
      if (session) refreshSession();
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[AuthContext] Tab became visible, refreshing session');
        if (session) refreshSession();
      }
    };
    
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session]);
  
  // Use effect to track when auth state has fully hydrated
  useEffect(() => {
    // Set hasHydrated to true when auth state is resolved
    // Either we have a profile (logged in) or we're not loading and have no session (logged out)
    if (!isLoading && (profile || !session)) {
      if (!hasHydrated) {
        console.log('[AuthContext] Auth state fully hydrated');
        setHasHydrated(true);
      }
    }
  }, [isLoading, profile, session, hasHydrated]);
  
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
    isAdmin,
    hasHydrated
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