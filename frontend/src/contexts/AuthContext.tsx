import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import api from "@/services/api";

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  plan: string;
  role: string;
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
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (userId: string) => {
    console.log("Fetching profile for user:", userId);
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
      
      // Ensure role field exists, defaulting to 'user' if not present
      const profile = {
        ...data,
        role: data.role || 'user'
      } as Profile;
      
      console.log("Profile fetched successfully:", profile);
      return profile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    console.log("AUTH CONTEXT: Initializing authentication");
    
    let mounted = true;
    
    const initAuth = async () => {
      try {
        console.log("AUTH CONTEXT: Getting initial session");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("AUTH CONTEXT: Error getting session:", error);
          if (mounted) setIsLoading(false);
          return;
        }
        
        console.log("AUTH CONTEXT: Session retrieved:", data.session ? "Session exists" : "No session");
        
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user || null);
          
          setIsLoading(false);
        }
        
        if (data.session?.user && mounted) {
          const userProfile = await fetchProfile(data.session.user.id);
          if (mounted && userProfile) {
            setProfile(userProfile);
            setIsAdmin(userProfile.role === 'admin');
          }
        }
      } catch (error) {
        console.error("AUTH CONTEXT: Unexpected error during initialization:", error);
      } finally {
        if (mounted) {
          console.log("AUTH CONTEXT: Initialization complete, setting isLoading to false");
          setIsLoading(false);
        }
      }
    };
    
    initAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("AUTH CONTEXT: Auth state changed:", event, newSession ? "session exists" : "no session");
        
        if (mounted) {
          setSession(newSession);
          setUser(newSession?.user || null);
          
          setIsLoading(false);
        }
        
        if (newSession?.user && mounted) {
          const userProfile = await fetchProfile(newSession.user.id);
          if (mounted && userProfile) {
            setProfile(userProfile);
            setIsAdmin(userProfile.role === 'admin');
          }
        } else if (!newSession && mounted) {
          setProfile(null);
          setIsAdmin(false);
        }
      }
    );
    
    return () => {
      console.log("AUTH CONTEXT: Cleaning up auth subscription");
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign up function
  const signUp = async ({ email, password, username }: SignUpData) => {
    try {
      // Call backend API for signup
      const response = await api.post('/auth/signup', {
        email,
        password,
        username
      });
      
      if (response.data.user) {
        toast.success('Registration successful! Please check your email for verification.');
        return {};
      }
      
      return { error: 'Unknown error occurred during signup' };
    } catch (error) {
      console.error('Error signing up:', error);
      const errorMessage = error.response?.data?.error || 'Failed to sign up. Please try again.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Login function
  const login = async ({ email, password }: LoginData) => {
    try {
      // Call backend API for login
      const response = await api.post('/auth/login', {
        email,
        password
      });
      
      if (response.data.session) {
        // Set the session directly in Supabase client
        await supabase.auth.setSession({
          access_token: response.data.session.access_token,
          refresh_token: response.data.session.refresh_token
        });
        
        toast.success('Logged in successfully');
        return {};
      }
      
      return { error: 'Unknown error occurred during login' };
    } catch (error) {
      console.error('Error logging in:', error);
      const errorMessage = error.response?.data?.error || 'Failed to log in. Please check your credentials.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      console.log("AUTH CONTEXT: Signing out");
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      setProfile(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error("Failed to sign out");
    }
  };

  // Forgot password function
  const forgotPassword = async (email: string) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      toast.success('Password reset email sent. Please check your inbox.');
      return {};
    } catch (error) {
      console.error('Error requesting password reset:', error);
      const errorMessage = error.response?.data?.error || 'Failed to send reset email. Please try again.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Reset password function
  const resetPassword = async (password: string) => {
    try {
      const response = await api.post('/auth/reset-password', { password });
      toast.success('Password reset successfully. You can now log in with your new password.');
      return {};
    } catch (error) {
      console.error('Error resetting password:', error);
      const errorMessage = error.response?.data?.error || 'Failed to reset password. Please try again.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  // Update profile function
  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        return { error: 'You must be logged in to update your profile' };
      }
      
      const token = authData.session.access_token;
      const response = await api.put('/auth/profile', updates, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.profile) {
        setProfile(response.data.profile);
        toast.success('Profile updated successfully');
        return { profile: response.data.profile };
      }
      
      return { error: 'Unknown error occurred during profile update' };
    } catch (error) {
      console.error('Error updating profile:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update profile. Please try again.';
      toast.error(errorMessage);
      return { error: errorMessage };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      profile, 
      isLoading, 
      isAdmin,
      signUp,
      login,
      signOut,
      forgotPassword,
      resetPassword,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
