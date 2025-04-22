import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Home, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ResetAuthPage() {
  const navigate = useNavigate();
  const [isClearing, setIsClearing] = useState(false);
  const [clearComplete, setClearComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to clear all authentication related data
  const clearAuthData = async () => {
    try {
      setIsClearing(true);
      setError(null);

      // Clear localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          sessionStorage.removeItem(key);
        }
      });

      // Clear all auth cookies
      document.cookie.split(";").forEach(cookie => {
        const key = cookie.split("=")[0].trim();
        if (key.includes('supabase') || key.includes('auth')) {
          document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });

      // Sign out from Supabase - global scope
      await supabase.auth.signOut({ scope: 'global' });

      // Set completion state
      setClearComplete(true);
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
    } catch (err) {
      console.error("Error clearing auth data:", err);
      setError(err.message || "Failed to clear authentication data");
    } finally {
      setIsClearing(false);
    }
  };

  // Function to clear ALL browser data
  const clearAllData = () => {
    try {
      setIsClearing(true);
      
      // Clear all localStorage
      localStorage.clear();
      
      // Clear all sessionStorage
      sessionStorage.clear();
      
      // Clear all cookies
      document.cookie.split(";").forEach(cookie => {
        document.cookie = cookie
          .replace(/^ +/, "")
          .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });
      
      // Force sign out
      supabase.auth.signOut({ scope: 'global' })
        .then(() => {
          setClearComplete(true);
          setTimeout(() => {
            window.location.href = "/"; // Use location.href for a full page reload
          }, 2000);
        })
        .catch(err => {
          setError(err.message || "Failed to sign out");
          setIsClearing(false);
        });
    } catch (err) {
      console.error("Error clearing all data:", err);
      setError(err.message || "Failed to clear browser data");
      setIsClearing(false);
    }
  };

  const goHome = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Reset Authentication</span>
            <Button variant="ghost" size="icon" onClick={goHome}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
          <CardDescription>
            Resolve issues with authentication by resetting your session data
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {clearComplete ? (
            <div className="py-6 text-center space-y-3">
              <div className="flex justify-center">
                <RefreshCw className="h-12 w-12 text-green-500 animate-spin" />
              </div>
              <h3 className="text-xl font-medium">Reset Complete!</h3>
              <p className="text-muted-foreground">
                Redirecting you to the home page...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Why reset authentication?</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  <li>You're stuck in an infinite loading state</li>
                  <li>Authentication errors keep occurring</li>
                  <li>You can't log in or log out properly</li>
                  <li>The app doesn't recognize your session</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <Button 
                  className="w-full" 
                  variant="default"
                  disabled={isClearing}
                  onClick={clearAuthData}
                >
                  {isClearing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Authentication Data"
                  )}
                </Button>
                
                <Button 
                  className="w-full" 
                  variant="destructive"
                  disabled={isClearing}
                  onClick={clearAllData}
                >
                  Clear ALL Browser Data & Sign Out
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={goHome}
            disabled={isClearing}
          >
            <Home className="mr-2 h-4 w-4" />
            Return to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 