import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
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
  error: AuthError | Error | null;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: 'github' | 'google') => Promise<{ error?: string }>;
};

// Create AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | Error | null>(null);

  // Listen for auth changes when the component mounts
  useEffect(() => {
    // Get the initial session
    const getInitialSession = async () => {
      try {
        setIsLoading(true);
        
        // Check for existing session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        // If we have a session, set it and fetch the user's profile
        if (data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          
          // Set the token for API calls
          setSessionToken(data.session.access_token);
          
          // Fetch the user's profile
          await fetchProfile(data.session.user.id);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        setError(error as Error);
      } finally {
        setIsLoading(false);
      }
    };
    
    getInitialSession();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`Auth event: ${event}`);
        
        // Update state based on session
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle session token for API calls
        if (session?.access_token) {
          setSessionToken(session.access_token);
        } else {
          setSessionToken(null);
        }
        
        // If we have a user, fetch their profile
        if (session?.user) {
          setIsLoading(true);
          await fetchProfile(session.user.id);
          setIsLoading(false);
        } else {
          setProfile(null);
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  // Fetch the user's profile from Supabase
  const fetchProfile = async (userId: string) => {
    try {
      console.log(`Fetching profile for user ${userId}`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      console.log('Profile fetched successfully');
      setProfile(data as Profile);
    } catch (error) {
      console.error('Unexpected error fetching profile:', error);
    }
  };
  
  // Sign out the user
  const signOut = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      // Clear state
      setSession(null);
      setUser(null);
      setProfile(null);
      setSessionToken(null);
    } catch (error) {
      console.error('Error signing out:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sign in with OAuth
  const signInWithOAuth = async (provider: 'github' | 'google') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        throw error;
      }
      
      return {};
    } catch (error) {
      console.error(`Error signing in with ${provider}:`, error);
      return { error: (error as Error).message };
    }
  };
  
  // Value provided to consumers of the context
  const value = {
    session,
    user,
    profile,
    isLoading,
    error,
    signOut,
    signInWithOAuth
  };
  
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