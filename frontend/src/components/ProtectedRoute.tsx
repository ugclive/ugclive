
import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAuth?: boolean;
};

const ProtectedRoute = ({ children, requireAuth = false }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Only redirect after auth is loaded and if requireAuth is true
    if (!isLoading && requireAuth && !user) {
      console.log("PROTECTED ROUTE: Redirecting unauthenticated user from protected route");
      navigate("/landing", { replace: true });
    }
  }, [isLoading, user, requireAuth, navigate]);

  // Show loading state only briefly during initial authentication check
  if (isLoading) {
    console.log("PROTECTED ROUTE: Still loading auth state...");
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading authentication...</p>
        </div>
      </div>
    );
  }

  console.log("PROTECTED ROUTE: Rendering content, user:", user ? "authenticated" : "unauthenticated");
  return <>{children}</>;
};

export default ProtectedRoute;
