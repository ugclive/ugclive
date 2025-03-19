
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  plan: string;
  credits: number;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      
      console.log("Profile fetched successfully:", data);
      return data as Profile;
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
          fetchProfile(data.session.user.id)
            .then(userProfile => {
              if (mounted) setProfile(userProfile);
            })
            .catch(error => {
              console.error("AUTH CONTEXT: Error fetching profile:", error);
            });
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
          fetchProfile(newSession.user.id)
            .then(userProfile => {
              if (mounted) setProfile(userProfile);
            })
            .catch(error => {
              console.error("AUTH CONTEXT: Error fetching profile after auth change:", error);
            });
        } else if (!newSession && mounted) {
          setProfile(null);
        }
      }
    );
    
    return () => {
      console.log("AUTH CONTEXT: Cleaning up auth subscription");
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log("AUTH CONTEXT: Signing out");
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error("Failed to sign out");
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
