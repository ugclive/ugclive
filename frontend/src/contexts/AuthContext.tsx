import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

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

  // Add this new validation function after the fetchProfile function
  const validateUserProfile = async (userId: string): Promise<boolean> => {
    try {
      // Check if profile exists
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
    
    const initAuth = async () => {
      try {
        // First check if there is a valid session
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            setIsLoading(false);
            // Clear any stale state if there's an error
            setUser(null);
            setProfile(null);
            setSession(null);
          }
          return;
        }
        
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user || null);
        }
        
        if (data.session?.user && mounted) {
          const userProfile = await fetchProfile(data.session.user.id);
          if (mounted && userProfile) {
            setProfile(userProfile);
            // Always make sure loading state is reset
            setIsLoading(false);
          } else if (mounted) {
            // If no profile found, still need to reset loading state
            setIsLoading(false);
          }
        } else if (mounted) {
          // No session or user, explicitly clear profile and set loading to false
          setProfile(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Unexpected error during initialization:", error);
        if (mounted) {
          setIsLoading(false);
          // Clear any stale state on error
          setUser(null);
          setProfile(null);
          setSession(null);
        }
      }
    };
    
    initAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("Auth state changed:", event);
        
        // Clear the auth in progress flag whenever auth state changes
        localStorage.removeItem('auth_in_progress');
        
        if (mounted) {
          setSession(newSession);
          setUser(newSession?.user || null);
          
          // Set loading back to true briefly when auth state changes
          setIsLoading(true);
        }
        
        if (newSession?.user && mounted) {
          // Validate that the user has a profile
          const isValid = await validateUserProfile(newSession.user.id);
          
          if (!isValid) {
            console.warn('User has no valid profile, attempting to fix');
            // Attempt to create/fix the profile by fetching it again
            // This will retry the fetchProfile which may trigger the database's handle_new_user function
            await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay to ensure DB triggers have time
          }
          
          const userProfile = await fetchProfile(newSession.user.id);
          if (mounted && userProfile) {
            setProfile(userProfile);
            // Always make sure loading state is reset
            setIsLoading(false);
          } else if (mounted) {
            // If still no profile, this is a problem
            console.error('Failed to retrieve or create user profile');
            toast.error('Error loading your profile. Please try again or contact support.');
            setIsLoading(false);
          }
        } else if (mounted) {
          // No session means we should clear the profile
          setProfile(null);
          setIsLoading(false);
          
          // If the event is a sign-out, ensure we clear any cached data
          if (event === 'SIGNED_OUT') {
            localStorage.removeItem('supabase.auth.token');
          }
        }
      }
    );
    
    return () => {
      mounted = false;
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
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
