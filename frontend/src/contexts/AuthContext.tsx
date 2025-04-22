import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

// Add this constant for enabling debug mode
const AUTH_DEBUG = true;

// Function for tracking auth state transitions - this can help identify loops
function useAuthStateTracker() {
  // Keep track of the last 10 auth state changes with timestamps
  const [stateHistory, setStateHistory] = useState<Array<{
    event: string;
    hasSession: boolean;
    hasUser: boolean;
    hasProfile: boolean;
    isLoading: boolean;
    timestamp: Date;
  }>>([]);

  // Function to add a new state to the history
  const trackState = (event: string, hasSession: boolean, hasUser: boolean, hasProfile: boolean, isLoading: boolean) => {
    if (!AUTH_DEBUG) return;

    setStateHistory(prev => {
      // Keep only the last 10 items
      const newHistory = [
        {
          event,
          hasSession,
          hasUser,
          hasProfile,
          isLoading,
          timestamp: new Date()
        },
        ...prev
      ].slice(0, 10);
      
      // Log to console
      console.log(`AUTH DEBUG [${event}]: session=${hasSession}, user=${hasUser}, profile=${hasProfile}, loading=${isLoading}`);
      
      // Check for potential loops (same state change within a short period)
      if (newHistory.length >= 2) {
        const latest = newHistory[0];
        const previous = newHistory[1];
        
        // If same event repeats quickly (within 3 seconds)
        const timeDiff = latest.timestamp.getTime() - previous.timestamp.getTime();
        if (
          latest.event === previous.event && 
          latest.hasSession === previous.hasSession &&
          latest.hasUser === previous.hasUser &&
          latest.isLoading === previous.isLoading &&
          timeDiff < 3000
        ) {
          console.warn('⚠️ Possible authentication loop detected! Same state change twice within 3 seconds.');
        }
      }
      
      return newHistory;
    });
  };

  return { stateHistory, trackState };
}

type Plan = 'free' | 'pro' | 'ultra';

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  plan: Plan;
  credits: number;
  created_at?: string;
  updated_at?: string;
};

type SignUpData = {
  email: string;
  password: string;
  username?: string;
};

