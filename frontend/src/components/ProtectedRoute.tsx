import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoadingScreen from "@/components/ui/LoadingScreen";

// Enable for debugging
const DEBUG_AUTH = true;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isLoading, signOut, refreshSession, diagnoseAuth } = useAuth();
  const location = useLocation();
  
  // Simplified state - only what's truly needed
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showResetOption, setShowResetOption] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);

  // Clear all browser data and sign out
  const clearAllBrowserData = async () => {
    if (DEBUG_AUTH) console.log("[ProtectedRoute] Clearing all browser auth data");
    
    // First sign out from supabase
    await signOut();
    
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear cookies (with special focus on auth cookies)
    document.cookie.split(";").forEach((c) => {
      const cookieName = c.split("=")[0].trim();
      document.cookie = `${cookieName}=;expires=${new Date().toUTCString()};path=/`;
      // Also try with secure flag and different paths to ensure complete removal
      document.cookie = `${cookieName}=;expires=${new Date().toUTCString()};path=/;secure`;
      document.cookie = `${cookieName}=;expires=${new Date().toUTCString()};path=/;secure;SameSite=Lax`;
    });
    
    // Reload the page to ensure a clean state
    window.location.href = "/";
  };

  // Simpler loading timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isLoading) {
      if (DEBUG_AUTH) console.log("[ProtectedRoute] Loading authentication...");
      
      interval = setInterval(() => {
        setLoadingTime((prevTime) => {
          const newTime = prevTime + 1;
          // Show reset option after 3 seconds of loading
          if (newTime >= 3 && !showResetOption) {
            setShowResetOption(true);
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (DEBUG_AUTH && loadingTime > 0) {
        console.log(`[ProtectedRoute] Loading completed after ${loadingTime} seconds`);
      }
      
      // Try session recovery once if needed
      if (!user && !recoveryAttempted && loadingTime > 0) {
        setRecoveryAttempted(true);
        if (DEBUG_AUTH) console.log("[ProtectedRoute] Attempting session recovery");
        refreshSession().then(success => {
          if (DEBUG_AUTH) console.log(`[ProtectedRoute] Recovery ${success ? 'succeeded' : 'failed'}`);
        });
      }
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, loadingTime, user, recoveryAttempted, refreshSession]);

  // Get debug info when debugging is enabled
  useEffect(() => {
    if (DEBUG_AUTH) {
      const getDebugInfo = async () => {
        try {
          const info = await diagnoseAuth();
          setDebugInfo(info);
        } catch (e) {
          console.error("[ProtectedRoute] Error getting debug info:", e);
        }
      };
      
      getDebugInfo();
    }
  }, [diagnoseAuth, isLoading, user, location.pathname]);

  // If we have a user but still waiting for profile, show specific loading message
  if (user && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <LoadingScreen message="Loading profile..." />
      </div>
    );
  }

  // Show loading screen during initial loading
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <LoadingScreen message="Authenticating..." />
        
        {/* Show reset option if it's taking too long */}
        {showResetOption && (
          <div className="mt-8 text-center">
            <p className="text-muted-foreground mb-2">
              Taking too long? There might be an issue with your session.
            </p>
            <button
              onClick={clearAllBrowserData}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
            >
              Reset Authentication
            </button>
          </div>
        )}
        
        {/* Debug information section */}
        {DEBUG_AUTH && debugInfo && (
          <div className="mt-8 p-4 border border-gray-200 rounded-md max-w-lg w-full bg-muted/50 text-xs">
            <h3 className="font-medium mb-2">Auth Debug Info:</h3>
            <pre className="overflow-auto max-h-48 p-2 bg-muted rounded">
              {JSON.stringify(
                {
                  loadingTime: `${loadingTime}s`,
                  isLoading,
                  recoveryAttempted,
                  location: location.pathname,
                  hasToken: debugInfo.hasToken,
                  sessionState: debugInfo?.session,
                  userExists: debugInfo?.user?.exists,
                  profileExists: !!profile,
                  contextState: debugInfo?.contextState
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // If not loading but no user, redirect to signin
  if (!user) {
    if (DEBUG_AUTH) console.log("[ProtectedRoute] No user, redirecting to signin");
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // User is authenticated and has a profile
  return <>{children}</>;
};

export default ProtectedRoute;
