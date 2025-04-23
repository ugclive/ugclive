import React, { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { toast } from '@/components/ui/use-toast'

// Simple protected route that redirects to login if not authenticated
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, isLoading, isLoadingProfile, recoverSession } = useAuth()
  const location = useLocation()
  const [recoveryAttempted, setRecoveryAttempted] = useState(false)
  const [loadingTime, setLoadingTime] = useState(0)
  
  // Count loading time to handle potential hangs
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    
    if (isLoading) {
      timer = setInterval(() => {
        setLoadingTime(prev => prev + 1)
      }, 1000)
    } else if (timer) {
      clearInterval(timer)
      
      // If we've been loading for more than 5 seconds but have no user and haven't tried recovery,
      // try session recovery
      if (loadingTime > 5 && !user && !recoveryAttempted) {
        console.log('[ProtectedRoute] Long loading time detected, attempting session recovery')
        setRecoveryAttempted(true)
        
        recoverSession().then(success => {
          if (!success) {
            toast({
              title: 'Authentication issue',
              description: 'Please try logging in again',
              variant: 'destructive'
            })
          }
        })
      }
    }
    
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isLoading, user, recoveryAttempted, loadingTime, recoverSession])
  
  // Show loading screen while authentication is in progress
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <LoadingScreen message="Authenticating..." />
        
        {/* Show recovery option if it's taking too long */}
        {loadingTime > 8 && (
          <div className="mt-8 text-center">
            <p className="text-muted-foreground mb-2">
              Taking longer than expected...
            </p>
            {recoveryAttempted ? (
              <p className="text-sm text-muted-foreground">Attempting to recover your session</p>
            ) : (
              <button
                onClick={() => {
                  setRecoveryAttempted(true)
                  recoverSession()
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Try to Recover Session
              </button>
            )}
          </div>
        )}
      </div>
    )
  }
  
  // Show specific loading for profile fetching
  if (user && isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <LoadingScreen message="Loading profile..." />
      </div>
    )
  }
  
  // Show profile loading when we have a user but no profile
  if (user && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <LoadingScreen message="Setting up your account..." />
      </div>
    )
  }
  
  // Not authenticated: redirect to login page
  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login')
    return <Navigate to="/" state={{ from: location }} replace />
  }
  
  // User is authenticated and has a profile
  return <>{children}</>
}

export default ProtectedRoute
