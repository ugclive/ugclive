import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAuth?: boolean;
};

const ProtectedRoute = ({ children, requireAuth = false }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showResetOption, setShowResetOption] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  
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
      
      timeoutId = setTimeout(() => {
        setShowResetOption(true);
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
