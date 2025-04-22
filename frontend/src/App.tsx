import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import SelfHost from "./pages/SelfHost";
import SelfHostBanner from "./components/SelfHostBanner";
import { MobileWarningModal } from "./components/MobileWarningModal";
import ResetAuth from "./pages/ResetAuth";
import ResetAuthPage from "./pages/ResetAuthPage";
import { useEffect } from 'react';
import { diagnoseAuthState } from '@/integrations/supabase/client';

// Create a client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Wrapper component to conditionally show the MobileWarningModal
const MobileWarningWrapper = () => {
  const location = useLocation();
  const isSelfHostPage = location.pathname === "/self-host";
  
  if (isSelfHostPage) {
    return null;
  }
  
  return <MobileWarningModal />;
};

const App = () => {
  console.log("APP: Initializing app");
  
  // Add auth diagnostic on app startup
  useEffect(() => {
    const initializeAuth = async () => {
      // Run auth diagnostics on app start
      console.log('[AUTH] Running startup diagnostics...');
      const result = await diagnoseAuthState();
      console.log('[AUTH] Diagnostic result:', result);
    };
    
    initializeAuth();
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <SelfHostBanner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/self-host" element={<SelfHost />} />
              <Route path="/reset-auth" element={<ResetAuthPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireAuth={true}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAuth={true}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <MobileWarningWrapper />
            <Toaster />
            <Sonner />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
