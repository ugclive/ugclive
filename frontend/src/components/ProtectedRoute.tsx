import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import LoadingScreen from '@/components/ui/LoadingScreen'

// Simple protected route that redirects to login if not authenticated
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isLoading } = useAuth()
  const location = useLocation()

  // Show loading screen while authentication is in progress
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <LoadingScreen message="Authenticating..." />
      </div>
    )
  }

  // Show loading screen when user is authenticated but profile is still loading
  if (user && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <LoadingScreen message="Loading profile..." />
      </div>
    )
  }

  // Redirect to home if not authenticated
  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login')
    return <Navigate to="/" state={{ from: location }} replace />
  }

  // User is authenticated and has a profile
  return <>{children}</>
}

export default ProtectedRoute
