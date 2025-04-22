import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const resetAuthState = async () => {
  try {
    localStorage.clear();
    sessionStorage.clear();
    
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    await supabase.auth.signOut({ scope: 'global' });
    
    toast.success("Authentication reset. Refreshing page...");
    
    setTimeout(() => {
      window.location.href = "/";
    }, 1000);
  } catch (error) {
    console.error("Error resetting auth:", error);
    toast.error("Failed to reset authentication state.");
  }
};

const UserMenu = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="flex items-center">
      {user && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="end">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2 p-2">
                {user.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover border border-muted"
                  />
                ) : (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                    {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">
                    {user.user_metadata?.full_name || user.email}
                  </p>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={signOut}
                className="justify-start font-normal w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Sign Out
              </Button>
              
              <button 
                onClick={resetAuthState}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100"
              >
                Reset Auth (Troubleshoot)
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default UserMenu;
