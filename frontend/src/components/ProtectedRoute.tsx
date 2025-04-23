import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { SUPABASE_URL } from "@/config";

// Enable for debugging
const DEBUG_AUTH = true;

// Helper to get the project ref for the storage key
const getProjectRef = () => {
  try {
    const url = new URL(SUPABASE_URL);
    return url.hostname.split('.')[0];
  } catch {
    return 'unknown';
  }
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isLoading, signOut, refreshSession, clearStorageData } = useAuth();
  const location = useLocation();
  
  // Simplified state
  const [loadingTime, setLoadingTime] = useState(0);
  const [showResetOption, setShowResetOption] = useState(false);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);

  // Clear all browser data and sign out
  const clearAllBrowserData = async () => {
    if (DEBUG_AUTH) console.log("[ProtectedRoute] Clearing all browser auth data");
    
    // First sign out from supabase
    await signOut();
    
    // Use the clearStorageData utility
    clearStorageData();
    
    // Reload the page to ensure a clean state
    window.location.href = "/";
  };

  // Loading timer
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
            <div className="flex gap-2 justify-center">
              <button
                onClick={clearAllBrowserData}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
              >
                Reset Authentication
              </button>
              <button
                onClick={() => {
                  clearStorageData();
                  window.location.reload();
                }}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
              >
                Clear Storage Only
              </button>
            </div>
          </div>
        )}
        
        {/* Debug information section */}
        {DEBUG_AUTH && (
          <div className="mt-8 p-4 border border-gray-200 rounded-md max-w-lg w-full bg-muted/50 text-xs">
            <h3 className="font-medium mb-2">Auth Debug Info:</h3>
            <pre className="overflow-auto max-h-48 p-2 bg-muted rounded">
              {JSON.stringify(
                {
                  loadingTime: `${loadingTime}s`,
                  isLoading,
                  recoveryAttempted,
                  location: location.pathname,
                  userExists: !!user,
                  profileExists: !!profile
                },
                null,
                2
              )}
            </pre>
            
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => refreshSession()}
                className="px-2 py-1 bg-primary/10 text-primary rounded text-xs"
              >
                Refresh Session
              </button>
              <button
                onClick={clearAllBrowserData}
                className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs"
              >
                Reset Auth
              </button>
            </div>
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
