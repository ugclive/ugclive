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
  
  // Show reset option after 5 seconds of loading
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isLoading) {
      timeoutId = setTimeout(() => {
        setShowResetOption(true);
      }, 5000); // 5 seconds
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
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
          <p className="text-sm text-muted-foreground animate-pulse mb-4">Loading authentication...</p>
          
          {/* Show reset option after delay */}
          {showResetOption && (
            <div className="mt-4 text-center">
              <p className="text-sm text-red-500 mb-2">Loading taking too long?</p>
              <Link to="/reset-auth">
                <Button variant="outline" size="sm">
                  Reset Authentication
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-2">
                This will clear all cached authentication data
              </p>
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
