import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ResetAuth = () => {
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  const handleResetAuth = async () => {
    try {
      setIsResetting(true);
      
      // Clear all local storage
      localStorage.clear();
      console.log("🔄 Local storage cleared");
      
      // Clear all session storage
      sessionStorage.clear();
      console.log("🔄 Session storage cleared");
      
      // Clear cookies
      document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      console.log("🔄 Cookies cleared");
      
      // Sign out from Supabase
      await supabase.auth.signOut({ scope: 'global' });
      console.log("🔄 Signed out from Supabase");
      
      toast.success("Authentication state reset successfully");
      
      // Redirect to home after a delay
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Error resetting auth state:", error);
      toast.error("Failed to reset authentication state");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/10">
      <div className="w-full max-w-md p-6 bg-background rounded-lg shadow-lg border">
        <h1 className="text-2xl font-bold text-center mb-2">Authentication Troubleshooter</h1>
        <p className="text-center text-muted-foreground mb-6">
          Use this tool if you're experiencing login issues or getting stuck on loading screens.
        </p>
        
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h2 className="font-medium text-yellow-800">What this does:</h2>
            <ul className="list-disc pl-5 text-sm text-yellow-700 mt-2 space-y-1">
              <li>Clears all cached login information</li>
              <li>Signs you out completely from all devices</li>
              <li>Resets your browser's application data</li>
              <li>Returns you to a clean login state</li>
            </ul>
          </div>
          
          <Button
            onClick={handleResetAuth}
            className="w-full"
            variant="destructive"
            disabled={isResetting}
          >
            {isResetting ? "Resetting Auth State..." : "Reset Authentication State"}
          </Button>
          
          <div className="text-center mt-4">
            <Link to="/" className="text-sm text-primary hover:underline">
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetAuth; 