type LoginData = {
  email: string;
  password: string;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  signUp: (data: SignUpData) => Promise<{ error?: string }>;
  login: (data: LoginData) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ error?: string }>;
  resetPassword: (password: string) => Promise<{ error?: string }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string, profile?: Profile }>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,
  signUp: async () => ({ }),
  login: async () => ({ }),
  signOut: async () => {},
  forgotPassword: async () => ({ }),
  resetPassword: async () => ({ }),
  updateProfile: async () => ({ }),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authAttemptCountRef = useRef(0);
  const sessionRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add state tracking for debugging
  const { stateHistory, trackState } = useAuthStateTracker();
  
  // Custom setIsLoading that logs all state changes
  const setLoadingWithTracking = (loading: boolean, event: string = 'manual_set') => {
    trackState(event, session !== null, user !== null, profile !== null, loading);
    setIsLoading(loading);
  };

  // Clear any existing timeout to prevent memory leaks
  const clearAuthTimeout = () => {
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
  };

  // Periodic health check to ensure auth state is consistent
  const setupHealthCheck = () => {
    // Clear any existing interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    // Run a health check every 5 minutes
    healthCheckIntervalRef.current = setInterval(async () => {
      // Only run if we think we're logged in
      if (session && user) {
        console.log("Running authentication health check...");
        
        try {
          // Verify the session is still valid
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Health check: Error getting session:", error);
            // Session is invalid, trigger reset
            resetAuthState();
            return;
          }
          
          if (!data.session) {
            console.warn("Health check: Session lost - clearing auth state");
            // We have session state but Supabase doesn't, clear our state
            resetAuthState();
            return;
          }
          
          // Check if token is close to expiry (< 10 minutes)
          const expiresAt = data.session.expires_at;
          if (expiresAt) {
            const expiresAtMs = expiresAt * 1000;
            const now = Date.now();
            const timeUntilExpiry = expiresAtMs - now;
            
            if (timeUntilExpiry < 600000) { // 10 minutes in milliseconds
              console.log("Health check: Token expiring soon, refreshing");
              refreshSession();
            }
          }
          
          // Check if profile is still accessible
          if (user) {
            const profileValid = await validateUserProfile(user.id);
            if (!profileValid) {
              console.warn("Health check: Profile not valid, attempting to fix");
              const userProfile = await fetchProfile(user.id);
              if (!userProfile) {
                console.error("Health check: Unable to retrieve profile, resetting auth");
                resetAuthState();
              } else {
                setProfile(userProfile);
              }
            }
          }
        } catch (error) {
          console.error("Health check: Unexpected error:", error);
        }
      }
    }, 300000); // 5 minutes
  };

  // Function to completely reset auth state
  const resetAuthState = async () => {
    console.warn("Resetting authentication state");
    try {
      setIsLoading(true);
      
      // Clear state
      setUser(null);
      setProfile(null);
      setSession(null);
      
      // Clear storage
      localStorage.removeItem('supabase.auth.token');
      
      // Try to sign out from Supabase (but don't wait on it)
      supabase.auth.signOut({ scope: 'global' }).catch(err => {
        console.error("Error during sign out in resetAuthState:", err);
      });
      
      toast.error("Authentication state was reset due to inconsistency.");
    } catch (error) {
      console.error("Error in resetAuthState:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup a refresh check to proactively refresh the token before it expires
  const setupSessionRefreshCheck = (currentSession: Session | null) => {
    // Clear any existing timer
    if (sessionRefreshTimerRef.current) {
      clearTimeout(sessionRefreshTimerRef.current);
      sessionRefreshTimerRef.current = null;
    }

    // If no session, no need to set up a refresh check
    if (!currentSession) return;

    // Calculate when the session expires
    const expiresAt = currentSession.expires_at;
    if (!expiresAt) return;

    // Convert to milliseconds and subtract current time to get time until expiry
    const expiresAtMs = expiresAt * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAtMs - now;

    // If token is already expired or will expire in less than 5 minutes, refresh now
    if (timeUntilExpiry < 300000) { // 5 minutes in milliseconds
      refreshSession();
      return;
    }

    // Schedule a refresh for 5 minutes before expiry
    const refreshDelay = timeUntilExpiry - 300000; // 5 minutes before expiry
    console.log(`Scheduling session refresh in ${Math.round(refreshDelay / 60000)} minutes`);
    
    sessionRefreshTimerRef.current = setTimeout(() => {
      refreshSession();
    }, refreshDelay);
  };

  // Function to refresh the session
  const refreshSession = async () => {
    console.log("Attempting to refresh auth session...");
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("Error refreshing session:", error);
        // If we can't refresh, the user might need to login again
        if (error.message.includes("expired")) {
          toast.error("Your session has expired. Please sign in again.");
          await signOut();
        }
        return;
      }
      
      if (data.session) {
        console.log("Session refreshed successfully");
        setSession(data.session);
        setUser(data.session.user);
        
        // Reset the refresh timer with the new session
        setupSessionRefreshCheck(data.session);
      }
    } catch (error) {
      console.error("Unexpected error refreshing session:", error);
    }
  };

  // Setup a timeout that will force loading to complete
  const setupLoadingTimeout = () => {
    clearAuthTimeout();
    
    // Use a shorter timeout if we've had multiple attempts
    const timeoutDuration = authAttemptCountRef.current > 2 ? 5000 : 10000;
    
    authTimeoutRef.current = setTimeout(() => {
      console.warn(`Auth loading timed out after ${timeoutDuration}ms - forcing completion`);
      setIsLoading(false);
      
      // If we've timed out multiple times, show an error to the user
      if (authAttemptCountRef.current > 1) {
        toast.error("Authentication is taking longer than expected. You may need to reset your session.");
      }
      
      authAttemptCountRef.current += 1;
    }, timeoutDuration);
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      
      return data as Profile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  const validateUserProfile = async (userId: string): Promise<boolean> => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (profileError || !profile) {
        console.error('Profile validation failed:', profileError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating user profile:', error);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Add keyboard shortcut for debug panel (Alt+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'd' && AUTH_DEBUG) {
        setShowDebugPanel(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Set initial timeout
    setupLoadingTimeout();
    
    // Setup health check
    setupHealthCheck();
    
    // Track initial state
    trackState('init', false, false, false, true);
    
    const initAuth = async () => {
      try {
        console.log("Initializing authentication...");
        // First check if there is a valid session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            // Clear any stale state if there's an error
            setUser(null);
            setProfile(null);
            setSession(null);
            setLoadingWithTracking(false, 'init_error');
          }
          return;
        }
        
        // Log session expiry information for debugging
        if (data.session) {
          const expiresAt = data.session.expires_at;
          if (expiresAt) {
            const expiresAtDate = new Date(expiresAt * 1000);
            const now = new Date();
            const minutesUntilExpiry = Math.round((expiresAtDate.getTime() - now.getTime()) / 60000);
            
            console.log(`Session found - expires in ${minutesUntilExpiry} minutes (${expiresAtDate.toLocaleString()})`);
            
            // Detect if token is close to expiry or already expired
            if (minutesUntilExpiry <= 0) {
              console.warn("Session token is already expired!");
            } else if (minutesUntilExpiry < 5) {
              console.warn(`Session token expires very soon: ${minutesUntilExpiry} minutes remaining`);
            }
          } else {
            console.warn("Session has no expiry information!");
          }
        }
        
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user || null);
          trackState('set_session', data.session !== null, data.session?.user !== null, false, isLoading);
          
          // Setup session refresh check if we have a session
          if (data.session) {
            setupSessionRefreshCheck(data.session);
          }
          
          if (!data.session) {
            console.log("No active session found");
            setLoadingWithTracking(false, 'no_session');
            return;
          }
        }
        
        if (data.session?.user && mounted) {
          console.log("Session found, fetching profile...");
          const userProfile = await fetchProfile(data.session.user.id);
          
          if (mounted) {
            if (userProfile) {
              console.log("Profile loaded successfully");
              setProfile(userProfile);
              trackState('profile_loaded', true, true, true, isLoading);
            } else {
              console.warn("No profile found for user");
            }
            // Always make sure loading state is reset
            setLoadingWithTracking(false, 'init_complete');
          }
        } else if (mounted) {
          // No session or user, explicitly clear profile and set loading to false
          setProfile(null);
          setLoadingWithTracking(false, 'no_user');
        }
      } catch (error) {
        console.error("Unexpected error during initialization:", error);
        if (mounted) {
          // Clear any stale state on error
          setUser(null);
          setProfile(null);
          setSession(null);
          setLoadingWithTracking(false, 'init_exception');
        }
      }
    };
    
    initAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("Auth state changed:", event, newSession ? "with session" : "no session");
        trackState(`event_${event}`, newSession !== null, newSession?.user !== null, profile !== null, isLoading);
        
        // Log session expiry information for debugging when we get a new session
        if (newSession) {
          const expiresAt = newSession.expires_at;
          if (expiresAt) {
            const expiresAtDate = new Date(expiresAt * 1000);
            const now = new Date();
            const minutesUntilExpiry = Math.round((expiresAtDate.getTime() - now.getTime()) / 60000);
            
            console.log(`New session - expires in ${minutesUntilExpiry} minutes (${expiresAtDate.toLocaleString()})`);
          }
        }
        
        // Reset safety timeout whenever auth state changes
        setupLoadingTimeout();
        
        // Clear the auth in progress flag whenever auth state changes
        localStorage.removeItem('auth_in_progress');
        
        if (mounted) {
          setSession(newSession);
          setUser(newSession?.user || null);
          
          // Setup session refresh check when we get a new session
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setupSessionRefreshCheck(newSession);
          }
          
          // Only set loading to true if we have a session
          if (newSession) {
            setLoadingWithTracking(true, `loading_${event}`);
          }
        }
        
        if (newSession?.user && mounted) {
          try {
            // Validate that the user has a profile
            const isValid = await Promise.race([
              validateUserProfile(newSession.user.id),
              // Add a timeout promise to prevent hanging
              new Promise<boolean>((resolve) => {
                setTimeout(() => {
                  console.warn('Profile validation timed out');
                  resolve(false);
                }, 3000);
              })
            ]);
            
            if (!isValid) {
              console.warn('User has no valid profile, attempting to fix');
              trackState('profile_invalid', true, true, false, true);
              // Attempt to create/fix the profile by fetching it again
              // This will retry the fetchProfile which may trigger the database's handle_new_user function
              await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay to ensure DB triggers have time
            }
            
            const userProfile = await Promise.race([
              fetchProfile(newSession.user.id),
              // Add a timeout promise to prevent hanging
              new Promise<Profile | null>((resolve) => {
                setTimeout(() => {
                  console.warn('Profile fetch timed out');
                  resolve(null);
                }, 3000);
              })
            ]);
            
            if (mounted) {
              if (userProfile) {
                setProfile(userProfile);
                trackState('profile_set', true, true, true, isLoading);
              } else {
                console.error('Failed to retrieve or create user profile');
                toast.error('Error loading your profile. Please try again or contact support.');
                trackState('profile_failed', true, true, false, isLoading);
              }
              // Always make sure loading state is reset
              setLoadingWithTracking(false, `${event}_complete`);
            }
          } catch (error) {
            console.error('Error in auth state change handler:', error);
            if (mounted) {
              // Ensure loading state is reset on error
              setLoadingWithTracking(false, `${event}_error`);
              toast.error('Authentication error. Please try again.');
            }
          }
        } else if (mounted) {
          // No session means we should clear the profile
          setProfile(null);
          setLoadingWithTracking(false, `${event}_no_session`);
          
          // If the event is a sign-out, ensure we clear any cached data
          if (event === 'SIGNED_OUT') {
            localStorage.removeItem('supabase.auth.token');
            console.log("Signed out - cleared local storage");
          }
        }
      }
    );
    
    return () => {
      mounted = false;
      // Clear the timeout on unmount
      clearAuthTimeout();
      // Clear session refresh timer
      if (sessionRefreshTimerRef.current) {
        clearTimeout(sessionRefreshTimerRef.current);
      }
      // Clear health check interval
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      // Remove keyboard event listener
      window.removeEventListener('keydown', handleKeyDown);
      // Unsubscribe from auth changes
      subscription.unsubscribe();
    };
  }, []);

  // Sign up function
  const signUp = async ({ email, password, username }: SignUpData) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      toast.success('Registration successful! Please check your email for verification.');
      return {};
    } catch (error) {
      console.error('Error signing up:', error);
      const errorMessage = error.message || 'Failed to sign up. Please try again.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Login function
  const login = async ({ email, password }: LoginData) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      toast.success('Logged in successfully');
      return {};
    } catch (error) {
      console.error('Error logging in:', error);
      const errorMessage = error.message || 'Failed to log in. Please check your credentials.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      // More thorough sign out that also clears local storage
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      
      // Explicitly clear any localStorage items related to authentication
      localStorage.removeItem('supabase.auth.token');
      
      // Clear state
      setUser(null);
      setProfile(null);
      setSession(null);
      
      toast.success("Signed out successfully");
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error("Failed to sign out");
    }
  };

  // Forgot password function
  const forgotPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      toast.success('Password reset email sent. Please check your inbox.');
      return {};
    } catch (error) {
      console.error('Error requesting password reset:', error);
      const errorMessage = error.message || 'Failed to send reset email. Please try again.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Reset password function
  const resetPassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      toast.success('Password has been reset successfully. You can now log in with your new password.');
      return {};
    } catch (error) {
      console.error('Error resetting password:', error);
      const errorMessage = error.message || 'Failed to reset password. Please try again.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Update profile function
  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) return { error: 'You must be logged in to update your profile' };
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) {
        toast.error(error.message);
        return { error: error.message };
      }
      
      setProfile(data as Profile);
      toast.success('Profile updated successfully');
      return { profile: data as Profile };
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error.message || 'Failed to update profile. Please try again.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  return (
    <>
      <AuthContext.Provider
        value={{
          session,
          user,
          profile,
          isLoading,
          isAdmin: profile?.username === 'admin',
          signUp,
          login,
          signOut,
          forgotPassword,
          resetPassword,
          updateProfile,
        }}
      >
        {children}
      </AuthContext.Provider>
      
      {/* Debug panel - only visible when AUTH_DEBUG is true and triggered with Alt+D */}
      {AUTH_DEBUG && showDebugPanel && (
        <div 
          style={{
            position: 'fixed',
            bottom: 0,
            right: 0,
            width: '400px',
            maxHeight: '300px',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px',
            fontSize: '12px',
            fontFamily: 'monospace',
            zIndex: 9999,
            overflow: 'auto',
            border: '1px solid #444',
            borderRadius: '4px 0 0 0'
          }}
        >
          <div style={{ marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Auth Debug (Alt+D to hide)</strong>
            <div>
              <button 
                onClick={() => resetAuthState()} 
                style={{ 
                  background: '#f44336', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '2px', 
                  padding: '2px 8px', 
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
              >
                Reset Auth
              </button>
              <button 
                onClick={() => refreshSession()} 
                style={{ 
                  background: '#4caf50', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '2px', 
                  padding: '2px 8px', 
                  fontSize: '10px',
                  marginLeft: '4px',
                  cursor: 'pointer'
                }}
              >
                Refresh Token
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <div>Session: <span style={{ color: session ? '#4caf50' : '#f44336' }}>{session ? 'Yes' : 'No'}</span></div>
            <div>User: <span style={{ color: user ? '#4caf50' : '#f44336' }}>{user ? 'Yes' : 'No'}</span></div>
            <div>Profile: <span style={{ color: profile ? '#4caf50' : '#f44336' }}>{profile ? 'Yes' : 'No'}</span></div>
            <div>Loading: <span style={{ color: isLoading ? '#ff9800' : '#4caf50' }}>{isLoading ? 'Yes' : 'No'}</span></div>
          </div>
          <div style={{ borderTop: '1px solid #444', paddingTop: '6px' }}>
            <strong>State History:</strong>
            <div style={{ maxHeight: '180px', overflow: 'auto' }}>
              {stateHistory.map((item, i) => (
                <div key={i} style={{ marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px dotted #333' }}>
                  <div style={{ color: '#ff9800' }}>
                    {item.timestamp.toLocaleTimeString()} - {item.event}
                  </div>
                  <div style={{ fontSize: '10px', color: '#aaa' }}>
                    session={item.hasSession ? 'yes' : 'no'}, 
                    user={item.hasUser ? 'yes' : 'no'}, 
                    profile={item.hasProfile ? 'yes' : 'no'}, 
                    loading={item.isLoading ? 'yes' : 'no'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
