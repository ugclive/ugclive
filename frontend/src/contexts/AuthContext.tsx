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

  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          if (mounted) setIsLoading(false);
          return;
        }
        
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user || null);
          
          setIsLoading(false);
        }
        
        if (data.session?.user && mounted) {
          const userProfile = await fetchProfile(data.session.user.id);
          if (mounted && userProfile) {
            setProfile(userProfile);
          }
        }
      } catch (error) {
        console.error("Unexpected error during initialization:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    initAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (mounted) {
          setSession(newSession);
          setUser(newSession?.user || null);
          
          setIsLoading(false);
        }
        
        if (newSession?.user && mounted) {
          const userProfile = await fetchProfile(newSession.user.id);
          if (mounted && userProfile) {
            setProfile(userProfile);
          }
        } else if (!newSession && mounted) {
          setProfile(null);
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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Signed out successfully");
      setProfile(null);
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
