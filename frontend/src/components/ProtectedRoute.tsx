import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAuth?: boolean;
};

// Debug constant - set to true to enable additional debugging
const DEBUG_AUTH = true;

const ProtectedRoute = ({ children, requireAuth = false }: ProtectedRouteProps) => {
  const { user, isLoading, session, profile } = useAuth();
  const navigate = useNavigate();
  const [showResetOption, setShowResetOption] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  
  // Check and log browser storage info for debugging
  const checkStorageInfo = () => {
    try {
      const storageData: any = {};
      
      // Check localStorage
      const localStorageKeys = Object.keys(localStorage).filter(
        key => key.includes('supabase') || key.includes('auth')
      );
      
      storageData.localStorage = {};
      localStorageKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          storageData.localStorage[key] = value ? 
            (value.length > 40 ? `${value.substring(0, 40)}...` : value) : 
            null;
        } catch (e) {
          storageData.localStorage[key] = `[Error: ${e.message}]`;
        }
      });
      
      // Check sessionStorage
      const sessionStorageKeys = Object.keys(sessionStorage).filter(
        key => key.includes('supabase') || key.includes('auth')
      );
      
      storageData.sessionStorage = {};
      sessionStorageKeys.forEach(key => {
        try {
          const value = sessionStorage.getItem(key);
          storageData.sessionStorage[key] = value ? 
            (value.length > 40 ? `${value.substring(0, 40)}...` : value) : 
            null;
        } catch (e) {
          storageData.sessionStorage[key] = `[Error: ${e.message}]`;
        }
      });
      
      // Check cookies
      storageData.cookies = document.cookie
        .split('; ')
        .filter(cookie => cookie.includes('supabase') || cookie.includes('auth'))
        .map(cookie => {
          const [name, value] = cookie.split('=');
          return { 
            name, 
            value: value.length > 40 ? `${value.substring(0, 40)}...` : value 
          };
        });
      
      setStorageInfo(storageData);
      return storageData;
    } catch (error) {
      console.error("Error getting storage info:", error);
      return { error: error.message };
    }
  };
  
  const clearAllBrowserData = () => {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear cookies
    document.cookie.split(";").forEach(cookie => {
      document.cookie = cookie
        .replace(/^ +/, "")
        .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });
    
    // Force sign out
    supabase.auth.signOut({ scope: 'global' })
      .then(() => {
        console.log("Signed out from Supabase");
        window.location.href = "/"; // Redirect to home page
      })
      .catch(error => {
        console.error("Error signing out:", error);
        window.location.reload(); // Reload the page anyway
      });
  };
  
  // Show reset option after 3 seconds of loading (reduced from 5)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;
    
    if (isLoading) {
      // Start a counter to track how long we've been loading
      setLoadingTime(0);
      intervalId = setInterval(() => {
        setLoadingTime(prev => prev + 1);
      }, 1000);
      
      // After 1 second of loading, check browser storage
      if (DEBUG_AUTH) {
        setTimeout(() => {
          checkStorageInfo();
        }, 1000);
      }
      
      timeoutId = setTimeout(() => {
        setShowResetOption(true);
        // Also check storage info again when showing reset option
        if (DEBUG_AUTH) checkStorageInfo();
      }, 3000); // 3 seconds (reduced from 5)
    } else {
      // Reset when not loading
      setShowResetOption(false);
      setLoadingTime(0);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoading]);
  
  useEffect(() => {
    // Only redirect after auth is loaded and if requireAuth is true
    if (!isLoading && requireAuth && !user) {
      console.log("PROTECTED ROUTE: Redirecting unauthenticated user from protected route");
      navigate("/", { replace: true });
    }
  }, [isLoading, user, requireAuth, navigate]);

  // Log details about the authentication state for debugging
  useEffect(() => {
    if (DEBUG_AUTH) {
      console.log("AUTH DEBUG STATE:", { 
        isLoading, 
        hasUser: !!user, 
        hasSession: !!session,
        hasProfile: !!profile,
        user: user ? { id: user.id, email: user.email } : null
      });
    }
  }, [isLoading, user, session, profile]);

  // Show loading state only briefly during initial authentication check
  if (isLoading) {
    console.log("PROTECTED ROUTE: Still loading auth state...");
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-muted-foreground animate-pulse mb-4">
            Loading authentication... {loadingTime > 0 && `(${loadingTime}s)`}
          </p>
          
          {/* Debug button only shown in development */}
          {DEBUG_AUTH && (
            <button 
              onClick={() => setShowDebugInfo(!showDebugInfo)} 
              className="text-xs text-blue-500 underline mb-2"
            >
              {showDebugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
            </button>
          )}
          
          {/* Debug information panel */}
          {DEBUG_AUTH && showDebugInfo && storageInfo && (
            <div className="text-xs text-left p-2 bg-black/10 rounded w-full max-w-md mb-4 overflow-auto max-h-40">
              <p className="font-bold">Auth Debug Info:</p>
              <p>Loading: {isLoading ? 'Yes' : 'No'}, Has User: {user ? 'Yes' : 'No'}, Has Session: {session ? 'Yes' : 'No'}</p>
              
              <p className="font-bold mt-2">LocalStorage:</p>
              <pre className="text-xs overflow-x-auto">
                {Object.keys(storageInfo.localStorage).length > 0 ? 
                  JSON.stringify(storageInfo.localStorage, null, 2) : 
                  'No auth items found'}
              </pre>
              
              <p className="font-bold mt-2">SessionStorage:</p>
              <pre className="text-xs overflow-x-auto">
                {Object.keys(storageInfo.sessionStorage).length > 0 ? 
                  JSON.stringify(storageInfo.sessionStorage, null, 2) : 
                  'No auth items found'}
              </pre>
              
              <p className="font-bold mt-2">Cookies:</p>
              <pre className="text-xs overflow-x-auto">
                {storageInfo.cookies && storageInfo.cookies.length > 0 ? 
                  JSON.stringify(storageInfo.cookies, null, 2) : 
                  'No auth cookies found'}
              </pre>
              
              <button 
                onClick={clearAllBrowserData}
                className="mt-4 bg-red-600 text-white px-2 py-1 rounded text-xs w-full"
              >
                Clear ALL Browser Data & Sign Out
              </button>
            </div>
          )}
          
          {/* Show reset option after delay */}
          {showResetOption && (
            <div className="mt-4 text-center">
              <p className="text-sm text-red-500 mb-2">Authentication taking too long</p>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground px-4 py-2 bg-muted/20 rounded">
                  <p>This could be happening due to:</p>
                  <ul className="list-disc pl-5 mt-1">
                    <li>Network connectivity issues</li>
                    <li>Browser storage problems</li>
                    <li>Session authentication error</li>
                  </ul>
                </div>
                <Link to="/reset-auth">
                  <Button variant="destructive" size="sm" className="w-full">
                    Reset Authentication
                  </Button>
                </Link>
                <div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.reload()}>
                    Try Refreshing First
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  console.log("PROTECTED ROUTE: Rendering content, user:", user ? "authenticated" : "unauthenticated");
  return <>{children}</>;
};

export default ProtectedRoute;
